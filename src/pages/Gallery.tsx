import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageIcon, Film, Download, Trash2, Sparkles, RefreshCw, Info, AlertCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GoogleGenAI } from "@google/genai";

const RANDOM_PROMPTS = [
  "A futuristic city with floating gardens and neon waterfalls",
  "A majestic dragon made of stardust flying through a nebula",
  "A cozy library inside a giant hollowed-out oak tree",
  "A cyberpunk samurai standing in the rain, neon lights reflecting in puddles",
  "An underwater kingdom with bioluminescent coral and giant jellyfish",
  "A steampunk airship sailing through a sunset sky filled with floating islands",
  "A surreal landscape where mountains are made of giant crystals",
  "A tiny robot exploring a massive forest of mushrooms",
  "A celestial clockwork mechanism spanning the entire horizon",
  "A vibrant marketplace in a desert oasis with colorful silks and spices"
];

export function Gallery() {
  const { 
    generatedMedia, setGeneratedMedia, 
    setIsGeneratingImage, 
    hasApiKey, setHasApiKey, 
    handleOpenSelectKey,
    error, setError
  } = useApp();
  const [isSurprising, setIsSurprising] = useState(false);
  const [searchPrompt, setSearchPrompt] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const removeMedia = (timestamp: number) => {
    setGeneratedMedia(prev => prev.filter(m => m.timestamp !== timestamp));
  };

  const downloadMedia = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const surpriseMe = async () => {
    setIsSurprising(true);
    setIsGeneratingImage(true);
    const prompt = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    
    const tryGenerate = async (apiKey: string) => {
      const genAi = new GoogleGenAI({ apiKey });
      const response = await genAi.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ parts: [{ text: prompt }] }]
      });

      let imageUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
      return imageUrl;
    };

    const isQuotaError = (err: any) => {
      try {
        const errMsg = typeof err.message === 'string' ? err.message : JSON.stringify(err);
        if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) return true;
        if (err.status === 429 || err.code === 429) return true;
        if (err.error && (err.error.code === 429 || err.error.status === "RESOURCE_EXHAUSTED" || (typeof err.error.message === 'string' && err.error.message.includes("quota")))) return true;
        return false;
      } catch (e) {
        return false;
      }
    };

    try {
      const paidKey = process.env.API_KEY;
      const freeKey = process.env.GEMINI_API_KEY;
      
      let imageUrl = "";
      try {
        // Try paid key first if available
        imageUrl = await tryGenerate(paidKey || freeKey);
      } catch (err: any) {
        // If paid key fails with quota, try free key as fallback
        if (paidKey && isQuotaError(err)) {
          console.warn("Paid key quota exceeded, falling back to free key...");
          // Small delay before fallback
          await new Promise(resolve => setTimeout(resolve, 1000));
          imageUrl = await tryGenerate(freeKey);
        } else {
          throw err;
        }
      }

      if (imageUrl) {
        setGeneratedMedia(prev => [{
          url: imageUrl,
          prompt: prompt,
          timestamp: Date.now(),
          type: 'image',
          status: 'completed'
        }, ...prev]);
      }
    } catch (err: any) {
      console.error("Surprise generation failed:", err);
      if (isQuotaError(err)) {
        setError("Image generation quota exceeded. Please wait a moment or check your Gemini API plan.");
      } else {
        const errMsg = typeof err.message === 'string' ? err.message : JSON.stringify(err);
        setError(`Image generation failed: ${errMsg}`);
      }
    } finally {
      setIsSurprising(false);
      setIsGeneratingImage(false);
    }
  };

  const quickSearchAndGenerate = async () => {
    if (!searchPrompt.trim()) return;
    if (!hasApiKey) {
      await handleOpenSelectKey();
      return;
    }

    setIsSearching(true);
    setIsGeneratingImage(true);
    const prompt = searchPrompt;
    setSearchPrompt("");

    const tryGenerate = async (apiKey: string) => {
      const genAi = new GoogleGenAI({ apiKey });
      const response = await genAi.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          tools: [{ 
            googleSearch: { 
              searchTypes: { 
                webSearch: {}, 
                imageSearch: {} 
              } 
            } 
          }],
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      let imageUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
      return imageUrl;
    };

    const isQuotaError = (err: any) => {
      try {
        const errMsg = typeof err.message === 'string' ? err.message : JSON.stringify(err);
        if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) return true;
        if (err.status === 429 || err.code === 429) return true;
        if (err.error && (err.error.code === 429 || err.error.status === "RESOURCE_EXHAUSTED" || (typeof err.error.message === 'string' && err.error.message.includes("quota")))) return true;
        return false;
      } catch (e) {
        return false;
      }
    };

    try {
      const paidKey = process.env.API_KEY;
      const freeKey = process.env.GEMINI_API_KEY;
      
      let imageUrl = "";
      try {
        imageUrl = await tryGenerate(paidKey || freeKey);
      } catch (err: any) {
        if (paidKey && isQuotaError(err)) {
          console.warn("Paid key quota exceeded, falling back to free key...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          imageUrl = await tryGenerate(freeKey);
        } else {
          throw err;
        }
      }

      if (imageUrl) {
        setGeneratedMedia(prev => [{
          url: imageUrl,
          prompt: prompt,
          timestamp: Date.now(),
          type: 'image',
          status: 'completed'
        }, ...prev]);
      }
    } catch (err: any) {
      console.error("Quick search generation failed:", err);
      if (isQuotaError(err)) {
        setError("Generation quota exceeded. Please wait a moment or check your Gemini API plan.");
      } else {
        const errMsg = typeof err.message === 'string' ? err.message : JSON.stringify(err);
        if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("403")) {
          setError("Access denied. This feature requires a paid API key with Google Search enabled. Please click 'Enable Video Gen' to select a valid key.");
          setHasApiKey(false); // Reset to allow re-selection
        } else {
          setError("Failed to generate image. Please try again.");
        }
      }
    } finally {
      setIsSearching(false);
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-zinc-100">AI Gallery</h1>
          <p className="text-zinc-400 mt-2">Browse, search, and generate high-fidelity AI media.</p>
          
          <div className="mt-6 relative max-w-2xl">
            <input
              type="text"
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && quickSearchAndGenerate()}
              placeholder="Search web & generate realistic image..."
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-6 pr-32 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            <button
              onClick={quickSearchAndGenerate}
              disabled={isSearching || !searchPrompt.trim()}
              className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate
            </button>
          </div>
        </div>
        <button
          onClick={surpriseMe}
          disabled={isSurprising}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full font-bold transition-all border border-zinc-700 disabled:opacity-50 group"
        >
          {isSurprising ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          )}
          Surprise Me
        </button>
      </header>

      <div className="space-y-12">
        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-blue-500 rounded-full" />
            <h2 className="text-xl font-bold text-zinc-200">Your Creations</h2>
          </div>

          {generatedMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-zinc-500" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-300">No media yet</h2>
              <p className="text-zinc-500 max-w-xs mt-2">Click "Surprise Me" or start a live session to generate something amazing!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {generatedMedia.map((media) => (
                  <motion.div
                    key={media.timestamp}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-video rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-xl"
                  >
                    {media.status === 'generating' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900/50 backdrop-blur-sm">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Generating...</span>
                      </div>
                    ) : media.status === 'failed' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-900/20 backdrop-blur-sm">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </div>
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Failed</span>
                      </div>
                    ) : (
                      <>
                        {media.type === 'image' ? (
                          <img 
                            src={media.url} 
                            alt={media.prompt} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <video 
                            src={media.url} 
                            controls 
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Overlay Info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                          <p className="text-xs text-zinc-200 line-clamp-2 mb-3 font-medium">{media.prompt}</p>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => downloadMedia(media.url, `${media.type}-${media.timestamp}.${media.type === 'image' ? 'png' : 'mp4'}`)}
                              className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </button>
                            <button 
                              onClick={() => removeMedia(media.timestamp)}
                              className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Type Badge */}
                        <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-md flex items-center gap-1.5">
                          {media.type === 'image' ? <ImageIcon className="w-3 h-3 text-blue-400" /> : <Film className="w-3 h-3 text-purple-400" />}
                          <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider">{media.type}</span>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <section className="pb-24">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-purple-500 rounded-full" />
            <h2 className="text-xl font-bold text-zinc-200">Random Inspiration</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-lg">
                <img 
                  src={`https://picsum.photos/seed/ai-art-${i}/500/500`} 
                  alt="Random inspiration" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <button 
                    onClick={() => downloadMedia(`https://picsum.photos/seed/ai-art-${i}/1080/1080`, `inspiration-${i}.jpg`)}
                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all transform translate-y-4 group-hover:translate-y-0"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-500 leading-relaxed">
              These images are provided for inspiration. You can use them as a starting point for your own prompts in the live session!
            </p>
          </div>
        </section>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm z-[100] shadow-2xl backdrop-blur-md"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
