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
  const theme = useStore(state => state.theme);
  const userData = useStore(state => state.userData);
  const isPremium = useStore(state => state.isPremium) || userData?.role === 'developer';
  const aiMode = useStore(state => state.aiMode);
  const setAiMode = useStore(state => state.setAiMode);
  const requestCount = useStore(state => state.requestCount);
  const setRequestCount = useStore(state => state.setRequestCount);
  const lastResetTime = useStore(state => state.lastResetTime);
  const setLastResetTime = useStore(state => state.setLastResetTime);
  const language = useStore(state => state.language);
  const computerStyle = useStore(state => state.computerStyle);
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [pendingShouldSave, setPendingShouldSave] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);

  const lastResetTimeRef = useRef(lastResetTime);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
      const model = aiMode === 'fast' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
      const response = await ai.models.generateContent({
        model,
        contents: `Refine this programming prompt for an AI agent to be more detailed and clear: "${originalPrompt}"`,
        config: {
          systemInstruction: "You are an AI expert in Easy Programming Language (EPL). When refining prompts, ensure they are detailed and clear, following the EPL rules: every entity must have its properties configured inline using curly braces {}, including name, x, y, width, height, and color."
        }
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
    setLoadingStatus(language === 'ru' ? 'Анализ запроса...' : 'Analyzing request...');

    let statusInterval: any;
    if (aiMode === 'thinking' || aiMode === 'pro') {
      const statuses = language === 'ru' 
        ? ['Анализ запроса...', 'Подбор вариантов кода...', 'Внутреннее тестирование...', 'Оптимизация...', 'Финальная проверка...']
        : ['Analyzing request...', 'Selecting code variants...', 'Internal testing...', 'Optimizing...', 'Final checks...'];
      
      let step = 0;
      const speed = aiMode === 'pro' ? 800 : 1500; 
      statusInterval = setInterval(() => {
        step = Math.min(step + 1, statuses.length - 1);
        setLoadingStatus(statuses[step]);
      }, speed);
    }

    const callAI = async (retryCount = 0): Promise<any> => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = aiMode === 'fast' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
        
        const systemInstruction = `
          You are an elite AI expert in Easy Programming Language (EPL).
          
          VALID KEYWORDS:
          - Control: if, else, then, end, check, return, stop, repeat, forever, wait, control
          - Events: started?, created?, clicked?, collided?, key_pressed?, writed?, timer_tick?
          - Actions: set up, background, move, create, type, destroy, hide, show, rotate, scale, play_sound, stop_sound, clear, ai, math
          - Entities: world, button, block, 3Dblock, sprite, png, text_label, particle, sound, timer, player, enemy

          CRITICAL RULES:
          1. ONLY use the keywords and entities listed above. Do NOT invent new ones.
          2. EVERY entity created MUST have its properties configured inline using curly braces {}.
          3. A component configuration MUST include essential properties: name, x, y, width, height, and color (or background).
          4. When creating entities, keep their x and y coordinates within 0-800 and width/height within 10-200.
          5. Do not include any explanations, markdown code blocks, or extra text. Return ONLY the code.
          6. If there is existing code, you MUST modify it and return the FULL, complete updated code.
          7. If the user asks to save the app, append [SAVE] at the very end of your response.
          8. NEVER generate code with placeholders, comments like "fix this", or incomplete configurations. You MUST provide all necessary configuration values for every component you create.
          9. YOU MUST EXPLICITLY WRITE OUT THE SETTINGS INSIDE {} FOR EVERY SINGLE ENTITY. DO NOT SKIP ANY PROPERTIES. THIS IS MANDATORY.
          10. Think step-by-step internally to ensure the code is perfect.
          11. If you need clarification from the user, ask them a question.
          12. If you are generating code, you MUST wrap it in a \`\`\`epl block.

          EXAMPLE OF CORRECT SYNTAX:
          \`\`\`epl
          create block {name=my_block, x=100, y=100, width=50, height=50, color=red}
          \`\`\`

          Current code:
          ${currentCode}
          
          Chat History:
          ${chatMessages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n')}
        `;

        const config: any = {
          systemInstruction,
        };
        if (aiMode === 'thinking') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
        } else if (aiMode === 'fast') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
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
      setChatMessages(prev => [...prev, { role: 'user', text: promptToUse }]);
      const response = await callAI();

      if (statusInterval) clearInterval(statusInterval);
      setLoadingStatus('');

      const generatedCode = response.text?.trim() || '';
      
      let cleanedCode = '';
      let aiMessage = '';
      
      // If the response contains a code block, extract only the code block
      const codeBlockMatch = generatedCode.match(/```(?:epl)?\n([\s\S]*?)```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleanedCode = codeBlockMatch[1].trim();
        aiMessage = generatedCode.replace(codeBlockMatch[0], '').trim();
      } else {
        // If no code block, maybe it's just a message or just code
        if (generatedCode.includes('create ') || generatedCode.includes('{')) {
          cleanedCode = generatedCode.replace(/```[a-z]*\n?|```/gi, '').trim();
        } else {
          aiMessage = generatedCode;
        }
      }
      
      if (aiMessage) {
        setChatMessages(prev => [...prev, { role: 'ai', text: aiMessage }]);
      }
      
      if (cleanedCode) {
        let shouldSave = false;
        if (cleanedCode.includes('[SAVE]')) {
          shouldSave = true;
          cleanedCode = cleanedCode.replace('[SAVE]', '').trim();
        }
        
        if (aiMode === 'pro') {
          // Pro writes instantly
          onCodeGenerated(cleanedCode);
          if (isPremium) {
            setPendingCode(cleanedCode);
            setPendingShouldSave(shouldSave);
            setIsAwaitingConfirmation(true);
          } else if (shouldSave && onSave) {
            onSave();
          }
        } else {
          typeCode(cleanedCode, shouldSave);
          if (isPremium) {
            setPendingCode(cleanedCode);
            setPendingShouldSave(shouldSave);
          }
        }
      }
      
      setPrompt('');
      setIsLoading(false);
    } catch (error: any) {
      if (statusInterval) clearInterval(statusInterval);
      setLoadingStatus('');
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
      computerStyle ? "bg-transparent border-emerald-500/30" : (theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')
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

      {chatMessages.length > 0 && (
        <div className={clsx(
          "mb-3 max-h-40 overflow-y-auto rounded-lg p-2 space-y-2 text-sm",
          theme !== 'light' ? 'bg-zinc-950/50' : 'bg-zinc-50',
          computerStyle && "bg-transparent border border-emerald-500/30"
        )}>
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={clsx(
              "p-2 rounded-lg max-w-[90%] w-fit",
              msg.role === 'user' 
                ? (computerStyle ? "ml-auto bg-emerald-900/30 border border-emerald-500/50 text-emerald-500" : "ml-auto bg-emerald-500/10 text-emerald-600 dark:text-emerald-400") 
                : (computerStyle ? "mr-auto bg-black border border-emerald-500/30 text-emerald-500" : "mr-auto bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200")
            )}>
              {msg.text}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      <div className="flex gap-2">
        <select
          value={aiMode}
          onChange={(e) => setAiMode(e.target.value as 'fast' | 'thinking' | 'pro')}
          className={clsx(
            "px-2 py-2 rounded-lg text-xs outline-none transition-all",
            theme !== 'light' 
              ? 'bg-zinc-950 border border-zinc-800 text-zinc-200' 
              : 'bg-zinc-50 border border-zinc-200 text-zinc-800',
            computerStyle && "bg-black border-emerald-500/50 text-emerald-500 focus:border-emerald-400"
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
              : 'bg-zinc-50 border border-zinc-200 focus:border-emerald-500 text-zinc-800',
            computerStyle && "bg-black border-emerald-500/50 text-emerald-500 focus:border-emerald-400 placeholder-emerald-800"
          )}
        />
        <button
          onClick={() => handleGenerate()}
          disabled={isLoading || isTyping || !prompt.trim() || isAwaitingConfirmation}
          className={clsx(
            "px-4 py-2 rounded-lg flex items-center justify-center transition-all",
            isLoading || isTyping || !prompt.trim() || isAwaitingConfirmation
              ? (computerStyle ? 'bg-black border border-emerald-900 text-emerald-900 cursor-not-allowed' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed')
              : (computerStyle ? 'bg-emerald-900 border border-emerald-500 text-emerald-400 hover:bg-emerald-800 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20')
          )}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      
      {isLoading && loadingStatus && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-500 font-medium animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          {loadingStatus}
        </div>
      )}

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
