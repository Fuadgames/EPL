import React, { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Play,
  Trophy,
  Target,
  BookOpen,
  Star,
  Info,
  Lightbulb,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { translations, tutorialContent } from '../lib/translations';

interface TutorialProps {
  onClose: () => void;
}

export default function Tutorial({ onClose }: TutorialProps) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);
  const tutorialMinimized = useStore(state => state.tutorialMinimized);
  const setTutorialMinimized = useStore(state => state.setTutorialMinimized);
  const tutorialLevel = useStore(state => state.tutorialLevel);
  const setTutorialLevel = useStore(state => state.setTutorialLevel);
  const tutorialStep = useStore(state => state.tutorialStep);
  const setTutorialStep = useStore(state => state.setTutorialStep);
  const tutorialStepCompleted = useStore(state => state.tutorialStepCompleted);
  const setTutorialStepCompleted = useStore(state => state.setTutorialStepCompleted);
  const setTutorialCheckRequested = useStore(state => state.setTutorialCheckRequested);
  const t = translations[language];
  const levels = tutorialContent[language];

  const level = levels[tutorialLevel];
  const step = level.steps[tutorialStep];

  const [showExample, setShowExample] = useState(false);

  const isDark = theme !== 'light' && !isFrutigerAero;

  const handleNext = () => {
    if (step.type === 'challenge' && !tutorialStepCompleted) return;

    if (tutorialStep < level.steps.length - 1) {
      setTutorialStep(tutorialStep + 1);
      setTutorialStepCompleted(false);
      setShowExample(false);
    } else if (tutorialLevel < levels.length - 1) {
      setTutorialLevel(tutorialLevel + 1);
      setTutorialStep(0);
      setTutorialStepCompleted(false);
      setShowExample(false);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (tutorialStep > 0) {
      setTutorialStep(tutorialStep - 1);
      setTutorialStepCompleted(false);
      setShowExample(false);
    } else if (tutorialLevel > 0) {
      setTutorialLevel(tutorialLevel - 1);
      setTutorialStep(levels[tutorialLevel - 1].steps.length - 1);
      setTutorialStepCompleted(false);
      setShowExample(false);
    }
  };

  const startChallenge = () => {
    setTutorialMinimized(true);
  };

  const handleCheck = () => {
    setTutorialCheckRequested(true);
  };

  if (tutorialMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[210] flex flex-col items-end gap-2.5">
        <button
          onClick={handleCheck}
          className={clsx(
            'px-4 py-2.5 rounded-lg border shadow-xl flex items-center gap-2 font-semibold text-sm transition-colors whitespace-nowrap',
            tutorialStepCompleted
              ? 'bg-[#10B981] border-[#10B981] text-[#111315]'
              : 'bg-[#181B20] border-[#10B981] text-[#10B981] hover:bg-[#21252C]'
          )}
        >
          {tutorialStepCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          <span>{language === 'ru' ? 'Проверить' : 'Check'}</span>
        </button>
        <button
          onClick={() => setTutorialMinimized(false)}
          className={clsx(
            'px-4 py-2.5 rounded-lg border shadow-xl flex items-center gap-2 font-semibold text-sm transition-colors whitespace-nowrap',
            isDark
              ? 'bg-[#181B20] border-[#262B33] text-[#F1F3F5] hover:bg-[#21252C]'
              : 'bg-white border-[#E2E5EA] text-[#111315] hover:bg-[#F5F6F8]'
          )}
        >
          <Target className="w-4 h-4 text-[#10B981]" />
          <span>{language === 'ru' ? 'Вернуться к обучению' : 'Back to Tutorial'}</span>
        </button>
      </div>
    );
  }

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'beginner':
        return 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30';
      case 'intermediate':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'advanced':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'pro':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      default:
        return 'text-[#9BA1A6] bg-[#21252C] border-[#262B33]';
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      case 'how-to':
        return <Lightbulb className="w-5 h-5 text-amber-400" />;
      case 'challenge':
        return <Target className="w-5 h-5 text-[#10B981]" />;
      default:
        return <BookOpen className="w-5 h-5 text-[#9BA1A6]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div
        className={clsx(
          'w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl p-5 sm:p-7 shadow-2xl border flex flex-col gap-5',
          isFrutigerAero
            ? 'frutiger-aero-glass border-white/60 text-blue-950'
            : isDark
            ? 'bg-[#181B20] border-[#262B33] text-[#F1F3F5]'
            : 'bg-white border-[#E2E5EA] text-[#111315]'
        )}
      >
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider',
                  getDifficultyColor(level.difficulty)
                )}
              >
                {t.tutorial.difficulty[level.difficulty as keyof typeof t.tutorial.difficulty]}
              </span>
              <span className="text-[#9BA1A6] text-xs font-medium font-mono-num">
                {t.tutorial.level} {tutorialLevel + 1} · {t.tutorial.step} {tutorialStep + 1} {t.tutorial.of}{' '}
                {level.steps.length}
              </span>
            </div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              {step.type === 'challenge' ? (
                <Trophy className="w-6 h-6 text-[#10B981]" />
              ) : (
                <BookOpen className="w-6 h-6 text-[#10B981]" />
              )}
              {level.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              isDark ? 'hover:bg-[#21252C] text-[#9BA1A6]' : 'hover:bg-[#F5F6F8] text-[#5C636E]'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5">
          <div className="flex gap-3.5">
            <div className="mt-0.5 shrink-0">{getStepIcon(step.type)}</div>
            <div className="space-y-1.5">
              <h4 className="text-base font-bold">{step.title}</h4>
              <p className={clsx('text-sm leading-relaxed', isDark ? 'text-[#9BA1A6]' : 'text-[#5C636E]')}>
                {step.content}
              </p>
            </div>
          </div>

          {step.example && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9BA1A6] flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-[#10B981]" /> {t.tutorial.syntaxExample}
              </h4>
              <pre
                className={clsx(
                  'p-4 rounded-lg font-mono text-xs overflow-x-auto border',
                  isDark ? 'bg-[#0B0D0F] border-[#262B33] text-[#10B981]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#059669]'
                )}
              >
                {step.example}
              </pre>
            </div>
          )}

          {step.task && (
            <div
              className={clsx(
                'p-4 rounded-lg border flex gap-3.5',
                isDark ? 'bg-[#10B981]/10 border-[#10B981]/30' : 'bg-emerald-50 border-emerald-200'
              )}
            >
              <Target className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#10B981]">{t.tutorial.challenge}</h4>
                <p className="text-sm font-semibold">{step.task}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              {step.task && (
                <button
                  onClick={startChallenge}
                  className="flex-1 py-2.5 bg-[#10B981] hover:bg-[#059669] text-[#111315] rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Play className="w-4 h-4" />
                  {language === 'ru' ? 'Начать задание' : 'Start Task'}
                </button>
              )}
              <button
                onClick={handleCheck}
                className={clsx(
                  'px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 border whitespace-nowrap',
                  tutorialStepCompleted
                    ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                    : isDark
                    ? 'bg-[#21252C] border-[#262B33] text-[#F1F3F5] hover:bg-[#2A2F38]'
                    : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] hover:bg-[#EBEEF2]'
                )}
              >
                {tutorialStepCompleted ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> : <Search className="w-4 h-4" />}
                {language === 'ru' ? 'Проверить' : 'Check'}
              </button>
            </div>

            {(step as any).answer && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowExample(!showExample)}
                  className="text-xs font-semibold uppercase tracking-wider text-[#9BA1A6] hover:text-[#10B981] flex items-center gap-1 transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {language === 'ru'
                    ? showExample
                      ? 'Скрыть пример'
                      : 'Показать пример решения'
                    : showExample
                    ? 'Hide Example'
                    : 'Show Example Solution'}
                </button>

                {showExample && (
                  <pre
                    className={clsx(
                      'p-3.5 rounded-lg font-mono text-xs overflow-x-auto border',
                      isDark ? 'bg-[#0B0D0F] border-[#262B33] text-blue-400' : 'bg-[#F5F6F8] border-[#E2E5EA] text-blue-700'
                    )}
                  >
                    {(step as any).answer}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-[#9BA1A6] font-mono-num">
            <span>{t.tutorial.progress}</span>
            <span>{Math.round(((tutorialLevel * 3 + tutorialStep) / (levels.length * 3)) * 100)}%</span>
          </div>
          <div className={clsx('h-1.5 rounded-full overflow-hidden flex gap-0.5', isDark ? 'bg-[#21252C]' : 'bg-[#E2E5EA]')}>
            {levels.map((l, lIdx) => (
              <div key={lIdx} className="flex-1 flex gap-0.5">
                {l.steps.map((_, sIdx) => (
                  <div
                    key={sIdx}
                    className={clsx(
                      'flex-1 transition-all duration-300',
                      lIdx < tutorialLevel || (lIdx === tutorialLevel && sIdx <= tutorialStep)
                        ? 'bg-[#10B981]'
                        : isDark
                        ? 'bg-[#262B33]'
                        : 'bg-[#D1D5DB]'
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div
          className={clsx(
            'flex items-center justify-between pt-4 border-t',
            isDark ? 'border-[#262B33]' : 'border-[#E2E5EA]'
          )}
        >
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-[#9BA1A6] hover:text-[#F1F3F5] transition-colors whitespace-nowrap"
          >
            {t.tutorial.exit}
          </button>

          <div className="flex items-center gap-2.5">
            {(tutorialLevel > 0 || tutorialStep > 0) && (
              <button
                onClick={handlePrev}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 border whitespace-nowrap',
                  isDark
                    ? 'border-[#262B33] hover:bg-[#21252C] text-[#F1F3F5]'
                    : 'border-[#E2E5EA] hover:bg-[#F5F6F8] text-[#111315]'
                )}
              >
                <ChevronLeft className="w-4 h-4" /> {t.tutorial.previous}
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-[#10B981] hover:bg-[#059669] text-[#111315] rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              {tutorialStep === level.steps.length - 1 && tutorialLevel === levels.length - 1
                ? t.tutorial.complete
                : tutorialStep === level.steps.length - 1
                ? t.tutorial.nextLevel
                : t.tutorial.next}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
