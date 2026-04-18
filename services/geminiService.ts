
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { BananaModel, AspectRatio, ImageResolution } from "../types";

// Helper to ensure API Key is ready, especially for Pro models
const getClient = async (model: BananaModel): Promise<GoogleGenAI> => {
  if (model === BananaModel.NANO_BANANA_PRO || model === BananaModel.NANO_BANANA_2) {
    if (window.aistudio) {
      // Check for API key selection for Pro and 3.1 models
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    }
  }
  
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const extractImagesFromResponse = (response: any): string[] => {
  const images: string[] = [];
  
  if (!response.candidates || response.candidates.length === 0) {
    return images;
  }

  for (const candidate of response.candidates) {
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const base64 = part.inlineData.data;
          images.push(`data:${mimeType};base64,${base64}`);
        }
      }
    }
  }
  return images;
};

interface EditImageParams {
  model: BananaModel;
  imageBase64: string; 
  maskBase64?: string; 
  prompt: string;
  aspectRatio: AspectRatio;
  quality?: ImageResolution;
}

export const editImageWithGemini = async ({
  model,
  imageBase64,
  maskBase64,
  prompt,
  aspectRatio,
  quality = ImageResolution.RES_1K
}: EditImageParams): Promise<string[]> => {
  try {
    const ai = await getClient(model);
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    
    const parts: any[] = [
      {
        inlineData: {
          data: cleanImage,
          mimeType: "image/png",
        },
      }
    ];

    let finalPrompt = prompt;
    if (!finalPrompt || finalPrompt.trim() === "") {
        finalPrompt = "Edit the image based on the provided context.";
    }

    if (maskBase64) {
      const cleanMask = maskBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          data: cleanMask,
          mimeType: "image/png",
        }
      });
      finalPrompt = `${finalPrompt} (System Note: The second image is a red mask. Only change the pixels covered by the mask. Keep the rest of the image identical.)`;
    } else {
      finalPrompt = `${finalPrompt} Output high quality, photorealistic image.`;
    }

    parts.push({ text: finalPrompt });

    const imageConfig: any = { numberOfImages: 1 };
    if (aspectRatio !== AspectRatio.ORIGINAL) {
       imageConfig.aspectRatio = aspectRatio;
    }

    if (model === BananaModel.NANO_BANANA_PRO || model === BananaModel.NANO_BANANA_2) {
       imageConfig.imageSize = (quality === ImageResolution.RES_4K && model === BananaModel.NANO_BANANA_PRO) ? ImageResolution.RES_2K : quality;
    }

    const config: any = {
      imageConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    };

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: config
    });

    return extractImagesFromResponse(response);
  } catch (error: any) {
    console.error("Edit Image Error:", error);
    throw new Error(error.message || "图像编辑请求失败。");
  }
};

interface RecreateImageParams {
  model: BananaModel;
  referenceImageBase64?: string; // 改为可选
  characterImageBase64?: string;
  prompt: string;
  textContent?: string;
  textLayout?: string;
  aspectRatio: AspectRatio;
  numberOfImages: number;
  quality: ImageResolution;
}

export const recreateImageWithGemini = async ({
  model,
  referenceImageBase64,
  characterImageBase64,
  prompt,
  textContent,
  textLayout,
  aspectRatio,
  numberOfImages,
  quality
}: RecreateImageParams): Promise<string[]> => {
  try {
    const ai = await getClient(model);
    const parts: any[] = [];
    let instructions = "";

    if (referenceImageBase64) {
      const cleanRef = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ inlineData: { data: cleanRef, mimeType: "image/png" } });
      instructions += "Follow the composition and style of the reference image. ";
    }

    if (characterImageBase64) {
      const cleanChar = characterImageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ inlineData: { data: cleanChar, mimeType: "image/png" } });
      instructions += "The image provided contains a person's face. You MUST strictly use this person's facial identity and features for the main character in the output. ";
    }

    let fullPrompt = `${instructions}\nCore Description: ${prompt || "Generate a creative high-quality image."}`;
    
    if (textContent) {
        fullPrompt += `\nInclude text content: "${textContent}".`;
    }
    if (textLayout) {
        fullPrompt += `\nText layout instructions: ${textLayout}`;
    }

    parts.push({ text: fullPrompt });

    const imageConfig: any = { numberOfImages: 1 };
    if (aspectRatio !== AspectRatio.ORIGINAL) {
       imageConfig.aspectRatio = aspectRatio;
    }
    if (model === BananaModel.NANO_BANANA_PRO || model === BananaModel.NANO_BANANA_2) {
      imageConfig.imageSize = quality;
    }

    const config: any = {
      imageConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    };
    
    const promises = Array.from({ length: numberOfImages }).map(() => 
      ai.models.generateContent({
        model: model,
        contents: { parts },
        config: config
      })
    );

    const responses = await Promise.all(promises);
    let allImages: string[] = [];
    responses.forEach(res => {
      allImages = [...allImages, ...extractImagesFromResponse(res)];
    });

    if (allImages.length === 0) {
      throw new Error("模型未返回图像，请检查提示词是否违规。");
    }

    return allImages;
  } catch (error: any) {
    console.error("Recreate Image Error:", error);
    throw new Error(error.message || "重塑创作请求失败。");
  }
};
