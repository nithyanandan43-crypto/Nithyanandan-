import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, AlertCircle, CheckCircle2, BarChart3, RefreshCw, FileText, X, Copy, Check } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { useApp } from '../context/AppContext';

interface SeoAnalysis {
  score: number;
  issues: string[];
  suggestions: string[];
  optimizedTitle?: string;
  optimizedMeta?: string;
}

function ProcessStep({ label, active, delay = 0 }: { label: string, active: boolean, delay?: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3"
    >
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-zinc-800'}`} />
      <span className={`text-xs font-medium ${active ? 'text-zinc-200' : 'text-zinc-600'}`}>{label}</span>
    </motion.div>
  );
}

export function SeoOptimizer() {
  const { setError } = useApp();
  const [content, setContent] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SeoAnalysis | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const performAnalysis = async () => {
    if (!content.trim()) return;
    
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const genAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await genAi.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ 
          parts: [{ 
            text: `You are an SEO expert. Analyze the following blog post and optimize it based on this checklist:
            1. Title: 50-60 characters, primary keyword near the start
            2. Meta description: 150-160 characters with a call-to-action
            3. Headings: Proper H2/H3 hierarchy, keywords in 2-3 headings
            4. First paragraph: Primary keyword within first 100 words
            5. Images: Alt text with keywords, descriptive names

            Blog Post Content:
            ${content}

            Return the analysis in JSON format with the following structure:
            {
              "score": number (0-100),
              "issues": string[],
              "suggestions": string[],
              "optimizedTitle": string,
              "optimizedMeta": string
            }`
          }] 
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              issues: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              optimizedTitle: { type: Type.STRING },
              optimizedMeta: { type: Type.STRING }
            },
            required: ["score", "issues", "suggestions"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      setAnalysis(result);
    } catch (err: any) {
      console.error("SEO Analysis failed:", err);
      setError("Failed to analyze content. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full overflow-y-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-blue-400 font-display font-semibold tracking-wider uppercase text-xs mb-2">
          <Search className="w-4 h-4" />
          SEO Expert Mode
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-zinc-100">SEO Optimizer</h1>
        <p className="text-zinc-400 mt-2">Audit your blog posts and get AI-powered optimization suggestions.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Input Section */}
        <section className="space-y-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
                  <FileText className="w-4 h-4" />
                  Blog Content
                </div>
                <button 
                  onClick={() => setContent("")}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your blog post title and content here..."
                className="w-full h-[400px] bg-transparent p-6 text-zinc-200 focus:outline-none resize-none font-sans leading-relaxed text-sm"
              />
            </div>
          </div>
          
          <button
            onClick={performAnalysis}
            disabled={isAnalyzing || !content.trim()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Analyzing Content...
              </>
            ) : (
              <>
                <BarChart3 className="w-5 h-5" />
                Run SEO Audit
              </>
            )}
          </button>
        </section>

        {/* Results Section */}
        <section className="space-y-6">
          <AnimatePresence mode="wait">
            {!analysis && !isAnalyzing ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-[500px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20"
              >
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-zinc-500" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-300">No Analysis Yet</h2>
                <p className="text-zinc-500 max-w-xs mt-2">Paste your content and click "Run SEO Audit" to see the results.</p>
              </motion.div>
            ) : isAnalyzing ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-[500px] flex flex-col items-center justify-center gap-8"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Search className="w-8 h-8 text-blue-400 animate-pulse" />
                  </div>
                </div>
                
                <div className="space-y-4 w-full max-w-xs">
                  <ProcessStep label="Reading Blog Content" active={true} />
                  <ProcessStep label="Applying SEO Expert Prompt" active={true} delay={1} />
                  <ProcessStep label="Consulting Gemini API" active={true} delay={2} />
                  <ProcessStep label="Structuring Analysis Output" active={true} delay={3} />
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Score Card */}
                <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <BarChart3 className="w-32 h-32 text-blue-500" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-4">Overall SEO Score</h3>
                    <div className="flex items-end gap-2">
                      <span className={`text-6xl font-display font-bold ${
                        analysis.score >= 80 ? 'text-green-400' : analysis.score >= 60 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {analysis.score}
                      </span>
                      <span className="text-zinc-600 text-2xl font-bold mb-2">/100</span>
                    </div>
                  </div>
                </div>

                {/* AI Recommendations */}
                {(analysis.optimizedTitle || analysis.optimizedMeta) && (
                  <div className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/10 space-y-4">
                    <h3 className="text-blue-400 font-bold text-sm uppercase tracking-widest">AI Optimized Snippets</h3>
                    {analysis.optimizedTitle && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase">Recommended Title</p>
                          <button 
                            onClick={() => copyToClipboard(analysis.optimizedTitle!, 'title')}
                            className="text-zinc-500 hover:text-blue-400 transition-colors flex items-center gap-1 text-[10px] font-bold"
                          >
                            {copiedField === 'title' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedField === 'title' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-sm text-zinc-200 bg-zinc-950 p-3 rounded-xl border border-zinc-800">{analysis.optimizedTitle}</p>
                      </div>
                    )}
                    {analysis.optimizedMeta && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase">Recommended Meta Description</p>
                          <button 
                            onClick={() => copyToClipboard(analysis.optimizedMeta!, 'meta')}
                            className="text-zinc-500 hover:text-blue-400 transition-colors flex items-center gap-1 text-[10px] font-bold"
                          >
                            {copiedField === 'meta' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedField === 'meta' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-sm text-zinc-200 bg-zinc-950 p-3 rounded-xl border border-zinc-800">{analysis.optimizedMeta}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Issues & Suggestions */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center gap-2 text-red-400 font-bold mb-4">
                      <AlertCircle className="w-5 h-5" />
                      Critical Issues
                    </div>
                    <ul className="space-y-3">
                      {analysis.issues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-6 rounded-3xl bg-green-500/5 border border-green-500/10">
                    <div className="flex items-center gap-2 text-green-400 font-bold mb-4">
                      <CheckCircle2 className="w-5 h-5" />
                      Optimization Suggestions
                    </div>
                    <ul className="space-y-3">
                      {analysis.suggestions.map((suggestion, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
