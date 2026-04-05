import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Sparkles, Loader2, AlertCircle, X, User, Key, RefreshCw, Download, ImageIcon, Film } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";
import { AudioRecorder, AudioStreamer } from '../lib/audio-utils';
import { Avatar } from '../components/Avatar';
import { useFaceLandmarker } from '../hooks/useFaceLandmarker';
import { useApp } from '../context/AppContext';

const MODEL_NAME = "gemini-3.1-flash-live-preview";
const IMAGE_GEN_MODEL = "gemini-2.5-flash-image";
const VIDEO_GEN_MODEL = "veo-3.1-lite-generate-preview";

export function LiveSession() {
  const { 
    hasApiKey, setHasApiKey, 
    systemInstruction, 
    setGeneratedMedia, 
    setIsGeneratingImage, 
    setIsGeneratingVideo,
    error, setError,
    handleOpenSelectKey
  } = useApp();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [volume, setVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [lastCapturedFrame, setLastCapturedFrame] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{uri: string, title: string}[]>([]);
  const [isAvatarMode, setIsAvatarMode] = useState(true);
  const [chatMessages, setChatMessages] = useState<{
    role: 'user' | 'model';
    text?: string;
    image?: string;
    video?: string;
    isVoice?: boolean;
  }[]>([]);
  const [textInput, setTextInput] = useState("");
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const faceData = useFaceLandmarker(videoElement);

  useEffect(() => {
    if (videoRef.current) {
      setVideoElement(videoRef.current);
    }
  }, [isConnected, isVideoEnabled]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, transcription]);

  const downloadMedia = async (url: string, filename: string) => {
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
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
      console.error("Download failed:", err);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setSearchResults([]);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const generateImageTool = {
        name: "generateImage",
        description: "Generates a high-quality image based on a text prompt. Use this whenever the user asks to see an image, create a picture, or visualize something.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: {
              type: Type.STRING,
              description: "A detailed, descriptive prompt for the image generation."
            }
          },
          required: ["prompt"]
        }
      };

      const generateVideoTool = {
        name: "generateVideo",
        description: "Generates a realistic video based on a text prompt. Use this whenever the user asks to see a video, create a movie clip, or visualize motion.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: {
              type: Type.STRING,
              description: "A detailed, descriptive prompt for the video generation."
            }
          },
          required: ["prompt"]
        }
      };

      streamerRef.current = new AudioStreamer(24000, (v) => {
        setAiVolume(Math.min(1, v * 5));
      });
      await streamerRef.current.start();

      const session = await ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [
            { googleSearch: {} },
            { functionDeclarations: [generateImageTool, generateVideoTool] }
          ],
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            startRecording();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  streamerRef.current?.addChunk(part.inlineData.data);
                }
              }
            }

            // Handle tool calls
            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                if (call.name === "generateImage") {
                  const { prompt } = call.args as any;
                  setIsGeneratingImage(true);
                  const tryGenerate = async (apiKey: string) => {
                    const genAi = new GoogleGenAI({ apiKey });
                    const response = await genAi.models.generateContent({
                      model: IMAGE_GEN_MODEL,
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
                      setChatMessages(prev => [...prev, { role: 'model', image: imageUrl, text: `Generated image for: "${prompt}"` }]);
                    }

                    sessionRef.current?.sendToolResponse({
                      functionResponses: [{
                        name: "generateImage",
                        id: call.id,
                        response: { success: true, message: "Image generated successfully and displayed to the user." }
                      }]
                    });
                  } catch (err: any) {
                    console.error("Image generation failed:", err);
                    if (isQuotaError(err)) {
                      setError("Image generation quota exceeded. Please wait a moment.");
                    } else {
                      const errMsg = typeof err.message === 'string' ? err.message : JSON.stringify(err);
                      setError(`Image generation failed: ${errMsg}`);
                    }
                    sessionRef.current?.sendToolResponse({
                      functionResponses: [{
                        name: "generateImage",
                        id: call.id,
                        response: { success: false, error: `Failed to generate image: ${err.message || "Quota exceeded"}` }
                      }]
                    });
                  } finally {
                    setIsGeneratingImage(false);
                  }
                } else if (call.name === "generateVideo") {
                  const { prompt } = call.args as any;
                  const videoApiKey = process.env.API_KEY;
                  
                  if (!videoApiKey) {
                    setHasApiKey(false);
                    setError("Video generation requires a paid API key. Please click 'Enable Video Gen' to select one.");
                    sessionRef.current?.sendToolResponse({
                      functionResponses: [{
                        name: "generateVideo",
                        id: call.id,
                        response: { success: false, error: "API Key not selected. User has been prompted to select one." }
                      }]
                    });
                    return;
                  }

                  setIsGeneratingVideo(true);
                  const timestamp = Date.now();
                  
                  setGeneratedMedia(prev => [{
                    url: "",
                    prompt: prompt,
                    timestamp: timestamp,
                    type: 'video',
                    status: 'generating'
                  }, ...prev]);

                  try {
                    const genAi = new GoogleGenAI({ apiKey: videoApiKey });
                    let operation = await genAi.models.generateVideos({
                      model: VIDEO_GEN_MODEL,
                      prompt: prompt,
                      config: {
                        numberOfVideos: 1,
                        resolution: '720p',
                        aspectRatio: '16:9'
                      }
                    });

                    const pollVideo = async () => {
                      try {
                        while (!operation.done) {
                          await new Promise(resolve => setTimeout(resolve, 10000));
                          operation = await genAi.operations.getVideosOperation({ operation: operation });
                        }

                        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                        if (downloadLink) {
                          const videoResponse = await fetch(downloadLink, {
                            method: 'GET',
                            headers: { 'x-goog-api-key': videoApiKey },
                          });
                          
                          if (!videoResponse.ok) {
                            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
                          }

                          const blob = await videoResponse.blob();
                          const videoUrl = URL.createObjectURL(blob);

                          setGeneratedMedia(prev => prev.map(m => 
                            m.timestamp === timestamp ? { ...m, url: videoUrl, status: 'completed' } : m
                          ));
                          setChatMessages(prev => [...prev, { role: 'model', video: videoUrl, text: `Generated video for: "${prompt}"` }]);
                        }
                      } catch (err: any) {
                        console.error("Video polling failed:", err);
                        setGeneratedMedia(prev => prev.map(m => 
                          m.timestamp === timestamp ? { ...m, status: 'failed' } : m
                        ));
                      } finally {
                        setIsGeneratingVideo(false);
                      }
                    };

                    pollVideo();

                    sessionRef.current?.sendToolResponse({
                      functionResponses: [{
                        name: "generateVideo",
                        id: call.id,
                        response: { success: true, message: "Video generation started. It will appear in the gallery shortly." }
                      }]
                    });
                  } catch (err: any) {
                    console.error("Video generation failed:", err);
                    setGeneratedMedia(prev => prev.map(m => 
                      m.timestamp === timestamp ? { ...m, status: 'failed' } : m
                    ));
                    setIsGeneratingVideo(false);
                    sessionRef.current?.sendToolResponse({
                      functionResponses: [{
                        name: "generateVideo",
                        id: call.id,
                        response: { success: false, error: `Failed to start video generation: ${err.message}` }
                      }]
                    });
                  }
                }
              }
            }

            // Handle Grounding
            const groundingMetadata = (message.serverContent?.modelTurn as any)?.groundingMetadata;
            if (groundingMetadata?.groundingChunks) {
              const newResults = groundingMetadata.groundingChunks
                .filter((chunk: any) => chunk.web)
                .map((chunk: any) => ({
                  uri: chunk.web.uri,
                  title: chunk.web.title
                }));
              
              if (newResults.length > 0) {
                setSearchResults(prev => {
                  const existingUris = new Set(prev.map(r => r.uri));
                  const filteredNew = newResults.filter((r: any) => !existingUris.has(r.uri));
                  return [...prev, ...filteredNew];
                });
              }
            }

            // Handle User Transcription (Voice to Text)
            const userTranscript = (message.serverContent as any)?.userContent?.parts?.find((p: any) => p.text)?.text;
            if (userTranscript) {
              setChatMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'user' && (lastMsg as any).isVoice) {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...lastMsg, text: lastMsg.text + " " + userTranscript };
                  return updated;
                }
                return [...prev, { role: 'user', text: userTranscript, isVoice: true }];
              });
            }

            // Handle Model Transcription/Text
            const modelParts = message.serverContent?.modelTurn?.parts;
            if (modelParts) {
              const textPart = modelParts.find(p => p.text)?.text;
              if (textPart) {
                setTranscription(prev => prev + " " + textPart);
                setChatMessages(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === 'model') {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...lastMsg, text: lastMsg.text + " " + textPart };
                    return updated;
                  }
                  return [...prev, { role: 'model', text: textPart }];
                });
              }
            }

            // Reset transcription on turn complete or interrupted
            if (message.serverContent?.turnComplete || message.serverContent?.interrupted) {
              setTranscription("");
            }
          },
          onclose: () => {
            stopSession();
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            const errMsg = err.message || String(err);
            if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
              setError("Quota exceeded. Please check your Gemini API plan or wait a moment.");
            } else if (errMsg.includes("Network error") || errMsg.includes("Failed to fetch")) {
              setError("Network connection lost. Please check your internet and try again.");
            } else {
              setError("Connection error. Please try again.");
            }
            stopSession();
          }
        }
      });

      sessionRef.current = session;
    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Failed to initialize Gemini Live. Check your API key.");
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    setIsConnected(false);
    setIsConnecting(false);
    setLastCapturedFrame(null);
    recorderRef.current?.stop();
    streamerRef.current?.stop();
    sessionRef.current?.close();
    sessionRef.current = null;
    
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startRecording = () => {
    recorderRef.current = new AudioRecorder(
      (base64Data) => {
        if (sessionRef.current && !isMuted) {
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      },
      (rmsVolume) => {
        if (!isMuted) {
          const normalized = Math.min(1, rmsVolume * 5);
          setVolume(normalized);
        } else {
          setVolume(0);
        }
      }
    );
    recorderRef.current.start().catch(err => {
      console.error("Mic access failed:", err);
      setError("Microphone access denied.");
    });
  };

  const sendMessage = () => {
    if (!textInput.trim() || !sessionRef.current) return;
    
    const text = textInput.trim();
    sessionRef.current.sendRealtimeInput({
      text: text
    });
    
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setTextInput("");
  };

  const toggleVideo = async () => {
    if (!isVideoEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsVideoEnabled(true);
          
          videoIntervalRef.current = window.setInterval(() => {
            if (sessionRef.current && canvasRef.current && videoRef.current) {
              const context = canvasRef.current.getContext('2d');
              if (context) {
                context.drawImage(videoRef.current, 0, 0, 320, 240);
                const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
                const base64Data = dataUrl.split(',')[1];
                setLastCapturedFrame(dataUrl);
                sessionRef.current.sendRealtimeInput({
                  video: { data: base64Data, mimeType: 'image/jpeg' }
                });
              }
            }
          }, 1000);
        }
      } catch (err) {
        console.error("Camera access failed:", err);
        setError("Camera access denied.");
      }
    } else {
      stopVideo();
    }
  };

  const stopVideo = () => {
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsVideoEnabled(false);
    setLastCapturedFrame(null);
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (isVideoEnabled) {
      stopVideo();
      // Small delay to ensure tracks are fully stopped
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: newMode } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setIsVideoEnabled(true);
            // Re-start interval
            videoIntervalRef.current = window.setInterval(() => {
              if (sessionRef.current && canvasRef.current && videoRef.current) {
                const context = canvasRef.current.getContext('2d');
                if (context) {
                  context.drawImage(videoRef.current, 0, 0, 320, 240);
                  const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
                  const base64Data = dataUrl.split(',')[1];
                  setLastCapturedFrame(dataUrl);
                  sessionRef.current.sendRealtimeInput({
                    video: { data: base64Data, mimeType: 'image/jpeg' }
                  });
                }
              }
            }, 1000);
          }
        } catch (err) {
          console.error("Camera switch failed:", err);
          setError("Failed to switch camera.");
        }
      }, 100);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full overflow-hidden">
        {/* Left Side: Video/Avatar */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          <header className="text-center lg:text-left space-y-2">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center lg:justify-start gap-2 text-blue-400 font-display font-semibold tracking-wider uppercase text-xs md:text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Gemini 3.1 Live
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl md:text-4xl font-display font-bold tracking-tight text-zinc-100"
            >
              Real-time Interactor
            </motion.h1>
            
            <div className="flex items-center justify-center lg:justify-start gap-3 mt-4">
              {!hasApiKey && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleOpenSelectKey}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white transition-all font-semibold text-xs"
                >
                  <Key className="w-4 h-4" />
                  Enable Video Gen
                </motion.button>
              )}
              {isConnected && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={stopSession}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white transition-all font-semibold text-xs"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Session
                </motion.button>
              )}
            </div>
          </header>

          <div className="flex-1 min-h-[300px] relative rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl">
            <canvas ref={canvasRef} width="320" height="240" className="hidden" />
            
            <AnimatePresence mode="wait">
              {!isConnected && !isConnecting ? (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <MessageSquare className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl md:text-2xl font-display font-semibold">Ready to chat?</h2>
                    <p className="text-zinc-400 max-w-md text-sm md:text-base">Experience low-latency, natural voice conversations with Gemini's latest multimodal model.</p>
                  </div>
                  <button
                    onClick={startSession}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20"
                  >
                    Start Conversation
                  </button>
                </motion.div>
              ) : isConnecting ? (
                <motion.div 
                  key="connecting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-6"
                >
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-blue-500 animate-spin" />
                    <p className="text-zinc-400 font-medium animate-pulse text-sm md:text-base">Establishing secure connection...</p>
                  </div>
                  <button
                    onClick={stopSession}
                    className="px-6 py-2 rounded-full border border-zinc-800 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all text-xs md:text-sm font-medium"
                  >
                    Cancel
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="active"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col"
                >
                  <div className="flex-1 relative bg-black group">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover transition-opacity duration-500 ${isVideoEnabled && !isAvatarMode ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
                    />
                    
                    {isAvatarMode && (
                      <div className="absolute inset-0">
                        <Avatar 
                          faceData={faceData} 
                          isSpeaking={aiVolume > 0.05} 
                          volume={aiVolume} 
                        />
                      </div>
                    )}
                    
                    {lastCapturedFrame && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute top-4 left-4 z-50 flex flex-col gap-2"
                      >
                        <div className="w-24 md:w-32 aspect-video rounded-xl overflow-hidden border border-zinc-700/50 shadow-2xl bg-zinc-950">
                          <img 
                            src={lastCapturedFrame} 
                            alt="Last sent frame" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </motion.div>
                    )}

                    {!isVideoEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                          <motion.div 
                            animate={{ 
                              scale: [1, 1.2, 1],
                              opacity: [0.3, 0.6, 0.3]
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 bg-blue-500 rounded-full blur-2xl"
                          />
                          <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                            <div className="flex gap-1 items-end h-6 md:h-8">
                              {[...Array(5)].map((_, i) => (
                                <motion.div
                                  key={i}
                                  animate={{ height: [6, 24, 6] }}
                                  transition={{ 
                                    duration: 0.8, 
                                    repeat: Infinity, 
                                    delay: i * 0.1,
                                    ease: "easeInOut"
                                  }}
                                  className="w-1 md:w-1.5 bg-blue-500 rounded-full"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-50 w-full px-4">
                      {!isMuted && isConnected && (
                        <div className="flex items-end gap-1 h-6 md:h-8 mb-2">
                          {[...Array(12)].map((_, i) => (
                            <motion.div
                              key={i}
                              animate={{ 
                                height: `${Math.max(4, volume * (30 + Math.random() * 30))}px`,
                                opacity: volume > 0.01 ? 1 : 0.3
                              }}
                              transition={{ 
                                type: "spring", 
                                stiffness: 300, 
                                damping: 20,
                                delay: i * 0.02
                              }}
                              className="w-1 bg-blue-500 rounded-full"
                            />
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 md:gap-4 px-4 md:px-6 py-2 md:py-3 bg-zinc-900/80 backdrop-blur-md rounded-full border border-zinc-700/50 shadow-xl">
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className={`p-2 md:p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-500' : 'hover:bg-zinc-800 text-zinc-300'}`}
                        >
                          {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={toggleVideo}
                            className={`p-2 md:p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-blue-500/20 text-blue-500' : 'hover:bg-zinc-800 text-zinc-300'}`}
                          >
                            {isVideoEnabled ? <Video className="w-5 h-5 md:w-6 md:h-6" /> : <VideoOff className="w-5 h-5 md:w-6 md:h-6" />}
                          </button>
                          {isVideoEnabled && (
                            <button
                              onClick={switchCamera}
                              className="p-2 md:p-3 rounded-full hover:bg-zinc-800 text-zinc-300 transition-colors"
                              title="Switch Camera"
                            >
                              <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setIsAvatarMode(!isAvatarMode)}
                          className={`p-2 md:p-3 rounded-full transition-colors ${isAvatarMode ? 'bg-purple-500/20 text-purple-500' : 'hover:bg-zinc-800 text-zinc-300'}`}
                        >
                          {isAvatarMode ? <User className="w-5 h-5 md:w-6 md:h-6" /> : <Sparkles className="w-5 h-5 md:w-6 md:h-6" />}
                        </button>
                        <div className="w-px h-6 bg-zinc-700 mx-1 md:mx-2" />
                        <button
                          onClick={stopSession}
                          className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-3 rounded-full bg-red-600 hover:bg-red-500 text-white transition-all font-semibold text-sm"
                        >
                          <PhoneOff className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden xs:inline">End</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Chat */}
        <div className="w-full lg:w-96 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-zinc-100">Live Chat</h2>
          </div>
          
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800"
          >
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                <MessageSquare className="w-12 h-12 mb-4 text-zinc-700" />
                <p className="text-sm text-zinc-500">No messages yet. Start talking or type below!</p>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] overflow-hidden rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                  }`}>
                    {msg.image && (
                      <div className="relative group/img">
                        <img 
                          src={msg.image} 
                          alt="Generated" 
                          className="w-full aspect-video object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          onClick={() => downloadMedia(msg.image!, `generated-${Date.now()}.png`)}
                          className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                          title="Download Image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {msg.video && (
                      <div className="relative group/vid">
                        <video 
                          src={msg.video} 
                          controls 
                          className="w-full aspect-video object-cover"
                        />
                        <button 
                          onClick={() => downloadMedia(msg.video!, `generated-${Date.now()}.mp4`)}
                          className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white opacity-0 group-hover/vid:opacity-100 transition-opacity z-10"
                          title="Download Video"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {msg.text && (
                      <div className="px-4 py-2">
                        {msg.text}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
            {transcription && (
              <div className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Live Transcription</p>
                <p className="text-xs text-zinc-400 italic">{transcription}</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-900/80 border-t border-zinc-800">
            <div className="relative flex items-center">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isConnected ? "Type a message..." : "Connect to chat"}
                disabled={!isConnected}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-full py-3 pl-4 pr-12 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!isConnected || !textInput.trim()}
                className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white rounded-full transition-all"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
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
