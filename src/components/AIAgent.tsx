import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, Clock } from 'lucide-react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { useStore } from '../store/useStore';
import clsx from 'clsx';

interface AIAgentProps {
  onCodeGenerated: (code: string) => void;
  currentCode: string;
  onSave?: () => void;
}

export default function AIAgent({ onCodeGenerated, currentCode, onSave }: AIAgentProps) {
  const { theme, isPremium, aiMode, setAiMode, requestCount, setRequestCount, lastResetTime, setLastResetTime, language } = useStore();
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [pendingShouldSave, setPendingShouldSave] = useState(false);

  const lastResetTimeRef = useRef(lastResetTime);

  useEffect(() => {
    lastResetTimeRef.current = lastResetTime;
  }, [lastResetTime]);

  useEffect(() => {
    if (isPremium) return;
    
    const updateTimer = () => {
      const now = new Date();
      const lastReset = new Date(lastResetTimeRef.current);
      const timeDiff = now.getTime() - lastReset.getTime();
      
      if (timeDiff > 24 * 60 * 60 * 1000) {
        setRequestCount(0);
        setLastResetTime(now.toISOString());
        setTimeUntilReset('');
      } else {
        const remainingMs = 24 * 60 * 60 * 1000 - timeDiff;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const h = language === 'ru' ? 'ч' : 'h';
        const m = language === 'ru' ? 'м' : 'm';
        setTimeUntilReset(`${hours}${h} ${minutes}${m}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [isPremium, language, setRequestCount, setLastResetTime]);

  const checkLimit = () => {
    if (isPremium) return true;
    
    const now = new Date();
    const lastReset = new Date(lastResetTime);
    if (now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000) {
      setRequestCount(0);
      setLastResetTime(now.toISOString());
      return true;
    }
    
    if (requestCount >= 10) {
      alert(language === 'ru' ? "Лимит запросов исчерпан. Обновитесь до Premium для безлимитного доступа!" : "Free limit reached. Upgrade to Premium for unlimited access!");
      return false;
    }
    
    setRequestCount(requestCount + 1);
    return true;
  };

  const refinePrompt = async (originalPrompt: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Refine this programming prompt for an AI agent to be more detailed and clear: "${originalPrompt}"`,
      });
      return response.text?.trim() || originalPrompt;
    } catch (error) {
      console.error("Prompt refinement error:", error);
      return originalPrompt;
    }
  };

  const handleGenerate = async (refinedPrompt?: string) => {
    const promptToUse = (typeof refinedPrompt === 'string' ? refinedPrompt : prompt) || '';
    if (!promptToUse.trim() || !checkLimit()) return;

    if (typeof refinedPrompt !== 'string') {
      setLastPrompt(prompt);
    }
    
    setIsLoading(true);

    const callAI = async (retryCount = 0): Promise<any> => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = aiMode === 'fast' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
        
        const systemInstruction = `
          You are an AI expert in Easy Programming Language (EPL).
          Syntax: keyword{param=val}, #comment, create entity, update entity, event?, end, if check{exp=...} ... end.
          Keywords: world, button, block, 3Dblock, sprite, png, text_label, particle, sound, timer, player, enemy.
          Actions: move, set up, background, type, destroy, wait, stop.

          ${aiMode === 'thinking' ? 'Think step-by-step before generating code.' : ''}
          
          Your task is to generate ONLY the EPL code based on the user's request.
          Do not include any explanations, markdown code blocks, or extra text.
          CRITICAL: If there is existing code, you MUST modify it and return the FULL, complete updated code. NEVER return just a snippet. If the user asks to add something, integrate it into the existing code and return everything.
          If the user asks to save the app, append [SAVE] at the very end of your response.
          
          Current code:
          ${currentCode}
        `;

        const config: any = {
          systemInstruction,
        };
        if (aiMode === 'thinking') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
        }

        return await ai.models.generateContent({
          model,
          contents: promptToUse,
          config,
        });
      } catch (error: any) {
        const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuotaError && retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return callAI(retryCount + 1);
        }
        throw error;
      }
    };

    try {
      const response = await callAI();

      const generatedCode = response.text?.trim() || '';
      
      let cleanedCode = generatedCode;
      // If the response contains a code block, extract only the code block
      const codeBlockMatch = generatedCode.match(/```[a-z]*\n([\s\S]*?)```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleanedCode = codeBlockMatch[1].trim();
      } else {
        // Fallback: just remove markdown ticks if they exist
        cleanedCode = generatedCode.replace(/```[a-z]*\n?|```/gi, '').trim();
      }
      
      let shouldSave = false;
      if (cleanedCode.includes('[SAVE]')) {
        shouldSave = true;
        cleanedCode = cleanedCode.replace('[SAVE]', '').trim();
      }
      
      typeCode(cleanedCode, shouldSave);
      if (isPremium) {
        setPendingCode(cleanedCode);
        setPendingShouldSave(shouldSave);
      }
      setPrompt('');
      setIsLoading(false);
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError) {
        alert(language === 'ru' 
          ? "Лимит запросов ИИ исчерпан. Пожалуйста, подождите немного или попробуйте позже." 
          : "AI quota exhausted. Please wait a moment or try again later.");
      } else {
        alert(language === 'ru' 
          ? "Не удалось сгенерировать код. Пожалуйста, попробуйте еще раз." 
          : "Failed to generate code. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const typeCode = (code: string, shouldSave: boolean = false) => {
    setIsTyping(true);
    let i = 0;
    // Ускоряем печать для длинного кода
    const intervalTime = code.length > 1000 ? 2 : 10; 
    const interval = setInterval(() => {
      onCodeGenerated(code.slice(0, i));
      i++;
      if (i > code.length) {
        clearInterval(interval);
        setIsTyping(false);
        if (isPremium) {
          setIsAwaitingConfirmation(true);
        } else {
          if (shouldSave && onSave) {
            onSave();
          }
        }
      }
    }, intervalTime);
  };

  return (
    <div className={clsx(
      "p-4 border-t",
      theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          AI Assistant
        </div>
        {!isPremium && (
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className={clsx(
              requestCount >= 10 ? "text-red-500" : "text-zinc-500"
            )}>
              {Math.max(0, 10 - requestCount)} / 10 {language === 'ru' ? 'запросов' : 'requests'}
            </span>
            {requestCount >= 10 && timeUntilReset && (
              <span className="flex items-center gap-1 text-orange-500">
                <Clock className="w-3 h-3" />
                {language === 'ru' ? 'Восст. через' : 'Resets in'} {timeUntilReset}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <select
          value={aiMode}
          onChange={(e) => setAiMode(e.target.value as 'fast' | 'thinking' | 'pro')}
          className={clsx(
            "px-2 py-2 rounded-lg text-xs outline-none transition-all",
            theme !== 'light' 
              ? 'bg-zinc-950 border border-zinc-800 text-zinc-200' 
              : 'bg-zinc-50 border border-zinc-200 text-zinc-800'
          )}
        >
          <option value="fast">Fast</option>
          <option value="thinking" disabled={!isPremium}>Thinking {!isPremium && '🔒'}</option>
          <option value="pro" disabled={!isPremium}>Pro {!isPremium && '🔒'}</option>
        </select>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder="Ask AI to create something (e.g. 'Make a red block that moves when clicked')"
          className={clsx(
            "flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all",
            theme !== 'light' 
              ? 'bg-zinc-950 border border-zinc-800 focus:border-emerald-500 text-zinc-200' 
              : 'bg-zinc-50 border border-zinc-200 focus:border-emerald-500 text-zinc-800'
          )}
        />
        <button
          onClick={() => handleGenerate()}
          disabled={isLoading || isTyping || !prompt.trim() || isAwaitingConfirmation}
          className={clsx(
            "px-4 py-2 rounded-lg flex items-center justify-center transition-all",
            isLoading || isTyping || !prompt.trim() || isAwaitingConfirmation
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
          )}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {isAwaitingConfirmation && (
        <div className={clsx(
          "mt-4 p-4 rounded-lg border flex flex-col gap-3",
          theme !== 'light' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        )}>
          <p className="text-sm text-zinc-500">{language === 'ru' ? 'Оставить этот код или переделать?' : 'Keep this code or re-generate?'}</p>
          <div className="flex gap-3">
            <button onClick={async () => {
              setIsAwaitingConfirmation(false);
              const refined = await refinePrompt(lastPrompt);
              handleGenerate(refined);
            }} className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm">{language === 'ru' ? 'Переделать' : 'Re-generate'}</button>
            <button onClick={() => {
              setIsAwaitingConfirmation(false);
              if (pendingShouldSave && onSave) onSave();
            }} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors text-white text-sm">{language === 'ru' ? 'Оставить' : 'Keep'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
