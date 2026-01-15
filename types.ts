
export interface FrameDiff {
  timestamp: number;
  diffScore: number;
  frameIndex: number;
}

export interface Scene {
  id: number;
  startTime: number;
  endTime: number;
  thumbnailDataUrl: string;
  analysis?: SceneAnalysis;
  isAnalyzing?: boolean;
  error?: string;
}

export interface DetailedSubject {
  name: string;
  description: string;
  action: string;
  gesture: string; // Forensic micro-movements/posture
  expression: string; // Specific facial state
  features: string; // Immutable physical details
  position: string; // 9-point grid position
  scale_diameter: string; // Frame occupancy
}

export interface CameraDetails {
  shot_type: string;
  angle: string;
  lens: string;
  aperture: string;
  focus_target: string;
}

export interface LightingDetails {
  source: string;
  direction: string;
  quality: string;
  contrast: string;
  color_temperature_kelvin: string; 
}

export interface EnvironmentDetails {
  location: string;
  terrain: string;
  man_made_elements: string;
  weather: string;
  atmosphere_density: string; 
}

export interface SceneAnalysis {
  visual_description: string; // High-fidelity natural language summary
  imagePrompt: string;
  videoPrompt: string;
  keywords: string[];
  mood: string;
  visualStyle: string;
  subjects: DetailedSubject[];
  visual_anchors: string[]; 
  camera?: CameraDetails;
  lighting?: LightingDetails;
  environment?: EnvironmentDetails;
  color_palette?: {
    dominant: string;
    secondary: string;
    saturation: string;
  };
}

export interface AnalysisProgress {
  status: 'idle' | 'processing_video' | 'analyzing_scenes' | 'complete' | 'error';
  progress: number;
  message?: string;
}
