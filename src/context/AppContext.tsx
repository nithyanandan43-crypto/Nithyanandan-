import React, { createContext, useContext, useState, useEffect } from 'react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface GeneratedMedia {
  url: string;
  prompt: string;
  timestamp: number;
  type: 'image' | 'video';
  status: 'generating' | 'completed' | 'failed';
  operationId?: string;
}

interface AppContextType {
  hasApiKey: boolean;
  setHasApiKey: (val: boolean) => void;
  systemInstruction: string;
  setSystemInstruction: (val: string) => void;
  generatedMedia: GeneratedMedia[];
  setGeneratedMedia: React.Dispatch<React.SetStateAction<GeneratedMedia[]>>;
  isGeneratingImage: boolean;
  setIsGeneratingImage: (val: boolean) => void;
  isGeneratingVideo: boolean;
  setIsGeneratingVideo: (val: boolean) => void;
  error: string | null;
  setError: (val: string | null) => void;
  handleOpenSelectKey: () => Promise<void>;
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are a sophisticated, high-fidelity AI companion. 
Your goal is to provide a "perfect" conversational and creative experience.

CRITICAL DIRECTIVES:
1. REALISM: When generating images or videos, always aim for hyper-realistic, photorealistic quality. Use natural lighting, complex textures, and high-resolution details.
2. UNBIASED & DIVERSE: Ensure all generated content is unbiased and represents a wide diversity of people, cultures, and perspectives. Avoid stereotypes and aim for authentic, realistic portrayals.
3. MULTIMODAL AWARENESS: You can see through the camera and hear the user. Acknowledge what you see and hear naturally.
4. IMAGE/VIDEO GENERATION: You have tools to generate images (gemini-2.5-flash-image) and videos (veo-3.1-lite-generate-preview). When a user asks for a visual, use these tools.
5. CONVERSATION: Be engaging, intelligent, and helpful. Maintain context across both voice and text inputs.
6. SAFETY: Adhere to safety guidelines; do not attempt to generate sexually explicit content. Focus on high-quality artistic and realistic output.`;

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [generatedMedia, setGeneratedMedia] = useState<GeneratedMedia[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  return (
    <AppContext.Provider value={{
      hasApiKey, setHasApiKey,
      systemInstruction, setSystemInstruction,
      generatedMedia, setGeneratedMedia,
      isGeneratingImage, setIsGeneratingImage,
      isGeneratingVideo, setIsGeneratingVideo,
      error, setError,
      handleOpenSelectKey
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
