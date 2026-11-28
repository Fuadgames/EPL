import React, { useEffect, useRef, useState } from 'react';
import { EPLInterpreter, EPLEntity, EPLUpdateMeta } from '../lib/epl-interpreter';
import AppPreview from './AppPreview';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';

interface EplEmbeddedRunnerProps {
  code: string;
  height?: number;
  className?: string;
  compact?: boolean;
  title?: string;
}

export default function EplEmbeddedRunner({
  code,
  height = 240,
  className = '',
  compact = false,
  title,
}: EplEmbeddedRunnerProps) {
  const aiAnswerMode = useStore((s) => s.aiAnswerMode);
  const aiChangesEnabled = useStore((s) => s.aiChangesEnabled);
  const userData = useStore((s) => s.userData);
  const isPremium = useStore((s) => s.isPremium);
  const projectFiles = useStore((s) => s.projectFiles);

  const [uiState, setUiState] = useState<{
    entities: Record<string, EPLEntity>;
    variables: Record<string, any>;
    camera: EPLUpdateMeta['camera'] | null;
    uiMode?: { type: string; target?: string } | null;
  }>({
    entities: {},
    variables: {},
    camera: null,
    uiMode: null,
  });

  const interpreterRef = useRef<EPLInterpreter | null>(null);

  useEffect(() => {
    const trimmed = (code || '').trim();
    if (!trimmed) {
      setUiState({ entities: {}, variables: {}, camera: null, uiMode: null });
      return;
    }

    const interp = new EPLInterpreter(
      () => {},
      (entities, uiMode, meta) => {
        setUiState({
          entities: { ...entities },
          variables: meta?.variables || {},
          camera: meta?.camera || null,
          uiMode: uiMode || null,
        });
      },
      { answerMode: aiAnswerMode, changesEnabled: aiChangesEnabled },
      userData?.purchasedItems || [],
      Boolean(isPremium || userData?.isPremium),
      [...(userData?.uploadedFiles || []), ...(projectFiles || [])]
    );
    interpreterRef.current = interp;
    interp.run(trimmed).catch(() => {});

    return () => {
      interp.stop();
      interpreterRef.current = null;
    };
  }, [code, aiAnswerMode, aiChangesEnabled, isPremium]);

  const handleUIEvent = (eventName: string, target?: string, value?: string) => {
    interpreterRef.current?.triggerEvent(eventName, target, value);
  };

  if (!(code || '').trim()) return null;

  return (
    <div
      className={clsx(
        'relative w-full overflow-hidden rounded-xl border border-current/15 bg-[#090d16]',
        compact && 'rounded-lg',
        className
      )}
      style={{ height }}
      aria-label={title}
    >
      {title && !compact && (
        <div className="pointer-events-none absolute top-2 left-2.5 z-20 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-sm border border-white/10 text-[10px] font-mono font-semibold text-white/80">
          {title}
        </div>
      )}
      <AppPreview
        entities={uiState.entities}
        variables={uiState.variables}
        camera={uiState.camera}
        uiMode={uiState.uiMode}
        handleUIEvent={handleUIEvent}
        showGrid={false}
      />
    </div>
  );
}
