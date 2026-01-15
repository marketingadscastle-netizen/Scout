import { FrameDiff, Scene } from "../types";

export interface ProcessVideoOptions {
  sampleRate?: number; // Seconds between samples
  diffThreshold?: number; // Pixel difference threshold (0-255)
  onProgress?: (percent: number) => void;
  fixedSegmentDuration?: number; // If set, splits video into fixed time segments
}

export const processVideoScenes = async (
  videoFile: File,
  options: ProcessVideoOptions = {}
): Promise<{ scenes: Scene[]; diffs: FrameDiff[] }> => {
  const { sampleRate = 1, diffThreshold = 18, onProgress, fixedSegmentDuration } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    const url = URL.createObjectURL(videoFile);
    
    // Configure video element properties
    video.muted = true;
    video.playsInline = true;

    // Attach event listeners BEFORE setting src to avoid race conditions
    video.onloadedmetadata = async () => {
      const duration = video.duration;
      // Handle edge case where duration might be Infinity or NaN
      if (!isFinite(duration)) {
         URL.revokeObjectURL(url);
         reject(new Error("Could not determine video duration"));
         return;
      }

      // Calculate dimensions while maintaining aspect ratio
      const MAX_DIMENSION = 320;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = width / height;
        if (width > height) {
          width = MAX_DIMENSION;
          height = Math.round(width / ratio);
        } else {
          height = MAX_DIMENSION;
          width = Math.round(height * ratio);
        }
      }
      
      canvas.width = width;
      canvas.height = height;

      // --- FIXED DURATION MODE ---
      if (fixedSegmentDuration) {
        const scenes: Scene[] = [];
        const diffs: FrameDiff[] = []; // No diffs in fixed mode
        const totalSegments = Math.ceil(duration / fixedSegmentDuration);
        
        try {
          for (let i = 0; i < totalSegments; i++) {
            const start = i * fixedSegmentDuration;
            let end = start + fixedSegmentDuration;
            if (end > duration) end = duration;
            
            // Capture thumbnail at the middle of the segment for better representation
            const thumbTime = start + (end - start) / 2;
            
            await new Promise<void>((resSeek) => {
              const onSeeked = () => {
                video.removeEventListener("seeked", onSeeked);
                ctx.drawImage(video, 0, 0, width, height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                scenes.push({
                  id: i + 1,
                  startTime: start,
                  endTime: end,
                  thumbnailDataUrl: dataUrl
                });
                resSeek();
              };
              video.addEventListener("seeked", onSeeked);
              video.currentTime = Math.min(thumbTime, duration - 0.1);
            });

            if (onProgress) {
               onProgress(Math.round(((i + 1) / totalSegments) * 100));
            }
          }
          
          URL.revokeObjectURL(url);
          resolve({ scenes, diffs });
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
        return;
      }

      // --- VISUAL DETECTION MODE (Original Logic) ---
      const frames: { data: Uint8ClampedArray; time: number; dataUrl: string }[] = [];
      const diffs: FrameDiff[] = [];
      const numSamples = Math.floor(duration / sampleRate);
      
      let currentTime = 0;
      let processedCount = 0;

      const captureFrame = async (time: number) => {
        return new Promise<void>((resSeek) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            // We save the full quality dataUrl for the thumbnail
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85); 
            frames.push({
              data: imageData.data,
              time: time,
              dataUrl: dataUrl
            });
            resSeek();
          };
          video.addEventListener("seeked", onSeeked);
          video.currentTime = time;
        });
      };

      try {
        // Sequential capture
        while (currentTime <= duration) {
          await captureFrame(currentTime);
          processedCount++;
          if (onProgress) {
            onProgress(Math.round((processedCount / (numSamples + 1)) * 100));
          }
          currentTime += sampleRate;
        }

        // Calculate differences
        for (let i = 1; i < frames.length; i++) {
          const prev = frames[i - 1].data;
          const curr = frames[i].data;
          let diffSum = 0;
          
          // Simple mean absolute difference algorithm
          for (let k = 0; k < prev.length; k += 4) {
             // Gray conversion for simpler comparison: 0.299R + 0.587G + 0.114B
             const gray1 = 0.299 * prev[k] + 0.587 * prev[k + 1] + 0.114 * prev[k + 2];
             const gray2 = 0.299 * curr[k] + 0.587 * curr[k + 1] + 0.114 * curr[k + 2];
             diffSum += Math.abs(gray1 - gray2);
          }
          
          const avgDiff = diffSum / (prev.length / 4);
          diffs.push({
            timestamp: frames[i].time,
            diffScore: avgDiff,
            frameIndex: i
          });
        }

        // Detect cuts
        const scenes: Scene[] = [];
        let sceneStartIdx = 0;

        diffs.forEach((d, idx) => {
          // idx maps to frames[idx+1]
          if (d.diffScore > diffThreshold) {
            // Cut detected
            const endIdx = idx + 1; // The frame that was different
            scenes.push({
              id: scenes.length + 1,
              startTime: frames[sceneStartIdx].time,
              endTime: frames[endIdx].time,
              thumbnailDataUrl: frames[Math.floor((sceneStartIdx + endIdx) / 2)].dataUrl
            });
            sceneStartIdx = endIdx;
          }
        });

        // Add final scene
        if (frames.length > 0 && sceneStartIdx < frames.length) {
          scenes.push({
            id: scenes.length + 1,
            startTime: frames[sceneStartIdx].time,
            endTime: duration,
            thumbnailDataUrl: frames[Math.floor((sceneStartIdx + frames.length - 1) / 2)].dataUrl
          });
        }

        URL.revokeObjectURL(url);
        resolve({ scenes, diffs });

      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Error loading video"));
    };

    // Set src LAST to ensure listeners are ready
    video.src = url;
  });
};