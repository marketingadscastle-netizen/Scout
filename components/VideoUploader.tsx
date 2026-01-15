import React from 'react';

interface VideoUploaderProps {
  onFileSelect: (file: File) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onFileSelect }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-3xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-400 transition-all duration-300 group">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300 text-indigo-500 ring-1 ring-gray-100">
            <svg className="w-8 h-8" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="mb-2 text-lg font-semibold text-slate-700">Click to upload video</p>
          <p className="text-sm text-slate-400 font-medium">MP4, WEBM or OGG (Max 50MB recommended)</p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept="video/*" 
          onChange={handleChange} 
        />
      </label>
      <div className="mt-6 text-center text-xs text-slate-400 font-medium tracking-wide">
        All processing happens locally in your browser. Only thumbnails are sent to Gemini for analysis.
      </div>
    </div>
  );
};

export default VideoUploader;