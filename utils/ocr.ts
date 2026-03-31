import { GoogleGenAI, Type } from "@google/genai";
import { SpeechBubble } from "../types";
import { getSettings } from "../components/SettingsModal";
const SYSTEM_PROMPT = `Analyze the provided manga pages in the exact order they are given.
For each page, detect all speech bubbles.
Return an array of results, where the first item corresponds to the first image, the second item to the second image, and so on.
For each bubble, extract the English text and the bounding box (ymin, xmin, ymax, xmax) on a 0-1000 scale relative to the image dimensions.
Ignore sound effects and narration boxes if they don't contain dialogue.`;

export const analyzeMangaPages = async (
  base64Images: string[]
): Promise<SpeechBubble[][]> => {
  try {
    const settings = getSettings();
    
    if (!settings.apiKey || settings.apiKey.trim() === '') {
        throw new Error("Missing API Key: Please return to the Library screen and click the Settings (⚙️) gear to enter your Google Gemini API Key.");
    }

    const ai = new GoogleGenAI({ apiKey: settings.apiKey });

    const parts = [];
    
    // Add all images to the request
    base64Images.forEach(b64 => {
        parts.push({
            inlineData: {
                mimeType: "image/png",
                data: b64
            }
        });
    });

    parts.push({ text: SYSTEM_PROMPT });

    let response;
    let retries = 3;
    let delay = 1000;
    
    while (retries > 0) {
        try {
            response = await ai.models.generateContent({
              model: settings.model || "gemini-2.5-flash", // Dynamic model from settings
              contents: { parts },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  description: "List of analysis results corresponding to the input images",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      bubbles: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            text: { type: Type.STRING },
                            box_2d: {
                              type: Type.ARRAY,
                              items: { type: Type.INTEGER },
                              description: "The bounding box [ymin, xmin, ymax, xmax] of the bubble."
                            }
                          },
                          required: ["text", "box_2d"]
                        }
                      }
                    },
                    required: ["bubbles"]
                  }
                }
              }
            });
            break; // Success
        } catch (apiErr: any) {
            retries--;
            if (retries === 0 || apiErr?.status !== "UNAVAILABLE") {
                throw apiErr;
            }
            console.warn(`API 503 Error. Retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2; // Exponential backoff
        }
    }

    if (!response) {
       throw new Error("Failed to get response after retries");
    }

    const text = response.text;
    if (!text) return base64Images.map(() => []);
    
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        // Map the response to ensure we return just the bubble arrays
        return parsed.map((pageResult: any) => pageResult.bubbles || []);
      }
      return base64Images.map(() => []);
    } catch (e) {
      console.error("Failed to parse JSON response", e);
      return base64Images.map(() => []);
    }

  } catch (error: any) {
    console.error("OCR Batch Error:", error);
    // Rethrow explicit config errors so the Reader can catch and display them
    if (error.message && error.message.includes("Missing API Key")) {
        throw error;
    }
    return base64Images.map(() => []);
  }
};

export const blobUrlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString();
      if (result) {
        // Remove "data:image/xxx;base64," prefix
        resolve(result.split(',')[1]); 
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};