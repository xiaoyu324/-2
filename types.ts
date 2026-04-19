export enum BananaModel {
  NANO_BANANA = 'gemini-1.5-flash',       // 对应原来的 Nano Banana
  NANO_BANANA_2 = 'gemini-3.1-flash-image-preview',     // 对应 Banana 2
  NANO_BANANA_PRO = 'Gemini 3 Pro',     // 对应 Banana Pro
}

export enum AspectRatio {
  ORIGINAL = 'ORIGINAL',
  SQUARE = '1:1',
  PORTRAIT_3_4 = '3:4',
  LANDSCAPE_4_3 = '4:3',
  PORTRAIT_4_5 = '4:5',
  PORTRAIT_9_16 = '9:16',
  LANDSCAPE_16_9 = '16:9',
}

export enum ImageResolution {
  RES_1K = '1K',
  RES_2K = '2K',
  RES_4K = '4K',
}

export interface GeneratedImage {
  url: string;
  seed?: number;
}

export interface GenerationError {
  message: string;
  details?: string;
}

// Augment window for AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
