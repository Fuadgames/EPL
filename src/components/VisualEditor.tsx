import React, { useState, useRef, useEffect } from 'react';
import { EPL_DICTIONARY, TOKEN_REGEX } from '../lib/epl-dictionary';
import { Plus, X, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';

interface VisualEditorProps {
  code: string;
  onChange: (code: string) => void;
}

export default function VisualEditor({ code, onChange }: VisualEditorProps) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const lines = code.split('\n');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState<number | null>(null);

  const entityNames = React.useMemo(() => {
    const names = new Set<string>();
    const regex = /name=([^,}]+)/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      names.add(match[1].trim());
    }
    return Array.from(names);
  }, [code]);

  const handleLineChange = (index: number, newText: string) => {
    const newLines = [...lines];
    newLines[index] = newText;
    onChange(newLines.join('\n'));
  };

  const handleSplitLine = (index: number, textBefore: string, textAfter: string) => {
    const newLines = [...lines];
    newLines.splice(index, 1, textBefore, textAfter);
    onChange(newLines.join('\n'));
    setFocusedIndex(index + 1);
    setCursorPos(0);
  };

  const handleMergeLine = (index: number, textToAppend: string) => {
    if (index === 0) return;
    const newLines = [...lines];
    const prevLineLength = newLines[index - 1].length;
    newLines[index - 1] += textToAppend;
    newLines.splice(index, 1);
    onChange(newLines.join('\n'));
    setFocusedIndex(index - 1);
    setCursorPos(prevLineLength);
  };

  const handleMoveFocus = (index: number, direction: 'up' | 'down', pos: number) => {
    if (direction === 'up' && index > 0) {
      setFocusedIndex(index - 1);
      setCursorPos(pos);
    } else if (direction === 'down' && index < lines.length - 1) {
      setFocusedIndex(index + 1);
      setCursorPos(pos);
    }
  };

  return (
    <div 
      className={clsx(
        "flex-1 h-full overflow-y-auto p-6 font-mono text-sm cursor-text", 
        isFrutigerAero && "frutiger-aero-bg",
        !isFrutigerAero && (theme !== 'light' ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-50 text-zinc-800')
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (lines.length === 0 || lines[lines.length - 1] !== '') {
            onChange(code + (code ? '\n' : ''));
            setFocusedIndex(lines.length);
            setCursorPos(0);
          } else {
            setFocusedIndex(lines.length - 1);
            setCursorPos(0);
          }
        }
      }}
    >
      {lines.map((line, i) => (
        <VisualLine 
          key={i} 
          text={line} 
          index={i}
          entityNames={entityNames}
          isFocused={focusedIndex === i}
          initialCursorPos={focusedIndex === i ? cursorPos : null}
          onChange={(t) => handleLineChange(i, t)} 
          onSplit={(before, after) => handleSplitLine(i, before, after)}
          onMerge={(append) => handleMergeLine(i, append)}
          onMoveFocus={(dir, pos) => handleMoveFocus(i, dir, pos)}
          onFocus={() => {
            setFocusedIndex(i);
            setCursorPos(null);
          }}
          onBlur={() => {
            if (focusedIndex === i) {
              setFocusedIndex(null);
            }
          }}
        />
      ))}
    </div>
  );
}

interface VisualLineProps {
  key?: any;
  text: string;
  index: number;
  entityNames: string[];
  isFocused: boolean;
  initialCursorPos: number | null;
  onChange: (t: string) => void;
  onSplit: (before: string, after: string) => void;
  onMerge: (append: string) => void;
  onMoveFocus: (dir: 'up' | 'down', pos: number) => void;
  onFocus: () => void;
  onBlur: () => void;
}

function VisualLine({ 
  text, index, entityNames, isFocused, initialCursorPos,
  onChange, onSplit, onMerge, onMoveFocus, onFocus, onBlur
}: VisualLineProps) {
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(text);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(text);
  }, [text]);

  useEffect(() => {
    if (isFocused) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [isFocused]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (initialCursorPos !== null) {
        inputRef.current.setSelectionRange(initialCursorPos, initialCursorPos);
      }
    }
  }, [isEditing, initialCursorPos]);

  const updateSuggestions = (value: string, pos: number | null) => {
    if (pos === null) {
      setSuggestions([]);
      return;
    }
    const textBeforeCursor = value.slice(0, pos);
    const match = textBeforeCursor.match(/[a-zA-Z0-9_?]+$/);
    if (match) {
      const currentWord = match[0].toLowerCase();
      const dictMatches = Object.keys(EPL_DICTIONARY).filter(k => 
        k.toLowerCase().startsWith(currentWord) && k.toLowerCase() !== currentWord
      );
      const entityMatches = entityNames.filter(n => 
        n.toLowerCase().startsWith(currentWord) && n.toLowerCase() !== currentWord
      );
      // Combine and remove duplicates
      const allMatches = Array.from(new Set([...dictMatches, ...entityMatches]));
      setSuggestions(allMatches);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    updateSuggestions(val, e.target.selectionStart);
    onChange(val);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only update suggestions on navigation keys to track cursor
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      updateSuggestions(inputValue, e.currentTarget.selectionStart);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const pos = inputRef.current?.selectionStart || inputValue.length;
        const textBeforeCursor = inputValue.slice(0, pos);
        const textAfterCursor = inputValue.slice(pos);
        const match = textBeforeCursor.match(/[a-zA-Z0-9_?]+$/);
        
        if (match) {
          const wordStart = pos - match[0].length;
          const selectedWord = suggestions[selectedIndex];
          const newValue = inputValue.slice(0, wordStart) + selectedWord + textAfterCursor;
          setInputValue(newValue);
          setSuggestions([]);
          
          setTimeout(() => {
            if (inputRef.current) {
              const newPos = wordStart + selectedWord.length;
              inputRef.current.setSelectionRange(newPos, newPos);
            }
          }, 0);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestions([]);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const pos = inputRef.current?.selectionStart || 0;
      const newValue = inputValue.slice(0, pos) + '  ' + inputValue.slice(pos);
      setInputValue(newValue);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(pos + 2, pos + 2);
        }
      }, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pos = inputRef.current?.selectionStart || 0;
      const textBefore = inputValue.slice(0, pos);
      const textAfter = inputValue.slice(pos);
      
      // Auto-indent: calculate indentation of current line
      const indentMatch = textBefore.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      
      onChange(textBefore);
      onSplit(textBefore, indent + textAfter.trimStart());
    } else if (e.key === 'Backspace' && (inputRef.current?.selectionStart === 0 && inputRef.current?.selectionEnd === 0)) {
      e.preventDefault();
      onMerge(inputValue);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMoveFocus('up', inputRef.current?.selectionStart || 0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMoveFocus('down', inputRef.current?.selectionStart || 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      onBlur();
    }
  };

  const handleBlur = () => {
    // Delay blur to allow clicking on suggestions
    setTimeout(() => {
      onChange(inputValue);
      setIsEditing(false);
      setSuggestions([]);
      onBlur();
    }, 150);
  };

  const applySuggestion = (suggestion: string) => {
    const pos = inputRef.current?.selectionStart || inputValue.length;
    const textBeforeCursor = inputValue.slice(0, pos);
    const textAfterCursor = inputValue.slice(pos);
    const match = textBeforeCursor.match(/[a-zA-Z0-9_?]+$/);
    
    if (match) {
      const wordStart = pos - match[0].length;
      const newValue = inputValue.slice(0, wordStart) + suggestion + textAfterCursor;
      setInputValue(newValue);
      setSuggestions([]);
      
      setTimeout(() => {
        if (inputRef.current) {
          const newPos = wordStart + suggestion.length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 my-1 relative">
        <span className={clsx("w-6 text-right select-none", isFrutigerAero ? "text-blue-800/60" : "text-zinc-600")}>{index + 1}</span>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onClick={(e) => updateSuggestions(inputValue, e.currentTarget.selectionStart)}
            onBlur={handleBlur}
            className={clsx(
              "w-full border rounded px-2 py-1 outline-none font-mono",
              isFrutigerAero ? "bg-white/50 border-blue-400 text-blue-900" : "bg-zinc-900 border-emerald-500/50 text-zinc-200"
            )}
            autoComplete="off"
            spellCheck="false"
          />
          {suggestions.length > 0 && (
            <div className={clsx("absolute top-full left-0 mt-1 w-64 border rounded-lg shadow-xl z-50 overflow-hidden", isFrutigerAero ? "bg-white/80 border-blue-400" : "bg-zinc-800 border-zinc-700")}>
              {suggestions.map((s, i) => {
                const def = EPL_DICTIONARY[s];
                return (
                  <div 
                    key={s}
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                    className={clsx(
                      "px-3 py-1.5 cursor-pointer flex items-center justify-between text-sm",
                      i === selectedIndex 
                        ? (isFrutigerAero ? "bg-blue-500/30 text-blue-900" : "bg-emerald-500/20 text-emerald-400") 
                        : (isFrutigerAero ? "text-blue-800 hover:bg-white/50" : "text-zinc-300 hover:bg-zinc-700/50")
                    )}
                  >
                    <span className="font-mono">{s}</span>
                    <span className={clsx("text-xs opacity-50 capitalize", isFrutigerAero ? "text-blue-800" : "")}>{def?.type || 'Entity'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Parse text into tokens
  const parts = text.split(TOKEN_REGEX);
  
  return (
    <div className="flex items-start gap-2 my-1 min-h-[28px] group">
      <span className={clsx("w-6 text-right select-none pt-1", isFrutigerAero ? "text-blue-800/60" : "text-zinc-600")}>{index + 1}</span>
      <div 
        className={clsx(
          "flex-1 flex flex-wrap items-center gap-x-1 gap-y-2 py-1 px-2 rounded cursor-text min-h-[28px]",
          isFrutigerAero ? "hover:bg-white/30 text-blue-900" : "hover:bg-zinc-800/30 text-zinc-300"
        )}
        onClick={() => onFocus()}
      >
        {parts.length === 1 && !parts[0] ? (
          <span className={clsx("italic opacity-50", isFrutigerAero ? "text-blue-800" : "text-zinc-600")}>Empty line... (click to edit)</span>
        ) : (
          parts.map((part, i) => {
            const mod = i % 4;
            if (mod === 0) {
              // Plain text
              return part ? <span key={i} className={clsx("whitespace-pre", isFrutigerAero ? "text-blue-900" : "text-zinc-300")}>{part}</span> : null;
            } else if (mod === 1) {
              // Keyword
              const keyword = part;
              const settingsStr = parts[i + 1];
              if (!keyword) return null;
              return (
                <Token 
                  key={i} 
                  keyword={keyword} 
                  settingsStr={settingsStr} 
                  entityNames={entityNames}
                  onUpdateSettings={(newSettings) => {
                    const newParts = [...parts];
                    newParts[i + 1] = newSettings;
                    
                    // Reconstruct string
                    let newLine = '';
                    for (let j = 0; j < newParts.length; j += 4) {
                      newLine += newParts[j] || '';
                      if (newParts[j + 1]) {
                        newLine += newParts[j + 1];
                        if (newParts[j + 2] !== undefined && newParts[j + 2] !== null) {
                          newLine += '{' + newParts[j + 2] + '}';
                        }
                      }
                      if (newParts[j + 3]) {
                        newLine += newParts[j + 3];
                      }
                    }
                    onChange(newLine);
                  }}
                />
              );
            } else if (mod === 3) {
              // Comment
              return part ? <span key={i} className={clsx("italic", isFrutigerAero ? "text-blue-800/70" : "text-zinc-500")}>{part}</span> : null;
            }
            return null;
          })
        )}
      </div>
    </div>
  );
}

function Token({ keyword, settingsStr, entityNames, onUpdateSettings }: { keyword: string, settingsStr: string | undefined, entityNames: string[], onUpdateSettings: (s: string | undefined) => void, key?: React.Key }) {
  const [showPopover, setShowPopover] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const def = EPL_DICTIONARY[keyword];
  
  // Parse settings string into object
  const settingsObj: Record<string, string> = {};
  if (settingsStr) {
    settingsStr.split(',').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k && v) settingsObj[k.trim()] = v.trim();
    });
  }

  const [localSettings, setLocalSettings] = useState(settingsObj);

  useEffect(() => {
    setLocalSettings(settingsObj);
  }, [settingsStr]);

  if (!def) return <span>{keyword}</span>;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStr = Object.entries(localSettings)
      .filter(([_, v]) => v !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    
    onUpdateSettings(newStr.length > 0 ? newStr : undefined);
    setShowPopover(false);
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <span 
        onClick={(e) => {
          e.stopPropagation();
          if (def.schema) setShowPopover(true);
        }}
        className={clsx(
          "font-bold border-b-2 cursor-pointer transition-colors",
          def.color,
          def.schema ? "border-current hover:opacity-80" : "border-transparent cursor-default"
        )}
      >
        {keyword}
      </span>
      
      {settingsStr && (
        <span 
          onClick={(e) => {
            e.stopPropagation();
            if (def.schema) setShowPopover(true);
          }}
          className="text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors flex items-center"
        >
          <span className="text-zinc-500">{"{"}</span>
          {settingsStr.split(',').map((part, i, arr) => {
            const hasEquals = part.includes('=');
            const [k, ...vParts] = part.split('=');
            const v = vParts.join('=');
            return (
              <React.Fragment key={i}>
                <span className="text-blue-400">{k?.trim()}</span>
                {hasEquals && (
                  <>
                    <span className="text-zinc-500">=</span>
                    <span className="text-orange-400">{v?.trim()}</span>
                  </>
                )}
                {i < arr.length - 1 && <span className="text-zinc-500">, </span>}
              </React.Fragment>
            );
          })}
          <span className="text-zinc-500">{"}"}</span>
        </span>
      )}

      {showPopover && def.schema && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowPopover(false); }} />
          <div 
            className={clsx(
              "z-50 p-4 bg-zinc-900 border border-zinc-700 shadow-2xl",
              "fixed inset-4 sm:absolute sm:top-full sm:left-0 sm:mt-2 sm:w-64 sm:rounded-xl sm:inset-auto"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-zinc-200 capitalize">{keyword} Settings</h4>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowHelpModal(true); }}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors rounded-full p-1 hover:bg-zinc-800"
                  title="Show Information"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowPopover(false); }} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="space-y-3">
              {Object.entries(def.schema).map(([key, type]) => (
                <div key={key}>
                  <label className="block text-xs text-zinc-400 mb-1 capitalize">{key}</label>
                  {key === 'color' || key === 'background' ? (
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={localSettings[key] || '#ffffff'}
                        onChange={(e) => setLocalSettings({ ...localSettings, [key]: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <input
                        type="text"
                        value={localSettings[key] || ''}
                        onChange={(e) => setLocalSettings({ ...localSettings, [key]: e.target.value })}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                        placeholder={`Enter ${key}...`}
                      />
                    </div>
                  ) : (
                    <>
                      <input
                        type={type === 'number' ? 'number' : 'text'}
                        value={localSettings[key] || ''}
                        onChange={(e) => setLocalSettings({ ...localSettings, [key]: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                        placeholder={`Enter ${key}...`}
                        list={key === 'target' || key === 'name' ? `autocomplete-${keyword}-${key}` : undefined}
                      />
                      {(key === 'target' || key === 'name') && (
                        <datalist id={`autocomplete-${keyword}-${key}`}>
                          {entityNames.map(name => <option key={name} value={name} />)}
                        </datalist>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            
            <button 
              onClick={handleSave}
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Apply
            </button>
          </div>
        </>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowHelpModal(false); }} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white capitalize">{keyword} Information</h3>
              <button onClick={(e) => { e.stopPropagation(); setShowHelpModal(false); }} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-zinc-300 text-sm leading-relaxed">
              {def.description}
            </div>
            {def.schema && (
              <div className="mt-2">
                <h4 className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Available Parameters</h4>
                <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-3 space-y-2">
                  {Object.entries(def.schema).map(([key, type]) => (
                    <div key={key} className="flex justify-between items-center border-b border-zinc-800/50 last:border-0 pb-2 last:pb-0">
                      <span className="font-mono text-emerald-400 text-xs">{key}</span>
                      <span className="font-mono text-zinc-500 text-xs">{type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setShowHelpModal(false); }}
              className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
