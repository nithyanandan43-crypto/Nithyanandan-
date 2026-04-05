import React from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, Sparkles, Key, RefreshCw, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const DEFAULT_SYSTEM_INSTRUCTION = "You are a helpful, friendly conversational AI. Keep your responses concise and natural. You can see the user if they enable their camera. You have the ability to generate images and realistic videos instantly if the user asks for them.";

export function Settings() {
  const { 
    systemInstruction, setSystemInstruction, 
    hasApiKey, handleOpenSelectKey,
    error, setError
  } = useApp();

  return (
    <div className="h-full flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-400 mt-2">Customize your AI experience and manage API keys.</p>
      </header>

      <div className="flex flex-col gap-8 pb-24 md:pb-8">
        {/* API Key Section */}
        <section className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Key className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">Video Generation API Key</h2>
          </div>
          
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Advanced video generation (Veo) requires a paid API key with billing enabled. 
            Standard Gemini Live features use the default environment key.
          </p>

          <div className="flex items-center gap-4">
            <div className={`flex-1 px-4 py-3 rounded-xl border flex items-center gap-3 ${hasApiKey ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>
              <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-zinc-700'}`} />
              <span className="text-sm font-medium">{hasApiKey ? 'Paid API Key Active' : 'No Paid API Key Selected'}</span>
            </div>
            <button
              onClick={handleOpenSelectKey}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {hasApiKey ? 'Change Key' : 'Select Key'}
            </button>
          </div>
          
          {error && error.includes("Permission Denied") && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </section>

        {/* AI Personality Section */}
        <section className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">AI Personality</h2>
          </div>

          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
            Define how the AI should behave, its tone of voice, and its core instructions.
          </p>

          <textarea
            value={systemInstruction}
            onChange={(e) => setSystemInstruction(e.target.value)}
            placeholder="Describe how the AI should behave..."
            className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-sans leading-relaxed text-sm"
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION)}
              className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all text-xs font-medium"
            >
              Reset to Default
            </button>
          </div>
        </section>

        {/* Info Section */}
        <section className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/10">
          <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2">About Gemini Live</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            This application uses Gemini 3.1 Flash Live for real-time multimodal interaction. 
            It supports voice, vision, and tool-use for image/video generation. 
            The AI avatar is powered by MediaPipe face tracking.
          </p>
        </section>
      </div>
    </div>
  );
}
