
import { BananaModel, AspectRatio, ImageResolution } from "../types";

// Vertex AI Config
const PROJECT_ID = 'project-b8424127-b223-442e-b23';
const LOCATION = 'us-central1';
const API_KEY = import.meta.env.VITE_API_KEY;

/**
 * 获取 Vertex AI REST API 地址
 */
const getEndpointUrl = (modelId: string) => {
  return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelId}:generateContent?key=${API_KEY}`;
};

/**
 * 从响应中提取生成的图像 (Base64)
 */
const extractImagesFromResponse = (data: any): string[] => {
  const images: string[] = [];
  
  if (!data.candidates || data.candidates.length === 0) {
    return images;
  }

  for (const candidate of data.candidates) {
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

/**
 * 执行 Fetch 请求
 */
const callVertexAI = async (model: BananaModel, parts: any[], generationConfig: any = {}) => {
  const url = getEndpointUrl(model);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: parts
        }
      ],
      generationConfig: {
        ...generationConfig
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
  }

  return response.json();
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

    // 映射原本 SDK 的 imageConfig 到 generationConfig
    const generationConfig: any = { candidateCount: 1 };
    
    const imageConfig: any = {};
    if (aspectRatio !== AspectRatio.ORIGINAL) {
       imageConfig.aspectRatio = aspectRatio;
    }

    if (model === BananaModel.NANO_BANANA_PRO || model === BananaModel.NANO_BANANA_2) {
       imageConfig.imageSize = (quality === ImageResolution.RES_4K && model === BananaModel.NANO_BANANA_PRO) ? ImageResolution.RES_2K : quality;
    }
    
    // 如果是生图专有参数，放入 imageConfig 子对象中
    if (Object.keys(imageConfig).length > 0) {
        generationConfig.imageConfig = imageConfig;
    }

    const response = await callVertexAI(model, parts, generationConfig);
    return extractImagesFromResponse(response);
    
  } catch (error: any) {
    console.error("Edit Image Error:", error);
    throw new Error(error.message || "图像编辑请求失败。");
  }
};

interface RecreateImageParams {
  model: BananaModel;
  referenceImageBase64?: string;
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

    const imageConfig: any = {};
    if (aspectRatio !== AspectRatio.ORIGINAL) {
       imageConfig.aspectRatio = aspectRatio;
    }
    imageConfig.imageSize = quality;

    const generationConfig: any = { 
        candidateCount: 1,
        imageConfig: imageConfig
    };

    // 并行请求以生成多张图
    const promises = Array.from({ length: numberOfImages }).map(() => 
      callVertexAI(model, parts, generationConfig)
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
