
import React, { useState } from 'react';
import { Scene } from '../types';
import { generateTimelapsePrompt } from '../services/geminiService';

interface SidebarProps {
  scenes: Scene[];
  selectedSceneIds: number[];
  onCopy: (text: string) => void;
  customApiKey?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ scenes, selectedSceneIds, onCopy, customApiKey }) => {
  const [timelapsePrompt, setTimelapsePrompt] = useState<string | null>(null);
  const [isGenTimelapse, setIsGenTimelapse] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleGenTimelapse = async () => {
    if (selectedSceneIds.length !== 2) return;
    setIsGenTimelapse(true);
    setTimelapsePrompt(null);
    
    try {
      const startId = Math.min(selectedSceneIds[0], selectedSceneIds[1]);
      const endId = Math.max(selectedSceneIds[0], selectedSceneIds[1]);
      
      const sceneSequence = scenes
        .filter(s => s.id >= startId && s.id <= endId)
        .sort((a, b) => a.id - b.id);

      if (sceneSequence.length > 0) {
        let framesToSend = [];
        const MAX_FRAMES = 8;
        
        if (sceneSequence.length > MAX_FRAMES) {
            const step = (sceneSequence.length - 1) / (MAX_FRAMES - 1);
            for (let i = 0; i < MAX_FRAMES; i++) {
                const idx = Math.round(i * step);
                framesToSend.push(sceneSequence[idx].thumbnailDataUrl);
            }
        } else {
            framesToSend = sceneSequence.map(s => s.thumbnailDataUrl);
        }

        if (framesToSend.length > 0) {
            const res = await generateTimelapsePrompt(framesToSend, customApiKey);
            setTimelapsePrompt(res);
        }
      }
    } catch (e) { 
      console.error(e); 
      setTimelapsePrompt("Error generating prompt. Please try again.");
    }
    setIsGenTimelapse(false);
  };

  if (selectedSceneIds.length === 0) return null;

  return (
    <div 
      className={`
        fixed z-50 transition-all duration-300 ease-in-out shadow-2xl
        ${isExpanded 
          ? 'bottom-4 left-4 right-4 md:top-24 md:bottom-auto md:left-auto md:right-4 md:w-80 h-auto max-h-[60vh] md:max-h-[calc(100vh-8rem)] rounded-2xl' 
          : 'bottom-4 right-4 md:top-24 md:bottom-auto w-12 h-12 rounded-full'
        }
      `}
    >
      <div className={`bg-white/95 backdrop-blur-md border border-gray-200 overflow-hidden flex flex-col h-full ${isExpanded ? 'rounded-2xl' : 'rounded-full'}`}>
        
        {/* Header / Toggle */}
        <div 
          className="p-4 bg-indigo-600 text-white flex justify-between items-center cursor-pointer hover:bg-indigo-700 transition-colors flex-shrink-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
           {isExpanded ? (
             <h2 className="font-bold flex items-center gap-2 text-sm">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               Timelapse Studio
             </h2>
           ) : (
             <div className="w-full h-full flex items-center justify-center">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
           )}
           {isExpanded && (
             <button className="text-white/80 hover:text-white">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
               </svg>
             </button>
           )}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0">
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-4 flex-shrink-0">
                 <p className="text-[10px] text-indigo-800 mb-2 font-medium uppercase tracking-wide">
                   Time Flow Analysis
                 </p>
                 <div className="flex gap-2 items-center mb-3">
                    <div className="flex-1 bg-white p-2 rounded border border-indigo-200 text-center">
                       <span className="block text-[8px] text-gray-400 uppercase">Start Frame</span>
                       <span className="text-indigo-700 font-bold text-sm">#{Math.min(...selectedSceneIds)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-indigo-300 text-[8px]">▶ FLOW ▶</span>
                    </div>
                    <div className="flex-1 bg-white p-2 rounded border border-indigo-200 text-center">
                       <span className="block text-[8px] text-gray-400 uppercase">End Frame</span>
                       <span className="text-indigo-700 font-bold text-sm">#{Math.max(...selectedSceneIds)}</span>
                    </div>
                 </div>
                 
                 <div className="text-[10px] text-gray-500 mb-3 text-center leading-tight">
                   Analyzing evolution using {customApiKey ? 'GPT-5.1' : 'Gemini'}
                 </div>

                 <button
                   onClick={handleGenTimelapse}
                   disabled={isGenTimelapse || selectedSceneIds.length !== 2}
                   className="w-full bg-indigo-600 text-white py-3 md:py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                 >
                   {isGenTimelapse ? 'Analyzing Sequence...' : 'Generate Timelapse Prompt'}
                 </button>
              </div>

              {timelapsePrompt && (
                <div className="animate-fade-in flex-1 min-h-0 flex flex-col">
                  <div className="bg-gray-900 p-3 rounded-xl border border-gray-800 text-gray-300 shadow-inner flex flex-col h-full">
                     <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 flex-shrink-0">
                        <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Result</span>
                        <button onClick={() => onCopy(timelapsePrompt)} className="text-[10px] bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 md:px-2 md:py-0.5 rounded transition-colors border border-gray-700">
                          Copy
                        </button>
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] leading-relaxed font-mono whitespace-pre-wrap text-gray-300">
                          {timelapsePrompt}
                        </p>
                     </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
