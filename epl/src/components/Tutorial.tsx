import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Play, Trophy, Target, BookOpen, Star, Info, Lightbulb, Search, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { translations, tutorialContent } from '../lib/translations';

interface TutorialProps {
  onClose: () => void;
}

export default function Tutorial({ onClose }: TutorialProps) {
  const theme = useStore(state => state.theme);
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
      <div className="fixed bottom-8 right-8 z-[210] flex flex-col items-end gap-3">
        <button 
          onClick={handleCheck}
          className={clsx(
            "p-4 rounded-full shadow-2xl flex items-center gap-2 font-bold transition-all transform hover:scale-110 active:scale-90",
            tutorialStepCompleted ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
          )}
        >
          {tutorialStepCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Search className="w-6 h-6" />}
          <span>{language === 'ru' ? 'Проверить' : 'Check'}</span>
        </button>
        <button 
          onClick={() => setTutorialMinimized(false)}
          className={clsx(
            "p-4 rounded-full shadow-2xl animate-bounce flex items-center gap-2 font-bold",
            theme !== 'light' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900'
          )}
        >
          <Target className="w-6 h-6" />
          <span>{language === 'ru' ? 'Вернуться к обучению' : 'Back to Tutorial'}</span>
        </button>
      </div>
    );
  }

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'beginner': return 'text-emerald-500 bg-emerald-500/10';
      case 'intermediate': return 'text-blue-500 bg-blue-500/10';
      case 'advanced': return 'text-purple-500 bg-purple-500/10';
      case 'pro': return 'text-orange-500 bg-orange-500/10';
      default: return 'text-zinc-500 bg-zinc-500/10';
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="w-6 h-6 text-blue-500" />;
      case 'how-to': return <Lightbulb className="w-6 h-6 text-yellow-500" />;
      case 'challenge': return <Target className="w-6 h-6 text-emerald-500" />;
      default: return <BookOpen className="w-6 h-6 text-zinc-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={clsx(
        "w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-4 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col gap-4 sm:gap-6",
        theme !== 'light' ? 'bg-zinc-900 border border-zinc-800 text-zinc-200' : 'bg-white border border-zinc-200 text-zinc-800'
      )}>
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", getDifficultyColor(level.difficulty))}>
                {t.tutorial.difficulty[level.difficulty as keyof typeof t.tutorial.difficulty]}
              </span>
              <span className="text-zinc-500 text-xs font-medium">{t.tutorial.level} {tutorialLevel + 1} • {t.tutorial.step} {tutorialStep + 1} {t.tutorial.of} {level.steps.length}</span>
            </div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              {step.type === 'challenge' ? <Trophy className="w-7 h-7 text-emerald-500" /> : <BookOpen className="w-7 h-7 text-emerald-500" />}
              {level.title}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          <div className="flex gap-4">
            <div className="mt-1 shrink-0">
              {getStepIcon(step.type)}
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold">{step.title}</h4>
              <p className={clsx("text-base leading-relaxed", theme !== 'light' ? 'text-zinc-400' : 'text-zinc-600')}>
                {step.content}
              </p>
            </div>
          </div>

          {step.example && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Star className="w-3 h-3" /> {t.tutorial.syntaxExample}
              </h4>
              <pre className={clsx("p-5 rounded-2xl font-mono text-sm overflow-x-auto border", theme !== 'light' ? 'bg-black border-zinc-800 text-emerald-400' : 'bg-zinc-100 border-zinc-200 text-emerald-700')}>
                {step.example}
              </pre>
            </div>
          )}

          {step.task && (
            <div className={clsx("p-6 rounded-2xl border-2 flex gap-4 animate-pulse", theme !== 'light' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200')}>
              <Target className="w-6 h-6 text-emerald-500 shrink-0" />
              <div className="space-y-2">
                <h4 className="text-sm font-black uppercase tracking-widest text-emerald-500">{t.tutorial.challenge}</h4>
                <p className="text-lg font-bold">{step.task}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {step.task && (
                <button 
                  onClick={startChallenge}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {language === 'ru' ? 'Начать выполнение задания' : 'Start Task'}
                </button>
              )}
              <button 
                onClick={handleCheck}
                className={clsx(
                  "px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border-2",
                  tutorialStepCompleted 
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                    : "bg-blue-500/10 border-blue-500 text-blue-500 hover:bg-blue-500/20"
                )}
              >
                {tutorialStepCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                {language === 'ru' ? 'Проверить' : 'Check'}
              </button>
            </div>
            
            {(step as any).answer && (
              <div className="space-y-2">
                <button 
                  onClick={() => setShowExample(!showExample)}
                  className={clsx(
                    "text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors",
                    theme !== 'light' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
                  )}
                >
                  <Lightbulb className="w-3 h-3" /> 
                  {language === 'ru' ? (showExample ? 'Скрыть пример' : 'Показать пример решения') : (showExample ? 'Hide Example' : 'Show Example Solution')}
                </button>
                
                {showExample && (
                  <pre className={clsx("p-4 rounded-xl font-mono text-xs overflow-x-auto border", theme !== 'light' ? 'bg-black border-zinc-800 text-blue-400' : 'bg-zinc-100 border-zinc-200 text-blue-700')}>
                    {(step as any).answer}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <span>{t.tutorial.progress}</span>
            <span>{Math.round(((tutorialLevel * 3 + tutorialStep) / (levels.length * 3)) * 100)}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex gap-0.5">
            {levels.map((l, lIdx) => (
              <div key={lIdx} className="flex-1 flex gap-0.5">
                {l.steps.map((s, sIdx) => (
                  <div 
                    key={sIdx}
                    className={clsx(
                      "flex-1 transition-all duration-500",
                      (lIdx < tutorialLevel || (lIdx === tutorialLevel && sIdx <= tutorialStep)) 
                        ? "bg-emerald-500" 
                        : "bg-zinc-800"
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {t.tutorial.exit}
          </button>

          <div className="flex items-center gap-3">
            {(tutorialLevel > 0 || tutorialStep > 0) && (
              <button 
                onClick={handlePrev}
                className="px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 border border-zinc-800"
              >
                <ChevronLeft className="w-4 h-4" /> {t.tutorial.previous}
              </button>
            )}
            <button 
              onClick={handleNext}
              className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2 transform hover:scale-105 active:scale-95"
            >
              {tutorialStep === level.steps.length - 1 && tutorialLevel === levels.length - 1 
                ? t.tutorial.complete 
                : (tutorialStep === level.steps.length - 1 ? t.tutorial.nextLevel : t.tutorial.next)} 
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
