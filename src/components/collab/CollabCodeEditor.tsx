import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useCollab } from '../../lib/collab/useCollab';
import { ParticipantPresence } from '../../lib/collab/types';
import { useStore } from '../../store/useStore';
import { Eye, Edit3, Lock, Shield, Check, Copy } from 'lucide-react';
import { clsx } from 'clsx';

interface CollabCodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  fileName?: string;
  className?: string;
}

export default function CollabCodeEditor({
  code,
  onChange,
  fileName = 'main.epl',
  className
}: CollabCodeEditorProps) {
  const { 
    yourRole, 
    yourColor, 
    otherUsersInFile, 
    updateCursor,
    isViewer 
  } = useCollab();

  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const computerStyle = useStore(state => state.computerStyle);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const charMeasureRef = useRef<HTMLSpanElement>(null);

  const [charDim, setCharDim] = useState({ width: 8.4, height: 24 });
  const [localSelection, setLocalSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // Measure monospace character dimensions
  useEffect(() => {
    if (charMeasureRef.current) {
      const rect = charMeasureRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Measure 100 characters for high precision
        setCharDim({
          width: rect.width / 100,
          height: rect.height
        });
      }
    }
  }, []);

  const lines = useMemo(() => code.split('\n'), [code]);

  // Convert character index in string to line and column
  const indexToLineCol = useCallback((index: number) => {
    let currentPos = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length + 1; // +1 for \n
      if (index <= currentPos + lines[i].length) {
        return { line: i, ch: Math.max(0, index - currentPos) };
      }
      currentPos += lineLen;
    }
    return { line: Math.max(0, lines.length - 1), ch: lines[lines.length - 1]?.length || 0 };
  }, [lines]);

  // Handle local cursor & selection change
  const handleCursorActivity = useCallback(() => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    setLocalSelection({ start, end });

    const startPos = indexToLineCol(start);
    const endPos = indexToLineCol(end);

    const selection = start !== end ? {
      startLine: startPos.line,
      startCh: startPos.ch,
      endLine: endPos.line,
      endCh: endPos.ch
    } : null;

    updateCursor(endPos.line, endPos.ch, selection);
  }, [indexToLineCol, updateCursor]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isViewer) {
      e.preventDefault();
      return;
    }

    // Support Tab indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;

      if (!e.shiftKey) {
        // Insert 2 spaces
        const newVal = val.substring(0, start) + '  ' + val.substring(end);
        onChange(newVal);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
            handleCursorActivity();
          }
        }, 0);
      }
    }
  };

  // Sync scroll between textarea and highlights
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Calculate non-overlapping cursor label positions
  const otherCursors = useMemo(() => {
    const list = otherUsersInFile.filter(p => p.cursor !== null);
    
    // Sort by line then ch
    list.sort((a, b) => {
      const la = a.cursor?.line || 0;
      const lb = b.cursor?.line || 0;
      if (la !== lb) return la - lb;
      return (a.cursor?.ch || 0) - (b.cursor?.ch || 0);
    });

    // Detect collisions to offset labels
    const results: Array<{
      participant: ParticipantPresence;
      x: number;
      y: number;
      labelOffsetY: number;
      selectionBoxes: Array<{ top: number; left: number; width: number; height: number }>;
    }> = [];

    const GUTTER_WIDTH = 48; // padding + line numbers
    const PADDING_TOP = 16;
    const PADDING_LEFT = 16;

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.cursor) continue;

      const cursorLine = p.cursor.line;
      const cursorCh = p.cursor.ch;

      const x = GUTTER_WIDTH + PADDING_LEFT + cursorCh * charDim.width;
      const y = PADDING_TOP + cursorLine * charDim.height;

      // Check collision with previous cursor
      let labelOffsetY = -24; // default above cursor
      if (cursorLine === 0) {
        // Line 0: place label below to avoid clipping top
        labelOffsetY = charDim.height + 4;
      } else if (i > 0) {
        const prev = results[i - 1];
        if (Math.abs(prev.y - y) < charDim.height * 1.5 && Math.abs(prev.x - x) < 90) {
          // Stagger label position so they don't cover each other
          labelOffsetY = prev.labelOffsetY === -24 ? -42 : -24;
        }
      }

      // Compute selection boxes if any
      const selectionBoxes: Array<{ top: number; left: number; width: number; height: number }> = [];
      if (p.cursor.selection) {
        const sel = p.cursor.selection;
        const minLine = Math.min(sel.startLine, sel.endLine);
        const maxLine = Math.max(sel.startLine, sel.endLine);

        for (let l = minLine; l <= maxLine; l++) {
          const lineText = lines[l] || '';
          let startCh = 0;
          let endCh = lineText.length;

          if (l === sel.startLine && l === sel.endLine) {
            startCh = Math.min(sel.startCh, sel.endCh);
            endCh = Math.max(sel.startCh, sel.endCh);
          } else if (l === minLine) {
            startCh = sel.startLine === minLine ? sel.startCh : sel.endCh;
          } else if (l === maxLine) {
            endCh = sel.startLine === maxLine ? sel.startCh : sel.endCh;
          }

          if (endCh > startCh) {
            selectionBoxes.push({
              top: PADDING_TOP + l * charDim.height,
              left: GUTTER_WIDTH + PADDING_LEFT + startCh * charDim.width,
              width: (endCh - startCh) * charDim.width,
              height: charDim.height
            });
          }
        }
      }

      results.push({
        participant: p,
        x,
        y,
        labelOffsetY,
        selectionBoxes
      });
    }

    return results;
  }, [otherUsersInFile, charDim, lines]);

  return (
    <div className={clsx(
      "flex-1 flex flex-col h-full relative overflow-hidden font-mono text-sm select-text",
      isFrutigerAero && "bg-white/40 backdrop-blur-md",
      !isFrutigerAero && (theme !== 'light' ? 'bg-zinc-950 text-zinc-200' : 'bg-white text-zinc-900'),
      computerStyle && "bg-transparent text-emerald-400",
      className
    )}>
      {/* Hidden 100-character span for sub-pixel character dimension measurement */}
      <span
        ref={charMeasureRef}
        aria-hidden="true"
        className="absolute pointer-events-none opacity-0 select-none font-mono text-sm leading-[24px]"
        style={{ whiteSpace: 'pre' }}
      >
        {'0123456789'.repeat(10)}
      </span>

      {/* Viewer Mode Banner */}
      {isViewer && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-500 font-sans flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            <span className="font-semibold">Viewer Mode:</span>
            <span>You have read-only access. The session owner can grant you Editor rights.</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
            Read-Only
          </span>
        </div>
      )}

      {/* Active typers banner */}
      <div className={clsx(
        "px-4 py-1.5 border-b text-[11px] font-sans flex items-center justify-between shrink-0 select-none",
        theme !== 'light' ? 'bg-zinc-900/80 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
      )}>
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-zinc-500 font-medium">Currently editing:</span>
          {otherUsersInFile.length === 0 ? (
            <span className="text-zinc-500 italic">Only you are on this file</span>
          ) : (
            otherUsersInFile.map(p => (
              <div key={p.uid} className="flex items-center gap-1.5 whitespace-nowrap">
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: p.color }} 
                />
                <span className="font-medium text-zinc-300">{p.name}</span>
                <span className={clsx(
                  "text-[10px] px-1.5 py-0.2 rounded font-medium",
                  p.isTyping ? "bg-emerald-500/20 text-emerald-400 animate-pulse font-semibold" : "text-zinc-500"
                )}>
                  {p.isTyping ? 'writing...' : 'viewing'}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="text-[11px] text-zinc-500 shrink-0 hidden md:block">
          Lines: {lines.length} | Collab Mode
        </div>
      </div>

      {/* Editor Surface */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Line Numbers Gutter */}
        <div 
          className={clsx(
            "w-12 py-4 select-none shrink-0 text-right pr-3 font-mono text-xs select-none border-r z-10",
            theme !== 'light' ? 'bg-zinc-900/50 border-zinc-800 text-zinc-600' : 'bg-zinc-100/70 border-zinc-200 text-zinc-400'
          )}
        >
          {lines.map((_, i) => (
            <div key={i} style={{ height: `${charDim.height}px`, lineHeight: `${charDim.height}px` }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor Main Content Area */}
        <div className="flex-1 relative overflow-hidden h-full">
          {/* Visual Overlays: Remote Selections and Cursors */}
          <div 
            className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
            style={{ 
              transform: textareaRef.current ? `translate(-${textareaRef.current.scrollLeft}px, -${textareaRef.current.scrollTop}px)` : 'none'
            }}
          >
            {/* Selection Highlights */}
            {otherCursors.flatMap((c, idx) => 
              c.selectionBoxes.map((box, bIdx) => (
                <div
                  key={`sel-${idx}-${bIdx}`}
                  className="absolute pointer-events-none rounded-xs transition-all duration-75"
                  style={{
                    top: `${box.top}px`,
                    left: `${box.left}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                    backgroundColor: `${c.participant.color}35`,
                    borderBottom: `2px solid ${c.participant.color}`
                  }}
                />
              ))
            )}

            {/* Remote Cursors with Floating User Labels */}
            {otherCursors.map(({ participant, x, y, labelOffsetY }) => (
              <div 
                key={`cursor-${participant.uid}`}
                className="absolute pointer-events-none transition-all duration-100 ease-out"
                style={{
                  top: `${y}px`,
                  left: `${x}px`
                }}
              >
                {/* Vertical Caret */}
                <div 
                  className="w-[2.5px] rounded-full animate-pulse shadow-sm"
                  style={{ 
                    height: `${charDim.height}px`, 
                    backgroundColor: participant.color,
                    boxShadow: `0 0 6px ${participant.color}80`
                  }}
                />

                {/* Floating User Label with Pointer Arrow */}
                <div 
                  className="absolute left-0 select-none z-30 transition-transform duration-100"
                  style={{
                    top: `${labelOffsetY}px`,
                    transform: 'translateX(-2px)'
                  }}
                >
                  <div 
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-sans font-bold text-white shadow-lg whitespace-nowrap"
                    style={{ 
                      backgroundColor: participant.color,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.35)'
                    }}
                  >
                    <span>{participant.name}</span>
                    {participant.isTyping && (
                      <span className="text-[9px] bg-black/25 px-1 py-0.2 rounded font-normal animate-pulse">
                        typing...
                      </span>
                    )}
                  </div>
                  {/* Downward Pointer Arrow */}
                  {labelOffsetY < 0 && (
                    <div 
                      className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] ml-1"
                      style={{ borderTopColor: participant.color }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actual Editable Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleCursorActivity}
            onSelect={handleCursorActivity}
            onClick={handleCursorActivity}
            onScroll={handleScroll}
            readOnly={isViewer}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            className={clsx(
              "w-full h-full p-4 pl-4 font-mono text-sm leading-[24px] bg-transparent resize-none outline-none z-10 block whitespace-pre overflow-auto",
              isViewer ? "cursor-default opacity-85" : "cursor-text"
            )}
            style={{
              tabSize: 2,
              lineHeight: `${charDim.height}px`
            }}
            placeholder={isViewer ? "Viewing project code..." : "Write EPL code here..."}
          />
        </div>
      </div>
    </div>
  );
}
