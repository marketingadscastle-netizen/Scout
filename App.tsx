import React, { useState, useCallback, useRef } from "react";
import VideoUploader from "./components/VideoUploader";
import SceneCard from "./components/SceneCard";
import Sidebar from "./components/Sidebar";
import { processVideoScenes } from "./services/videoUtils";
import { analyzeSceneFrame } from "./services/geminiService";
import { Scene, FrameDiff, AnalysisProgress } from "./types";

const ProcessingStep = ({ label, status }: { label: string, status: 'waiting' | 'active' | 'completed' }) => (
  <div className="flex items-center gap-3 transition-all duration-300">
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border transition-colors duration-300 flex-shrink-0 ${
      status === 'completed' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' :
      status === 'active' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 animate-pulse' :
      'border-gray-200 text-gray-300 bg-white'
    }`}>
      {status === 'completed' ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      ) : status === 'active' ? (
        <div className="w-2 h-2 rounded-full bg-indigo-600" />
      ) : (
        <div className="w-2 h-2 rounded-full bg-gray-200" />
      )}
    </div>
    <span className={`text-sm transition-colors duration-300 ${
      status === 'completed' ? 'text-gray-700 font-medium' :
      status === 'active' ? 'text-indigo-700 font-semibold' :
      'text-gray-400'
    }`}>{label}</span>
  </div>
);

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [frameDiffs, setFrameDiffs] = useState<FrameDiff[]>([]);
  const [progress, setProgress] = useState<AnalysisProgress>({ status: 'idle', progress: 0 });
  const [selectedSceneIds, setSelectedSceneIds] = useState<number[]>([]);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [showDurationSelection, setShowDurationSelection] = useState(false);
  
  // Custom API Key Logic - Starts EMPTY by default every time as requested
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  const stopBatchRef = useRef(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setVideoUrl(url);
    
    setScenes([]);
    setFrameDiffs([]);
    setSelectedSceneIds([]);
    setProgress({ status: 'idle', progress: 0 });
    setIsBatchAnalyzing(false);
    setIsStopping(false);
    stopBatchRef.current = false;
    setShowDurationSelection(true);
  }, []);

  const handleDurationSelect = async (duration: number) => {
    if (!file) return;
    setShowDurationSelection(false);
    setProgress({ status: 'processing_video', progress: 0 });

    try {
      const { scenes: detectedScenes, diffs } = await processVideoScenes(file, {
        onProgress: (p) => setProgress({ status: 'processing_video', progress: p }),
        fixedSegmentDuration: duration
      });
      setScenes(detectedScenes);
      setFrameDiffs(diffs);
      setProgress({ status: 'complete', progress: 100 });
    } catch (error) {
      console.error(error);
      setProgress({ status: 'error', progress: 0, message: 'Failed to process video.' });
    }
  };

  const handleConnectApi = () => {
    setIsConnecting(true);
    // Visual delay for "Connecting" feedback
    setTimeout(() => {
      setCustomApiKey(apiKeyInput.trim());
      setIsConnecting(false);
    }, 600);
  };

  const handleAnalyzeScene = async (sceneId: number) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isAnalyzing: true, error: undefined } : s));
    
    try {
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return;

      const analysis = await analyzeSceneFrame(scene.thumbnailDataUrl, sceneId, customApiKey);
      
      setScenes(prev => prev.map(s => 
        s.id === sceneId ? { ...s, analysis, isAnalyzing: false } : s
      ));
    } catch (error: any) {
      console.error("Analysis Error:", error);
      let errorMessage = "Analysis Failed";
      if (error?.message?.includes("fetch")) errorMessage = "Network Error (CORS/Proxy)";
      else if (error?.message?.includes("Quota")) errorMessage = "Quota Limit Exceeded";
      else if (error?.message?.includes("API Key")) errorMessage = "Invalid API Key";
      else errorMessage = error?.message || "Error";

      setScenes(prev => prev.map(s => s.id === sceneId ? { 
        ...s, 
        isAnalyzing: false, 
        error: errorMessage 
      } : s));
      throw error; 
    }
  };

  const handleAnalyzeAll = async () => {
    if (isBatchAnalyzing || isStopping || scenes.length === 0) return;
    setIsBatchAnalyzing(true);
    stopBatchRef.current = false;

    try {
      const idsToProcess = scenes.filter(s => !s.analysis).map(s => s.id);
      for (let i = 0; i < idsToProcess.length; i++) {
        if (stopBatchRef.current) break;
        try {
          await handleAnalyzeScene(idsToProcess[i]);
          if (i < idsToProcess.length - 1) {
            // Faster delay for custom API, longer for free Gemini
            const delay = customApiKey ? 800 : 3500;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (err: any) {
          // Break on fatal key/network errors
          if (err?.message?.includes("Quota") || err?.message?.includes("Key") || err?.message?.includes("fetch")) break;
        }
      }
    } finally {
      setIsBatchAnalyzing(false);
      setIsStopping(false);
    }
  };

  const handleStopBatch = () => {
    stopBatchRef.current = true;
    setIsStopping(true);
  };

  const handleToggleSelect = (id: number) => {
    setSelectedSceneIds(prev => {
      if (prev.includes(id)) return prev.filter(sid => sid !== id);
      if (prev.length >= 2) return [id];
      return [...prev, id].sort((a, b) => a - b);
    });
  };

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(null);
    setVideoUrl(null);
    setScenes([]);
    setFrameDiffs([]);
    setSelectedSceneIds([]);
    setProgress({ status: 'idle', progress: 0 });
    setIsBatchAnalyzing(false);
    setIsStopping(false);
    setShowDurationSelection(false);
  };

  const copyToClipboard = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 h-16 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">S</div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">SceneScout</h1>
          </div>
          <div className="flex items-center gap-4">
             {file && <button onClick={reset} className="text-sm font-medium text-gray-500 hover:text-red-600 px-3 transition-colors">New Video</button>}
             <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
               customApiKey ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
             }`}>
               {customApiKey ? '✓ GPT-5.1 ACTIVE' : 'GEMINI FALLBACK'}
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 relative">
        <main className="w-full pb-32">
          <div className="max-w-7xl mx-auto px-4 py-8">
            
            {!file && (
              <div className="animate-fade-in-up mt-16 max-w-3xl mx-auto text-center">
                <div className="mb-12">
                  <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                    Video to <span className="text-indigo-600">Scene Intelligence</span>
                  </h2>
                  <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                    Instantly detect scenes and generate high-fidelity technical prompts using advanced visual reasoning models.
                  </p>
                </div>
                <VideoUploader onFileSelect={handleFileSelect} />
              </div>
            )}

            {file && showDurationSelection && (
              <div className="animate-fade-in flex flex-col items-center justify-center min-h-[50vh]">
                 <div className="text-center mb-10">
                   <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose scene detection mode</h2>
                   <p className="text-gray-500">Split into fixed segments or use AI to detect visual cuts.</p>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl px-4">
                    <button onClick={() => handleDurationSelect(0)} className="flex flex-col items-center justify-center p-8 bg-white border-2 border-indigo-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group relative">
                       <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold">SMART</div>
                       <div className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center mb-4"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg></div>
                       <span className="text-lg font-bold text-gray-800">Visual Cut AI</span>
                    </button>
                    {[5, 8, 10].map(d => (
                       <button key={d} onClick={() => handleDurationSelect(d)} className="flex flex-col items-center justify-center p-8 bg-white border-2 border-gray-100 rounded-2xl hover:border-indigo-500 transition-all group">
                          <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold mb-4">{d}s</div>
                          <span className="text-lg font-bold text-gray-800">{d} Seconds</span>
                       </button>
                    ))}
                 </div>
              </div>
            )}

            {file && !showDurationSelection && (
              <div className="animate-fade-in space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <div className="bg-black rounded-xl overflow-hidden shadow-lg aspect-video relative">
                      <video src={videoUrl || ""} controls className="w-full h-full object-contain"/>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    {progress.status === 'processing_video' ? (
                      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm h-full flex flex-col justify-center">
                        <div className="max-w-md mx-auto w-full text-center">
                          <div className="inline-flex relative mb-4">
                             <div className="w-16 h-16 rounded-full border-4 border-indigo-50 border-t-indigo-600 animate-spin"></div>
                             <div className="absolute inset-0 flex items-center justify-center font-bold text-gray-700">{Math.round(progress.progress)}%</div>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-6">Processing Video</h3>
                          <div className="space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100 text-left">
                            <ProcessingStep label="Initializing stream" status={progress.progress > 2 ? 'completed' : 'active'} />
                            <ProcessingStep label="Scanning frames" status={progress.progress > 5 ? (progress.progress > 80 ? 'completed' : 'active') : 'waiting'} />
                            <ProcessingStep label="Finalizing scenes" status={progress.progress > 80 ? 'active' : 'waiting'} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900">Scene Map</h3>
                            <p className="text-gray-500">{scenes.length} points detected in timeline.</p>
                          </div>
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <button
                              onClick={isBatchAnalyzing ? handleStopBatch : handleAnalyzeAll}
                              disabled={isStopping}
                              className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 whitespace-nowrap ${
                                isBatchAnalyzing ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              {isBatchAnalyzing ? 'Stop Analysis' : `Analyze All ${scenes.length} Scenes`}
                            </button>
                            {isBatchAnalyzing && (
                              <span className="text-[10px] text-gray-400 text-center animate-pulse">Processing via {customApiKey ? 'GPT-5.1' : 'Gemini'}...</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-auto border-t border-gray-100 pt-6">
                           <div className="flex flex-col sm:flex-row items-end gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner">
                              <div className="flex-1 w-full">
                                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Connect GPT-5.1 (sk-v-...)</label>
                                 <input 
                                  type="password"
                                  placeholder="API Key Empty = Using Gemini Fallback"
                                  value={apiKeyInput}
                                  onChange={(e) => setApiKeyInput(e.target.value)}
                                  className="w-full text-xs p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                 />
                              </div>
                              <button 
                                onClick={handleConnectApi}
                                disabled={isConnecting}
                                className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
                                  customApiKey && apiKeyInput === customApiKey
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-900 text-white hover:bg-black active:scale-95'
                                }`}
                              >
                                {isConnecting ? (
                                  <div className="w-3 h-3 border-2 border-white/20 border-t-white animate-spin rounded-full" />
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                )}
                                {customApiKey && apiKeyInput === customApiKey ? 'Key Applied' : 'Apply Key'}
                              </button>
                           </div>
                           <p className="text-[9px] text-gray-400 mt-2 italic px-1">
                             Defaults to Gemini if left empty. Must fill manually for GPT-5.1 forensic analysis. "Failed to Fetch" indicates network/proxy issues.
                           </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {progress.status === 'complete' && (
                  <div className="space-y-6">
                    {scenes.map((scene) => (
                      <SceneCard 
                        key={scene.id} 
                        scene={scene} 
                        onAnalyze={handleAnalyzeScene}
                        isSelected={selectedSceneIds.includes(scene.id)}
                        selectionIndex={selectedSceneIds.indexOf(scene.id) + 1}
                        onToggleSelect={handleToggleSelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {file && !showDurationSelection && progress.status === 'complete' && selectedSceneIds.length > 0 && (
          <Sidebar scenes={scenes} selectedSceneIds={selectedSceneIds} onCopy={copyToClipboard} customApiKey={customApiKey} />
        )}
      </div>
    </div>
  );
};

export default App;