import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Loader2, Clock } from 'lucide-react';
import { generateWithAI } from '../lib/gemini';
import { useStore } from '../store/useStore';
import { notify } from '../store/useDialogStore';
import clsx from 'clsx';
import CustomSelect from './CustomSelect';

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
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const unlockAchievement = useStore(state => state.unlockAchievement);

  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [pendingShouldSave, setPendingShouldSave] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);

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
    const interval = setInterval(updateTimer, 60000);
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
      notify.error(
        language === 'ru'
          ? 'Лимит запросов исчерпан. Обновитесь до Premium для безлимитного доступа!'
          : 'Free limit reached. Upgrade to Premium for unlimited access!'
      );
      return false;
    }

    setRequestCount(requestCount + 1);
    return true;
  };

  const refinePrompt = async (originalPrompt: string) => {
    try {
      const refined = await generateWithAI(
        `Refine this programming prompt for an AI agent to be more detailed and clear: "${originalPrompt}"`,
        {
          systemInstruction:
            'You are an AI expert in Easy Programming Language (EPL). When refining prompts, ensure they are detailed and clear, following the EPL rules: every entity must have its properties configured inline using curly braces {}, including name, x, y, width, height, and color.',
          model: 'gemini-4-hydrogen',
        }
      );
      return refined?.trim() || originalPrompt;
    } catch (error) {
      console.error('Prompt refinement error:', error);
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

    let statusInterval: ReturnType<typeof setInterval> | undefined;
    if (aiMode === 'thinking' || aiMode === 'pro') {
      const statuses =
        language === 'ru'
          ? ['Анализ запроса...', 'Подбор вариантов кода...', 'Внутреннее тестирование...', 'Оптимизация...', 'Финальная проверка...']
          : ['Analyzing request...', 'Selecting code variants...', 'Internal testing...', 'Optimizing...', 'Final checks...'];

      let step = 0;
      const speed = aiMode === 'pro' ? 800 : 1500;
      statusInterval = setInterval(() => {
        step = Math.min(step + 1, statuses.length - 1);
        setLoadingStatus(statuses[step]);
      }, speed);
    }

    const callAI = async (retryCount = 0): Promise<void> => {
      try {
        const systemInstruction = `
          You are an elite AI expert in Easy Programming Language (EPL).
          
          ${
            aiMode === 'fast'
              ? 'You are in FAST mode. Your goal is to be EXTREMELY fast and direct. Give ONLY the essential code with minimal processing. Do not be overly verbose, just get the code done and delivered instantly.'
              : "You are in a high-creativity and high-precision mode. Your goal is to deliver the most creative, optimized, and robust solutions possible. Take your time to think through the design, interactivity, and aesthetics of the user's request."
          }

          VALID KEYWORDS:
          - Control: if, else, then, end, check, return, stop, repeat, forever, wait, control, compare, variable_activated?
          - Events: started?, created?, clicked?, collided?, key_pressed?, writed?, timer_tick?, file_added?, input
          - Actions: set up, background, move, create, type, destroy, hide, show, rotate, scale, play_sound, stop_sound, clear, ai, math, variable, activate_variable, open, cursor, move_to, draggable, design, position
          - Entities: world, button, block, 3Dblock, 3DCamera, 3DEditor, sprite, png, text_label, particle, sound, timer, player, enemy, textbox, circle, line, file, wasd_controls, terminal

          CRITICAL RULES FOR COMPONENT CONFIGURATION (READ CAREFULLY):
          1. EVERY single entity YOU create MUST have its configuration block in curly braces {}. EVERY configuration block supports a "variable" setting (e.g. variable=myVar).
          2. YOU ARE FORBIDDEN from writing an entity without properties. For example, \`create block\` is INVALID. You MUST write \`create block {name=box, x=10, y=10, width=50, height=50, color=red}\`.
          3. REQUIRED PROPERTIES by entity (DO NOT SKIP THESE):
             - block: name, x, y, width, height, color
             - button: name, label, x, y, color
             - text_label: name, text, x, y, color
             - png/sprite: name, file (or image), x, y
             - 3Dblock: name, size, x, y, z, color
             - 3DCamera: name, lookAt, mouseLook, scrollZoom
             - player: name, speed, x, y
             - circle: name, radius, x, y, color
          4. When creating entities, keep their x and y coordinates within 0-800 and width/height within 10-200.
          5. Do not include any explanations, markdown code blocks, or extra text. Return ONLY the code.
          6. If there is existing code, you MUST modify it and return the FULL, complete updated code.
          7. If the user asks to save the app, append [SAVE] at the very end of your response.
          8. NEVER generate code with placeholders, comments like "fill this in", or incomplete configurations.
          9. YOU MUST EXPLICITLY WRITE OUT THE SETTINGS INSIDE {} FOR EVERY SINGLE ENTITY. THIS IS MANDATORY.
          10. If you are generating code, you MUST wrap it in a \`\`\`epl block.

          EXAMPLES OF PERFECT SYNTAX:
          \`\`\`epl
          create block {name=b1, x=100, y=100, width=50, height=50, color=red}
          create button {name=btn1, label="Click me", x=200, y=200, color=blue}
          create text_label {name=score, text="Score: 0", x=10, y=10, color=black}
          \`\`\`

          Current code:
          ${currentCode}
          
          Chat History:
          ${chatMessages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n')}
        `;

        const fullCode = await generateWithAI(promptToUse, {
          systemInstruction,
          model: 'gemini-4-hydrogen',
        });

        if (statusInterval) clearInterval(statusInterval);
        setLoadingStatus('');
        setIsTyping(true);

        let currentCleanCode = fullCode;
        const codeBlockMatch = fullCode.match(/```(?:epl)?\n([\s\S]*?)```?/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
          currentCleanCode = codeBlockMatch[1].trim();
        } else if (fullCode.includes('create ') || fullCode.includes('{')) {
          currentCleanCode = fullCode.replace(/```[a-z]*\n?/gi, '').replace(/```/gi, '').trim();
        }

        if (currentCleanCode) {
          const stripped = currentCleanCode.replace('[SAVE]', '').trim();
          onCodeGenerated(stripped);
        }

        setIsTyping(false);
        setIsLoading(false);

        let cleanedFinal = fullCode;
        let aiMessage = '';
        const finalMatch = fullCode.match(/```(?:epl)?\n([\s\S]*?)```/i);
        if (finalMatch && finalMatch[1]) {
          cleanedFinal = finalMatch[1].trim();
          aiMessage = fullCode.replace(finalMatch[0], '').trim();
        } else if (fullCode.includes('create ') || fullCode.includes('{')) {
          cleanedFinal = fullCode.replace(/```[a-z]*\n?/gi, '').replace(/```/gi, '').trim();
        } else {
          aiMessage = fullCode;
          cleanedFinal = '';
        }

        if (aiMessage) {
          setChatMessages(prev => [...prev, { role: 'ai', text: aiMessage }]);
        }

        let shouldSave = false;
        if (cleanedFinal.includes('[SAVE]')) {
          shouldSave = true;
          cleanedFinal = cleanedFinal.replace('[SAVE]', '').trim();
        }

        if (isPremium) {
          setPendingCode(cleanedFinal);
          setPendingShouldSave(shouldSave);
          setIsAwaitingConfirmation(true);
        } else if (shouldSave && onSave) {
          onSave();
        }

        unlockAchievement('vibe_coding');
        setPrompt('');
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
      await callAI();
    } catch (error: any) {
      if (statusInterval) clearInterval(statusInterval);
      setLoadingStatus('');
      console.error('AI Generation Error:', error);
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError) {
        notify.error(
          language === 'ru'
            ? 'Лимит запросов ИИ исчерпан. Пожалуйста, подождите немного или попробуйте позже.'
            : 'AI quota exhausted. Please wait a moment or try again later.'
        );
      } else {
        notify.error(
          language === 'ru'
            ? 'Не удалось сгенерировать код. Пожалуйста, попробуйте еще раз.'
            : 'Failed to generate code. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={clsx(
        'p-4 border-t',
        computerStyle
          ? 'bg-transparent border-emerald-500/30'
          : isFrutigerAero
          ? 'frutiger-aero-glass border-white/60'
          : theme !== 'light'
          ? 'bg-[#181B20] border-[#262B33]'
          : 'bg-white border-[#E2E5EA]'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className={clsx(
            'flex items-center gap-2 text-xs font-semibold uppercase tracking-wider',
            computerStyle ? 'text-emerald-500' : theme !== 'light' ? 'text-[#9BA1A6]' : 'text-[#5C636E]'
          )}
        >
          <Terminal className={clsx('w-3.5 h-3.5', isFrutigerAero ? 'text-blue-600' : 'text-[#10B981]')} />
          <span>EPL AI Assistant</span>
        </div>
        {!isPremium && (
          <div className="flex items-center gap-2 text-xs font-medium font-mono-num">
            <span className={clsx(requestCount >= 10 ? 'text-red-500' : 'text-[#9BA1A6]')}>
              {Math.max(0, 10 - requestCount)} / 10 {language === 'ru' ? 'запросов' : 'requests'}
            </span>
            {requestCount >= 10 && timeUntilReset && (
              <span className="flex items-center gap-1 text-amber-500">
                <Clock className="w-3 h-3" />
                {language === 'ru' ? 'Восст. через' : 'Resets in'} {timeUntilReset}
              </span>
            )}
          </div>
        )}
      </div>

      {chatMessages.length > 0 && (
        <div
          className={clsx(
            'mb-3 max-h-40 overflow-y-auto rounded-lg p-2 space-y-2 text-sm border',
            computerStyle
              ? 'bg-black border-emerald-500/30'
              : theme !== 'light'
              ? 'bg-[#111315] border-[#262B33]'
              : 'bg-[#F5F6F8] border-[#E2E5EA]'
          )}
        >
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={clsx(
                'p-2.5 rounded-lg max-w-[90%] w-fit text-xs leading-relaxed',
                msg.role === 'user'
                  ? computerStyle
                    ? 'ml-auto bg-emerald-900/30 border border-emerald-500/50 text-emerald-400'
                    : 'ml-auto bg-[#10B981]/15 border border-[#10B981]/30 text-emerald-400'
                  : computerStyle
                  ? 'mr-auto bg-black border border-emerald-500/30 text-emerald-400'
                  : theme !== 'light'
                  ? 'mr-auto bg-[#181B20] border border-[#262B33] text-[#F1F3F5]'
                  : 'mr-auto bg-white border border-[#E2E5EA] text-[#111315]'
              )}
            >
              {msg.text}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      <div className="flex gap-2">
        <CustomSelect
          value={aiMode}
          onChange={(val) => setAiMode(val as 'fast' | 'thinking' | 'pro')}
          size="sm"
          placement="top"
          computerStyleOverride={computerStyle}
          className="shrink-0 min-w-[106px]"
          options={[
            { value: 'fast', label: 'Fast' },
            { value: 'thinking', label: `Thinking${!isPremium ? ' (Pro)' : ''}`, disabled: !isPremium },
            { value: 'pro', label: `Pro${!isPremium ? ' (Pro)' : ''}`, disabled: !isPremium },
          ]}
        />
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          placeholder={
            language === 'ru'
              ? 'Опишите, что нужно создать в EPL (например: «Сделай красный блок»)'
              : "Ask AI to create something (e.g. 'Make a red block that moves when clicked')"
          }
          className={clsx(
            'flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-colors border',
            computerStyle
              ? 'bg-black border-emerald-500/50 text-emerald-500 focus:border-emerald-400 placeholder-emerald-800'
              : theme !== 'light'
              ? 'bg-[#111315] border-[#262B33] focus:border-[#10B981] text-[#F1F3F5] placeholder-[#6B7280]'
              : 'bg-[#F5F6F8] border-[#E2E5EA] focus:border-[#059669] text-[#111315] placeholder-[#8A94A6]'
          )}
        />
        <button
          onClick={() => handleGenerate()}
          disabled={isLoading || isTyping || !prompt.trim() || isAwaitingConfirmation}
          className={clsx(
            'px-4 py-2 rounded-lg flex items-center justify-center transition-colors shrink-0 whitespace-nowrap',
            isLoading || isTyping || !prompt.trim() || isAwaitingConfirmation
              ? computerStyle
                ? 'bg-black border border-emerald-900 text-emerald-900 cursor-not-allowed'
                : theme !== 'light'
                ? 'bg-[#21252C] text-[#6B7280] cursor-not-allowed'
                : 'bg-[#E2E5EA] text-[#8A94A6] cursor-not-allowed'
              : computerStyle
              ? 'bg-emerald-900 border border-emerald-500 text-emerald-400 hover:bg-emerald-800'
              : isFrutigerAero
              ? 'frutiger-aero-button text-white'
              : 'bg-[#10B981] hover:bg-[#059669] text-[#111315] font-semibold'
          )}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {isLoading && loadingStatus && (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-[#10B981] font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{loadingStatus}</span>
        </div>
      )}

      {isAwaitingConfirmation && (
        <div
          className={clsx(
            'mt-3 p-3.5 rounded-lg border flex flex-col gap-3',
            theme !== 'light' ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
          )}
        >
          <p className={clsx('text-sm', theme !== 'light' ? 'text-[#9BA1A6]' : 'text-[#5C636E]')}>
            {language === 'ru' ? 'Оставить этот код или переделать?' : 'Keep this code or re-generate?'}
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={async () => {
                setIsAwaitingConfirmation(false);
                const refined = await refinePrompt(lastPrompt);
                handleGenerate(refined);
              }}
              className={clsx(
                'flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap',
                theme !== 'light'
                  ? 'bg-[#21252C] border-[#262B33] text-[#F1F3F5] hover:bg-[#2A2F38]'
                  : 'bg-white border-[#E2E5EA] text-[#111315] hover:bg-[#EBEEF2]'
              )}
            >
              {language === 'ru' ? 'Переделать' : 'Re-generate'}
            </button>
            <button
              onClick={() => {
                setIsAwaitingConfirmation(false);
                if (pendingShouldSave && onSave) onSave();
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] transition-colors text-[#111315] font-semibold text-sm whitespace-nowrap"
            >
              {language === 'ru' ? 'Оставить' : 'Keep'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
