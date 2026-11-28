import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { isRtlLanguage } from '../lib/languages';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'SVG',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
  'TEXTAREA',
]);

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'] as const;

const PROTECTED_EXACT = new Set([
  'EPL',
  'EPL Studio',
  'EPLCoins',
  'EPL Shop',
  'DRPL',
  'DRPL v2',
  'difrenopt Studio',
  'AllBIOS',
  'Frutiger Aero',
  'GitHub',
  'Google',
  'Firebase',
  'Stripe',
  'WebGL',
  '2D',
  '3D',
  'FPS',
  'IDE',
  'API',
  'URL',
  'UUID',
  'UID',
  'ID',
  'OS',
  'PC',
  'UI',
  'RGB',
  'HTML',
  'CSS',
  'JSON',
  'OK',
  'ESC',
  'WASD',
  'Ctrl+B',
  'Ctrl+S',
  'Tab / Enter',
]);

const CACHE_PREFIX = 'epl_i18n_v3_';
const memoryCache = new Map<string, Map<string, string>>();
const sourceTextMap = new WeakMap<Text, string>();
const translatedTextMap = new WeakMap<Text, string>();
const attrSourceMap = new WeakMap<Element, Map<string, string>>();
const attrTranslatedMap = new WeakMap<Element, Map<string, string>>();

function cleanupLegacyStorageCaches() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('epl_i18n_v1_') || k.startsWith('epl_i18n_v2_'))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

function getLangCache(lang: string): Map<string, string> {
  let map = memoryCache.get(lang);
  if (map) return map;
  map = new Map<string, string>();
  try {
    cleanupLegacyStorageCaches();
    const raw = localStorage.getItem(`${CACHE_PREFIX}${lang}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([k, v]) => {
          if (typeof v === 'string' && v.trim()) map!.set(k, v);
        });
      }
    }
  } catch {
    // ignore storage errors
  }
  memoryCache.set(lang, map);
  return map;
}

function clearLangCache(lang: string) {
  memoryCache.delete(lang);
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${lang}`);
  } catch {
    // ignore
  }
}

function saveLangCache(lang: string, map: Map<string, string>) {
  try {
    const entries = Array.from(map.entries());
    const trimmed = entries.length > 2500 ? entries.slice(entries.length - 2500) : entries;
    if (entries.length > 2500) {
      map.clear();
      trimmed.forEach(([k, v]) => map.set(k, v));
    }
    const obj: Record<string, string> = {};
    trimmed.forEach(([k, v]) => {
      obj[k] = v;
    });
    localStorage.setItem(`${CACHE_PREFIX}${lang}`, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

function isExcludedElement(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (SKIP_TAGS.has(cur.tagName)) return true;
    if (cur.getAttribute('data-no-translate') === 'true') return true;
    if (cur.getAttribute('contenteditable') === 'true') return true;
    const cls = cur.className;
    if (
      typeof cls === 'string' &&
      (cls.includes('cm-editor') || cls.includes('epl-code-editor'))
    ) {
      return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

function shouldSkipText(raw: string, targetLang: string, autoTranslateEnabled: boolean): boolean {
  if (!autoTranslateEnabled) return true;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 500) return true;
  if (!/[\p{L}]/u.test(trimmed)) return true;
  if (PROTECTED_EXACT.has(trimmed)) return true;
  if (/^(https?:\/\/|\/|mailto:|data:)/i.test(trimmed)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  if (/^[\d\s.,:%+\-*/()=<>[\]{}|#@$€₽]+$/.test(trimmed)) return true;
  if (/^[A-Z0-9_.\-/+]{1,6}$/.test(trimmed)) return true;
  if (
    trimmed.includes('{') &&
    trimmed.includes('}') &&
    /\b(create|move|background|started\?|frame\?|clicked\?|text|rect|circle|button)\b/.test(trimmed)
  ) {
    return true;
  }

  // In Russian mode, translate strings that still contain untranslated Latin words (without Cyrillic)
  if (targetLang === 'ru') {
    const hasLatinWords = /[a-zA-Z]{2,}/.test(trimmed);
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(trimmed);
    if (!hasLatinWords || hasCyrillic) return true;
  }

  // In English mode, translate strings that contain Cyrillic letters
  if (targetLang === 'en') {
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(trimmed);
    if (!hasCyrillic) return true;
  }

  return false;
}

function applyWithOuterWhitespace(original: string, translated: string): string {
  const lead = original.match(/^\s*/)?.[0] || '';
  const trail = original.match(/\s*$/)?.[0] || '';
  return `${lead}${translated}${trail}`;
}

function emitStatus(translating: boolean, language: string) {
  window.dispatchEvent(
    new CustomEvent('epl:translation-status', {
      detail: { translating, language },
    })
  );
}

export default function SiteTranslator() {
  const language = useStore((state) => state.language);
  const autoTranslateEnabled = useStore((state) => state.autoTranslateEnabled);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = language || 'en';
    html.dir = isRtlLanguage(language) ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    let rafHandle: number | null = null;
    let timerHandle: number | null = null;
    let isFlushing = false;
    const pendingStrings = new Set<string>();
    const failedStrings = new Set<string>();

    let cache = getLangCache(language);

    const resolveSourceForText = (node: Text): string => {
      const current = node.nodeValue || '';
      const lastTranslated = translatedTextMap.get(node);
      if (lastTranslated !== undefined && current === lastTranslated) {
        return sourceTextMap.get(node) ?? current;
      }
      sourceTextMap.set(node, current);
      translatedTextMap.delete(node);
      return current;
    };

    const resolveSourceForAttr = (el: Element, attr: string): string => {
      const current = el.getAttribute(attr) || '';
      let sMap = attrSourceMap.get(el);
      if (!sMap) {
        sMap = new Map();
        attrSourceMap.set(el, sMap);
      }
      let tMap = attrTranslatedMap.get(el);
      if (!tMap) {
        tMap = new Map();
        attrTranslatedMap.set(el, tMap);
      }
      const lastTranslated = tMap.get(attr);
      if (lastTranslated !== undefined && current === lastTranslated) {
        return sMap.get(attr) ?? current;
      }
      sMap.set(attr, current);
      tMap.delete(attr);
      return current;
    };

    const applyTranslationToNode = (node: Text) => {
      if (!node.isConnected) return;
      if (isExcludedElement(node.parentElement)) return;
      const src = resolveSourceForText(node);
      const trimmed = src.trim();

      if (shouldSkipText(src, language, autoTranslateEnabled)) {
        if ((node.nodeValue || '') !== src) {
          node.nodeValue = src;
        }
        translatedTextMap.delete(node);
        return;
      }

      const cached = cache.get(trimmed);
      if (cached) {
        const nextVal = applyWithOuterWhitespace(src, cached);
        if (node.nodeValue !== nextVal) {
          translatedTextMap.set(node, nextVal);
          node.nodeValue = nextVal;
        }
      } else if (!failedStrings.has(trimmed)) {
        pendingStrings.add(trimmed);
      }
    };

    const applyTranslationToElementAttrs = (el: Element) => {
      if (!el.isConnected || isExcludedElement(el)) return;
      for (const attr of TRANSLATABLE_ATTRS) {
        if (!el.hasAttribute(attr)) continue;
        const src = resolveSourceForAttr(el, attr);
        const trimmed = src.trim();
        if (shouldSkipText(src, language, autoTranslateEnabled)) {
          if (el.getAttribute(attr) !== src) {
            el.setAttribute(attr, src);
          }
          attrTranslatedMap.get(el)?.delete(attr);
          continue;
        }
        const cached = cache.get(trimmed);
        if (cached) {
          const nextVal = applyWithOuterWhitespace(src, cached);
          if (el.getAttribute(attr) !== nextVal) {
            let tMap = attrTranslatedMap.get(el);
            if (!tMap) {
              tMap = new Map();
              attrTranslatedMap.set(el, tMap);
            }
            tMap.set(attr, nextVal);
            el.setAttribute(attr, nextVal);
          }
        } else if (!failedStrings.has(trimmed)) {
          pendingStrings.add(trimmed);
        }
      }
    };

    const scanSubtree = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        applyTranslationToNode(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const rootEl = root as Element;
      if (isExcludedElement(rootEl)) return;

      applyTranslationToElementAttrs(rootEl);

      const walker = document.createTreeWalker(
        rootEl,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
          acceptNode(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              return isExcludedElement(node as Element)
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      let current: Node | null = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          applyTranslationToNode(current as Text);
        } else if (current.nodeType === Node.ELEMENT_NODE) {
          applyTranslationToElementAttrs(current as Element);
        }
        current = walker.nextNode();
      }
    };

    const translateChunk = async (chunk: string[]) => {
      if (cancelled || chunk.length === 0) return;
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetLang: language, texts: chunk }),
        });
        if (!res.ok) {
          chunk.forEach((s) => failedStrings.add(s));
          return;
        }
        const data = await res.json();
        if (data?.backendSucceeded === false) {
          chunk.forEach((s) => failedStrings.add(s));
          return;
        }
        if (Array.isArray(data?.translations)) {
          let updated = false;
          chunk.forEach((src, idx) => {
            const tr = data.translations[idx];
            if (typeof tr === 'string' && tr.trim()) {
              cache.set(src, tr.trim());
              updated = true;
            }
          });
          if (updated && !cancelled) {
            saveLangCache(language, cache);
            if (document.body) {
              scanSubtree(document.body);
            }
          }
        }
      } catch {
        chunk.forEach((s) => failedStrings.add(s));
      }
    };

    const flushBatch = async () => {
      if (cancelled || !autoTranslateEnabled || isFlushing) return;
      isFlushing = true;
      emitStatus(true, language);
      try {
        while (!cancelled && autoTranslateEnabled && pendingStrings.size > 0) {
          const list = Array.from(pendingStrings).filter(
            (s) => !cache.has(s) && !failedStrings.has(s)
          );
          pendingStrings.clear();
          if (list.length === 0) break;

          for (let i = 0; i < list.length; i += 35) {
            if (cancelled || !autoTranslateEnabled) break;
            const chunk = list.slice(i, i + 35);
            await translateChunk(chunk);
          }
        }
      } finally {
        isFlushing = false;
        if (!cancelled) {
          emitStatus(false, language);
        }
      }
    };

    const scheduleFlush = () => {
      if (!autoTranslateEnabled) return;
      if (timerHandle !== null) window.clearTimeout(timerHandle);
      timerHandle = window.setTimeout(() => {
        timerHandle = null;
        void flushBatch();
      }, 80);
    };

    const runFullScan = () => {
      if (cancelled || !document.body) return;
      scanSubtree(document.body);
      if (pendingStrings.size > 0) {
        scheduleFlush();
      }
    };

    const handleManualRetranslate = () => {
      if (cancelled) return;
      clearLangCache(language);
      cache = getLangCache(language);
      pendingStrings.clear();
      failedStrings.clear();
      runFullScan();
    };

    window.addEventListener('epl:retranslate', handleManualRetranslate);
    rafHandle = requestAnimationFrame(runFullScan);

    const observer = new MutationObserver((mutations) => {
      if (cancelled) return;
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => scanSubtree(n));
        } else if (m.type === 'characterData') {
          applyTranslationToNode(m.target as Text);
        } else if (m.type === 'attributes' && m.target instanceof Element) {
          applyTranslationToElementAttrs(m.target);
        }
      }
      if (pendingStrings.size > 0) {
        scheduleFlush();
      }
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title', 'aria-label'],
      });
    }

    return () => {
      cancelled = true;
      emitStatus(false, language);
      window.removeEventListener('epl:retranslate', handleManualRetranslate);
      observer.disconnect();
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      if (timerHandle !== null) window.clearTimeout(timerHandle);
    };
  }, [language, autoTranslateEnabled]);

  return null;
}
