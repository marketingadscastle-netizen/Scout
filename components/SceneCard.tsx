import React, { useState } from 'react';
import { Scene } from '../types';

interface SceneCardProps {
  scene: Scene;
  onAnalyze: (id: number) => void;
  isSelected?: boolean;
  selectionIndex?: number;
  onToggleSelect?: (id: number) => void;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, onAnalyze, isSelected, selectionIndex, onToggleSelect }) => {
  const { id, startTime, endTime, thumbnailDataUrl, analysis, isAnalyzing, error } = scene;
  const [showJson, setShowJson] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});

  const copyToClipboard = async (text: string, key: string) => {
    if (navigator?.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedStates(prev => ({ ...prev, [key]: true }));
        setTimeout(() => setCopiedStates(prev => ({ ...prev, [key]: false })), 2000);
      } catch (err) { console.error(err); }
    }
  };

  const safeRender = (val: any): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      try {
        return Object.entries(val)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
      } catch (e) {
        return JSON.stringify(val);
      }
    }
    return String(val);
  };

  const DetailRow = ({ label, value }: { label: string, value?: any }) => {
    const renderedValue = safeRender(value);
    if (!renderedValue || renderedValue === "Unknown" || renderedValue === "string" || renderedValue === "unspecified") return null;
    return (
      <div className="flex justify-between items-start gap-2 text-[10px]">
        <span className="text-gray-500 flex-shrink-0">{label}:</span>
        <span className="text-gray-800 font-medium text-right break-words max-w-[70%]">{renderedValue}</span>
      </div>
    );
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col lg:flex-row gap-0 group relative ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/10' : 'border-gray-200'}`}>
      
      <div className="absolute top-3 left-3 z-10">
        <button
          onClick={() => onToggleSelect && onToggleSelect(id)}
          className={`w-8 h-8 lg:w-6 lg:h-6 rounded border flex items-center justify-center transition-colors shadow-sm ${
            isSelected ? 'bg-indigo-600 border-indigo-600 text-white font-bold' : 'bg-white/90 border-gray-300 text-transparent'
          }`}
        >
          {isSelected ? selectionIndex : '✓'}
        </button>
      </div>

      <div className="relative w-full lg:w-72 h-48 lg:h-auto flex-shrink-0 bg-gray-100 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-100">
        <img src={thumbnailDataUrl} alt={`Scene ${id}`} className="w-full h-full object-cover flex-1" />
        <div className="bg-gray-900 text-white text-[10px] px-3 py-1.5 flex justify-between items-center font-mono">
           <span>{startTime.toFixed(1)}s - {endTime.toFixed(1)}s</span>
           <span>SCENE {id}</span>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-2">
          <div className="w-full sm:w-auto">
            <h3 className="text-lg font-bold text-gray-800">Scene {id}</h3>
            {analysis && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                 {analysis.visual_anchors?.slice(0, 4).map((anchor, i) => (
                   <span key={i} className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100 font-bold uppercase tracking-tighter">
                      ⚓ {safeRender(anchor)}
                   </span>
                 ))}
                 {analysis.subjects?.[0] && (
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 font-bold uppercase tracking-tighter">
                       👤 {safeRender(analysis.subjects[0].expression)}
                    </span>
                 )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
             {!analysis && !isAnalyzing && (
               <button onClick={() => onAnalyze(id)} className="flex-1 sm:flex-none text-center text-xs bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 shadow-sm font-medium">
                 {error ? `Retry (${error})` : "Analyze Scene"}
               </button>
             )}
             {isAnalyzing && (
                <span className="text-xs text-indigo-500 font-medium animate-pulse bg-indigo-50 px-3 py-1 rounded-full">Analyzing Scene {id}...</span>
             )}
             {analysis && (
               <div className="flex items-center gap-2">
                 {showJson && (
                   <button 
                     onClick={() => copyToClipboard(JSON.stringify(analysis, null, 2), 'jsonP')} 
                     className="flex-1 sm:flex-none text-xs bg-emerald-600 text-white px-3 py-1.5 rounded font-medium hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95"
                   >
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                     {copiedStates['jsonP'] ? "Copied!" : "Copy JSON"}
                   </button>
                 )}
                 <button onClick={() => setShowJson(!showJson)} className="flex-1 sm:flex-none text-xs text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded font-medium hover:bg-gray-50 transition-colors">
                   {showJson ? "Back to Analysis" : "Variable View"}
                 </button>
               </div>
             )}
          </div>
        </div>

        {analysis ? (
           showJson ? (
             <div className="mt-2 animate-fade-in flex flex-col h-full">
               <pre className="bg-gray-900 text-indigo-300 text-[10px] p-4 rounded-xl border border-gray-800 overflow-x-auto h-80 font-mono shadow-inner custom-scrollbar">
                 {JSON.stringify(analysis, null, 2)}
               </pre>
             </div>
           ) : (
             <div className="space-y-4 mt-1">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100 flex flex-col h-full relative">
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Master Replication Prompt</span>
                       <button onClick={() => copyToClipboard(analysis.imagePrompt, 'imgP')} className="text-[10px] bg-white text-indigo-600 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition-colors">
                          {copiedStates['imgP'] ? "Copied" : "Copy"}
                       </button>
                     </div>
                     <p className="text-[11px] text-gray-700 leading-relaxed font-mono line-clamp-[8]">{analysis.imagePrompt}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100 flex flex-col gap-1.5">
                         <span className="text-[9px] font-bold text-gray-400 uppercase">Optical Props</span>
                         <DetailRow label="Lens" value={analysis.camera?.lens} />
                         <DetailRow label="Temp" value={analysis.lighting?.color_temperature_kelvin} />
                         <DetailRow label="Angle" value={analysis.camera?.angle} />
                      </div>

                      <div className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100 flex flex-col gap-1.5">
                         <span className="text-[9px] font-bold text-gray-400 uppercase">Geometry</span>
                         {analysis.subjects?.[0] && (
                            <div className="flex flex-col gap-1">
                               <DetailRow label="Pos" value={analysis.subjects[0].position} />
                               <DetailRow label="Height" value={analysis.subjects[0].scale_diameter} />
                               <div className="text-[9px] text-gray-800 font-medium italic mt-1 line-clamp-1">
                                  "{safeRender(analysis.subjects[0].gesture)}"
                               </div>
                            </div>
                         )}
                      </div>

                      <div className="col-span-2 bg-slate-900 rounded-lg p-2.5 shadow-inner">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Visual Anchors</span>
                        <div className="flex flex-wrap gap-1">
                           {analysis.visual_anchors.map((v, i) => (
                             <span key={i} className="text-[9px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">#{safeRender(v)}</span>
                           ))}
                        </div>
                      </div>
                  </div>
               </div>
               <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Scene Description</span>
                  <p className="text-[10px] text-gray-600 leading-relaxed italic line-clamp-2">{analysis.visual_description}</p>
               </div>
             </div>
           )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-xs text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
            <span className="font-medium">
              {error ? "Analysis Encountered Error" : `Waiting to analyze Scene ${id}...`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneCard;