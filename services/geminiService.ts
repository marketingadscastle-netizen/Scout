import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";
import { SceneAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 2000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes("429") || error?.status === 429 || error?.message?.includes("RESOURCE_EXHAUSTED");
    const isFetchError = error?.message?.includes("fetch") || error?.name === "TypeError" || error?.message?.includes("Network");
    
    if (retries > 0 && (isQuotaError || error?.status >= 500 || isFetchError)) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

const parseCoords = (coordInput: any) => {
  if (coordInput && typeof coordInput === 'object') {
    if (Array.isArray(coordInput)) {
      return { x: String(coordInput[0] ?? 50), y: String(coordInput[1] ?? 50) };
    }
    const x = coordInput.x ?? coordInput.left ?? 50;
    const y = coordInput.y ?? coordInput.top ?? 50;
    return { x: String(x), y: String(y) };
  }
  const str = String(coordInput || "");
  const matches = str.match(/(\d+)/g);
  if (matches && matches.length >= 2) {
    return { x: matches[0], y: matches[1] };
  }
  return { x: "50", y: "50" };
};

const extractPercent = (val: any) => {
  const str = String(val || "");
  const match = str.match(/(\d+)/);
  return match ? match[1] : "50";
};

const reconstructFormulaPrompt = (parsed: any, sceneId: number): string => {
  const sceneNum = String(sceneId).padStart(3, '0');
  const sub = parsed.subjects?.[0] || { 
    position: "[50,50]", 
    scale_diameter: "50%", 
    features: "Unknown", 
    action: "Neutral", 
    gesture: "None", 
    expression: "Neutral",
    description: "A subject in the frame."
  };
  
  const coords = parseCoords(sub.position);
  const heightPercent = extractPercent(sub.scale_diameter);
  const cam = parsed.camera || { shot_type: "Medium", angle: "Eye-level", lens: "35mm", focus_target: "Subject" };
  const light = parsed.lighting || { source: "Ambient", direction: "Front", quality: "Soft", color_temperature_kelvin: "5500K" };
  const env = parsed.environment || { location: "Unknown", man_made_elements: "None", weather: "Clear", atmosphere_density: "Low" };
  const palette = parsed.color_palette || { dominant: "Natural", secondary: "Neutral", saturation: "Medium" };

  return `[SCENE_RECONSTRUCTION_DNA: ${sceneNum}]
OBJECTIVE: ABSOLUTE 1:1 VISUAL REPLICATION. 
PROTOCOL: SCAN EVERY PIXEL AND TRANSLATE TO TECHNICAL CODE.

DETAILED_FORENSIC_SUMMARY:
${parsed.visual_description}

TECHNICAL_DNA_PARAMETERS:
- ARTISTIC_STYLE: ${parsed.visualStyle || 'Ultra-realistic cinematic photography, zero stylization'}
- SUBJECT_IDENTITY: ${sub.features}. ${sub.description}
- POSTURE_MICRO_DATA: ${sub.action}, ${sub.gesture}
- FACIAL_EXPRESSION_STATE: ${sub.expression}
- OPTICAL_RIG: ${cam.lens} lens, ${cam.shot_type} shot from ${cam.angle} angle, focused on ${cam.focus_target}
- SPATIAL_COORDINATES: Center Point [X:${coords.x}%, Y:${coords.y}%], Frame Height Occupancy: ${heightPercent}%
- LIGHTING_ENGINE: ${light.source} source, directed from ${light.direction}, shadow quality: ${light.quality}. Color temperature: ${light.color_temperature_kelvin}K
- ATMOSPHERIC_DATA: Location ${env.location}, Background architecture: ${env.man_made_elements}, Atmos density: ${env.atmosphere_density}
- CHROMATIC_DNA: Primary ${palette.dominant}, Secondary ${palette.secondary}. Saturation score: ${palette.saturation}

STRICT: OUTPUT MUST BE INDISTINGUISHABLE FROM THE ORIGINAL SCENE IN PROPORTION, COLOR, AND TEXTURE.`;
};

const analyzeWithGpt5 = async (base64Image: string, apiKey: string): Promise<any> => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
  
  let response;
  try {
    response = await fetch("https://ai.sumopod.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: "You are a Forensic Visual Data Engineer. Your goal is absolute 1:1 image replication. Extract exhaustive technical data including micro-textures (fabric weaves, skin imperfections, specular highlights), precise geometric positioning (using percentage coordinates), and exact optical settings (lens distortion, lighting physics). Your description MUST allow for pixel-perfect reconstruction."
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `Exhaustive Forensic Analysis. 
                1. 'visual_description': Provide a dense, hyper-specific 200-word paragraph detailing every object, material property, color value, and character nuance visible.
                2. Structured JSON covering ALL technical data points for replication.
                
                SCHEMA:
                { 
                  visual_description: string,
                  visual_anchors: string[], 
                  subjects: [{ name, description, features, action, gesture, expression, position, scale_diameter }], 
                  camera: { shot_type, angle, lens, aperture, focus_target }, 
                  lighting: { source, direction, quality, contrast, color_temperature_kelvin }, 
                  environment: { location, weather, man_made_elements, atmosphere_density }, 
                  color_palette: { dominant, secondary, saturation }, 
                  mood: string, 
                  visualStyle: string, 
                  keywords: string[] 
                }` 
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }
            ]
          }
        ],
        max_tokens: 4096
      })
    });
  } catch (e) {
    throw new Error("Failed to reach GPT-5.1 proxy (CORS or Network Error)");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Endpoint Error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(jsonStr);
};

export const analyzeSceneFrame = async (base64Image: string, sceneId: number, customApiKey?: string): Promise<SceneAnalysis> => {
  // If custom API Key is provided manually, use GPT-5.1 logic
  if (customApiKey && customApiKey.trim() !== "") {
    return withRetry(async () => {
      const parsedData = await analyzeWithGpt5(base64Image, customApiKey);
      return {
        ...parsedData,
        imagePrompt: reconstructFormulaPrompt(parsedData, sceneId),
        videoPrompt: `Visual sequence continuity: ${reconstructFormulaPrompt(parsedData, sceneId)}. Maintain 1:1 DNA.`,
      };
    });
  }

  // Fallback to Gemini Logic if Key is empty
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
            {
              text: "Forensic visual analysis for 1:1 image replication. Capture character identity, fabrics, precise positioning, lighting sources, and environment geometry. Output exhaustive 'visual_description' and full technical JSON.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visual_description: { type: Type.STRING },
            visual_anchors: { type: Type.ARRAY, items: { type: Type.STRING } },
            subjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  features: { type: Type.STRING },
                  action: { type: Type.STRING },
                  gesture: { type: Type.STRING },
                  expression: { type: Type.STRING },
                  position: { type: Type.STRING },
                  scale_diameter: { type: Type.STRING },
                },
                required: ["name", "description", "features", "action", "gesture", "expression", "position", "scale_diameter"],
              },
            },
            camera: {
              type: Type.OBJECT,
              properties: {
                shot_type: { type: Type.STRING },
                angle: { type: Type.STRING },
                lens: { type: Type.STRING },
                aperture: { type: Type.STRING },
                focus_target: { type: Type.STRING },
              },
            },
            lighting: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                direction: { type: Type.STRING },
                quality: { type: Type.STRING },
                contrast: { type: Type.STRING },
                color_temperature_kelvin: { type: Type.STRING },
              },
            },
            environment: {
              type: Type.OBJECT,
              properties: {
                location: { type: Type.STRING },
                weather: { type: Type.STRING },
                man_made_elements: { type: Type.STRING },
                atmosphere_density: { type: Type.STRING },
              },
            },
            color_palette: {
              type: Type.OBJECT,
              properties: {
                dominant: { type: Type.STRING },
                secondary: { type: Type.STRING },
                saturation: { type: Type.STRING },
              },
            },
            mood: { type: Type.STRING },
            visualStyle: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["visual_description", "visual_anchors", "subjects", "camera", "lighting", "environment", "color_palette", "mood", "visualStyle"],
        },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    return {
      ...parsedData,
      imagePrompt: reconstructFormulaPrompt(parsedData, sceneId),
      videoPrompt: `Visual sequence continuity: ${reconstructFormulaPrompt(parsedData, sceneId)}. Maintain 1:1 DNA.`,
    };
  });
};

export const generateTimelapsePrompt = async (base64Images: string[], customApiKey?: string): Promise<string> => {
  if (customApiKey && customApiKey.trim() !== "") {
    return withRetry(async () => {
      const parts = base64Images.map((img) => ({
        type: "image_url",
        image_url: { url: img }
      }));

      const response = await fetch("https://ai.sumopod.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${customApiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5.1",
          messages: [
            {
              role: "system",
              content: "Master Visual Transition Engineer. Analyze sequence for 1:1 identity preservation. Create transition prompt."
            },
            {
              role: "user",
              content: [
                ...parts,
                { type: "text", text: "Create technical transition DNA prompt preserving all anchors." }
              ]
            }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) throw new Error("GPT-5.1 Sequence Analysis Failed");
      const result = await response.json();
      return result.choices[0].message.content;
    });
  }

  const parts = base64Images.map((img) => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: img.replace(/^data:image\/(png|jpeg|jpg);base64,/, ""),
    },
  }));

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            ...parts,
            {
              text: "Analyze visual evolution. Maintain character identity 1:1. Generate technical sequence prompt.",
            },
          ],
        },
      ],
      config: {
        safetySettings: SAFETY_SETTINGS,
      },
    });

    return response.text || "Sequence DNA calculation failed.";
  });
};
