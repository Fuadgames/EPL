import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';

export interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  placement?: 'auto' | 'top' | 'bottom';
  computerStyleOverride?: boolean;
  'aria-label'?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
  menuClassName,
  size = 'md',
  disabled = false,
  placement = 'auto',
  computerStyleOverride,
  'aria-label': ariaLabel
}: CustomSelectProps) {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const storeComputerStyle = useStore(state => state.computerStyle);
  const computerStyle = computerStyleOverride ?? storeComputerStyle;
  const isLight = theme === 'light' && !isFrutigerAero && !computerStyle;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUpward: boolean;
  }>({
    top: 0,
    left: 0,
    width: 180,
    maxHeight: 260,
    openUpward: false
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const estimatedMenuHeight = Math.min(options.length * 38 + 12, 264);

    const spaceBelow = viewportH - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    let openUpward = false;
    if (placement === 'top') {
      openUpward = true;
    } else if (placement === 'bottom') {
      openUpward = false;
    } else {
      openUpward = spaceBelow < Math.min(estimatedMenuHeight, 180) && spaceAbove > spaceBelow;
    }

    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, availableSpace));
    const width = Math.max(rect.width, 130);
    const left = Math.min(Math.max(8, rect.left), viewportW - width - 8);
    const top = openUpward ? rect.top - 6 : rect.bottom + 6;

    setCoords({ top, left, width, maxHeight, openUpward });
  }, [options.length, placement]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const selectedIdx = options.findIndex(o => o.value === value && !o.disabled);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : options.findIndex(o => !o.disabled));

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleWindowChange = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [isOpen, updatePosition, options, value]);

  const handleSelect = (opt: CustomSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      let next = highlightedIndex;
      for (let i = 0; i < options.length; i++) {
        next = (next + 1) % options.length;
        if (!options[next].disabled) {
          setHighlightedIndex(next);
          break;
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let prev = highlightedIndex;
      for (let i = 0; i < options.length; i++) {
        prev = (prev - 1 + options.length) % options.length;
        if (!options[prev].disabled) {
          setHighlightedIndex(prev);
          break;
        }
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const active = options[highlightedIndex];
      if (active && !active.disabled) {
        handleSelect(active);
      }
    }
  };

  const triggerThemeClasses = computerStyle
    ? 'bg-black border-emerald-500/50 text-emerald-400 hover:border-emerald-400 focus-visible:ring-emerald-500/40'
    : isFrutigerAero
      ? 'bg-white/65 border-white/80 text-[#062038] hover:bg-white/80 shadow-sm backdrop-blur-md focus-visible:ring-sky-400/50'
      : isLight
        ? 'bg-white border-[#E2E5EA] text-[#111315] hover:border-slate-300 focus-visible:ring-[#059669]/35'
        : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] hover:border-[#374151] focus-visible:ring-[#10B981]/35';

  const menuThemeClasses = computerStyle
    ? 'bg-[#050806] border-emerald-500/50 text-emerald-400 shadow-[0_12px_32px_rgba(0,0,0,0.85)]'
    : isFrutigerAero
      ? 'bg-white/90 border-white text-[#062038] shadow-[0_12px_32px_rgba(14,116,144,0.2)] backdrop-blur-xl'
      : isLight
        ? 'bg-white border-[#E2E5EA] text-[#111315] shadow-[0_12px_32px_rgba(15,23,42,0.12)]'
        : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6] shadow-[0_16px_40px_rgba(0,0,0,0.6)]';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        className={clsx(
          'inline-flex items-center justify-between gap-2 rounded-lg border font-medium transition-colors outline-none focus-visible:ring-2 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left',
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          triggerThemeClasses,
          isOpen && !computerStyle && !isFrutigerAero && (isLight ? 'border-[#059669] ring-2 ring-[#059669]/20' : 'border-[#10B981] ring-2 ring-[#10B981]/20'),
          isOpen && computerStyle && 'border-emerald-400 ring-2 ring-emerald-500/25',
          className
        )}
      >
        <span className="truncate flex-1">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={clsx(
            'shrink-0 transition-transform duration-150 opacity-70',
            size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
            isOpen && 'rotate-180 opacity-100 text-[#10B981]'
          )}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              transform: coords.openUpward ? 'translateY(-100%)' : undefined,
              zIndex: 9999
            }}
            className={clsx(
              'rounded-xl border p-1.5 overflow-y-auto custom-scrollbar outline-none',
              menuThemeClasses,
              menuClassName
            )}
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                  onClick={() => handleSelect(opt)}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 rounded-lg text-left transition-colors outline-none',
                    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-pointer',
                    isSelected
                      ? computerStyle
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                        : isFrutigerAero
                          ? 'bg-sky-500/15 text-sky-800 font-semibold'
                          : isLight
                            ? 'bg-emerald-50 text-[#059669] font-semibold'
                            : 'bg-[#10B981]/15 text-[#10B981] font-semibold'
                      : isHighlighted && !opt.disabled
                        ? computerStyle
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : isFrutigerAero
                            ? 'bg-sky-500/10 text-[#062038]'
                            : isLight
                              ? 'bg-[#F5F6F8] text-[#111315]'
                              : 'bg-[#22262E] text-[#F3F4F6]'
                        : computerStyle
                          ? 'text-emerald-400/90'
                          : isFrutigerAero
                            ? 'text-[#062038]'
                            : isLight
                              ? 'text-[#374151]'
                              : 'text-[#D1D5DB]'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] opacity-65 truncate">{opt.description}</div>
                    )}
                  </div>
                  {isSelected && (
                    <Check
                      className={clsx(
                        'shrink-0',
                        size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
                        computerStyle ? 'text-emerald-400' : isFrutigerAero ? 'text-sky-600' : isLight ? 'text-[#059669]' : 'text-[#10B981]'
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
