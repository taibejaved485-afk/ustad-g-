import { GoogleGenAI } from "@google/genai";
import { Subject, Source, ImageStyle } from "../types";

// Initialize the client
// API Key is injected via process.env.API_KEY as per instructions
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = (subject: string) => `
You are "Ustaad AI", a friendly, patient, and highly intelligent academic tutor for students.
The student has selected the subject: ${subject}.

Your Goal:
1. Explain concepts in the SIMPLEST way possible. Imagine you are teaching a beginner.
2. Use examples from daily life to make it "easy to understand" (jo asani se samajh aa jaye).
3. If the user asks in Urdu or Roman Urdu, reply in the same language or a mix (English/Urdu) to ensure they understand.
4. Structure your answer with clear headings, bullet points, and short paragraphs.
5. Be encouraging and polite.

Refusal Policy:
If the user asks something completely unrelated to education or the subject, gently remind them that you are here to help with their studies.
`;

export interface GenerateResponseResult {
  text: string;
  sources: Source[];
}

export const generateTutorResponse = async (
  prompt: string,
  history: { role: string; text: string }[],
  subject: Subject
): Promise<GenerateResponseResult> => {
  
  try {
    // We use gemini-2.5-flash for speed and efficiency, with Google Search enabled
    const modelId = 'gemini-2.5-flash';

    const conversationContext = history.map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n');
    
    const finalPrompt = `
    ${conversationContext}
    Student: ${prompt}
    
    (Please provide a clear, simple explanation with references if needed.)
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: finalPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION(subject),
        temperature: 0.7,
        tools: [{ googleSearch: {} }], 
      },
    });

    const text = response.text || "Sorry, I couldn't generate an answer. Please try again.";
    
    // Extract grounding chunks (references)
    const sources: Source[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Reference Link",
            uri: chunk.web.uri,
          });
        }
      });
    }

    return { text, sources };

  } catch (error) {
    console.error("Gemini API Error (Text):", error);
    throw new Error("Failed to get response from Ustaad AI.");
  }
};

export const generateEducationalImage = async (
  userQuery: string, 
  subject: string,
  style: ImageStyle = 'Scientific'
): Promise<string | null> => {
  try {
    // Step 1: Optimize the prompt using a fast text model (Gemini 2.5 Flash)
    // This helps convert complex questions like "How does the heart pump blood?" into a clear visual subject "Human Heart Anatomy Cross-Section"
    const textModel = 'gemini-2.5-flash';
    
    const refinementPrompt = `
    You are an expert technical illustrator.
    The student asked: "${userQuery}" within the subject "${subject}".
    
    Task: Identify the SINGLE most important object, concept, or process to visualize.
    Output: A concise, descriptive English phrase (3-7 words) for a 3D scientific model.
    
    Examples:
    - Query: "Explain photosynthesis" -> Output: "Photosynthesis Process in Plant Leaf"
    - Query: "What is an atom?" -> Output: "Atom Structure with Electron Orbits"
    - Query: "Who is Newton?" -> Output: "Isaac Newton Portrait"
    
    Output ONLY the phrase.
    `;

    const refinementResponse = await ai.models.generateContent({
      model: textModel,
      contents: refinementPrompt,
    });
    
    const refinedTopic = refinementResponse.text?.trim() || userQuery;
    console.log(`[Image Generation] Raw: "${userQuery}" -> Refined: "${refinedTopic}"`);

    // Step 2: Generate the image using the refined prompt and selected style
    const imageModelId = 'gemini-2.5-flash-image';
    
    const stylePrompts: Record<string, string> = {
      'Scientific': 'like a scientific 3D model, clean white background, realistic textures, soft studio lighting',
      'Cartoon': 'fun 3D cartoon style, bright colors, exaggerated features, toy-like rendering, soft shadows',
      'Realistic': 'hyper-realistic photo quality, cinematic lighting, highly detailed textures, 8k resolution',
      'Blueprint': 'technical blueprint schematic, blue background with white lines, engineering diagram style',
      'Low Poly': 'low poly art style, geometric shapes, minimal details, vibrant colors'
    };

    const styleDescription = stylePrompts[style] || stylePrompts['Scientific'];

    const imagePrompt = `Create a high-quality, educational illustration of: ${refinedTopic}. 
    The style should be ${styleDescription}. Clear details for a student to understand.`;

    const response = await ai.models.generateContent({
      model: imageModelId,
      contents: {
        parts: [{ text: imagePrompt }],
      },
    });

    let imageUrl: string | null = null;
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64String = part.inlineData.data;
          // Determine mimeType, default to image/png if not provided
          const mimeType = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mimeType};base64,${base64String}`;
          break; // Found the image
        }
      }
    }

    return imageUrl;

  } catch (error) {
    console.error("Gemini API Error (Image):", error);
    return null; // Fail gracefully without crashing the chat
  }
};

// --- Audio / TTS Helpers ---

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const decodePCM = (
  base64Data: string,
  audioContext: AudioContext
): AudioBuffer => {
  const bytes = base64ToBytes(base64Data);
  const sampleRate = 24000; // Gemini TTS default
  const numChannels = 1; // Gemini TTS default
  
  const int16Data = new Int16Array(bytes.buffer);
  const frameCount = int16Data.length / numChannels;
  
  const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
  
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 to Float32 [-1.0, 1.0]
      channelData[i] = int16Data[i * numChannels + channel] / 32768.0;
    }
  }
  
  return buffer;
};

export const generateSpeechFromText = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    
    // Check parts for inline data
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      return part.inlineData.data;
    }
    return null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};