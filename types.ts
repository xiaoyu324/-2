
export enum BananaModel {
  NANO_BANANA = 'gemini-1.5-flash',
  NANO_BANANA_2 = 'gemini-1.5-flash',
  NANO_BANANA_PRO = 'gemini-1.5-pro',
}

export enum AspectRatio {
  ORIGINAL = 'ORIGINAL', // UI Helper, maps to closest ratio
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
