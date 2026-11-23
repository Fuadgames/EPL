import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Bold,
  Code,
  Edit3,
  Eye,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  Loader2,
  Newspaper,
  Plus,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Upload,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { useStore } from '../store/useStore';
import { confirmAction, notify } from '../store/useDialogStore';
import { getDefaultAvatar } from '../lib/avatar';
import UserRoleBadge from './UserRoleBadge';

type NewsFont = 'sans' | 'serif' | 'mono' | 'display' | 'cursive';

export interface NewsPost {
  id: string;
  title: string;
  content: string;
  font: NewsFont;
  images: string[];
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt: string;
}

const FONT_OPTIONS: {
  value: NewsFont;
  labelEn: string;
  labelRu: string;
  className: string;
  sampleStyle: React.CSSProperties;
}[] = [
  {
    value: 'sans',
    labelEn: 'Clean Sans',
    labelRu: 'Sans (Обычный)',
    className: 'font-sans',
    sampleStyle: { fontFamily: 'var(--font-sans)' },
  },
  {
    value: 'display',
    labelEn: 'Display',
    labelRu: 'Display (Крупный)',
    className: 'font-[family-name:var(--font-display)]',
    sampleStyle: { fontFamily: 'var(--font-display)' },
  },
  {
    value: 'serif',
    labelEn: 'Editorial Serif',
    labelRu: 'Serif (Журнальный)',
    className: 'font-serif',
    sampleStyle: { fontFamily: 'Georgia, Cambria, "Times New Roman", serif' },
  },
  {
    value: 'mono',
    labelEn: 'Dev Mono',
    labelRu: 'Mono (Код)',
    className: 'font-mono',
    sampleStyle: { fontFamily: 'var(--font-mono)' },
  },
  {
    value: 'cursive',
    labelEn: 'Curve / Script',
    labelRu: 'Curve (Наклонный)',
    className: 'italic font-serif',
    sampleStyle: { fontFamily: 'Georgia, "Brush Script MT", cursive', fontStyle: 'italic' },
  },
];

function getFontStyle(font: NewsFont): React.CSSProperties {
  const found = FONT_OPTIONS.find((f) => f.value === font);
  return found ? found.sampleStyle : FONT_OPTIONS[0].sampleStyle;
}

function isSafeImageSrc(src: string): boolean {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/')
  );
}

/**
 * Safely parses inline rich-text formatting markers into React nodes (never uses raw HTML injection):
 * **bold**, *curve/italic*, __underline__, ~~strike~~, ++highlight++, `code`
 */
function renderInlineTokens(text: string, depth = 0): React.ReactNode[] {
  if (!text) return [];
  if (depth > 4) return [text];

  const pattern = /(\*\*(?:(?!\*\*).)+\*\*|\*[^*\n]+?\*|__(?:(?!__).)+__|~~(?:(?!~~).)+~~|\+\+(?:(?!\+\+).)+\+\+|`[^`\n]+?`)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `tok_${depth}_${keyCounter++}_${match.index}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key} className="font-extrabold">
          {renderInlineTokens(token.slice(2, -2), depth + 1)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key} className="italic font-serif tracking-[0.015em]">
          {renderInlineTokens(token.slice(1, -1), depth + 1)}
        </em>
      );
    } else if (token.startsWith('__') && token.endsWith('__')) {
      nodes.push(
        <span key={key} className="underline decoration-emerald-500/80 decoration-2 underline-offset-4">
          {renderInlineTokens(token.slice(2, -2), depth + 1)}
        </span>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push(
        <span key={key} className="line-through opacity-70">
          {renderInlineTokens(token.slice(2, -2), depth + 1)}
        </span>
      );
    } else if (token.startsWith('++') && token.endsWith('++')) {
      nodes.push(
        <mark key={key} className="px-1 py-0.5 rounded bg-amber-400/25 text-inherit font-medium">
          {renderInlineTokens(token.slice(2, -2), depth + 1)}
        </mark>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-mono text-[0.88em] border border-emerald-500/20"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function RichNewsBody({ content, font }: { content: string; font: NewsFont }) {
  const paragraphs = useMemo(() => (content || '').split(/\n/), [content]);
  return (
    <div style={getFontStyle(font)} className="space-y-2.5 text-[15px] leading-relaxed break-words">
      {paragraphs.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} className="h-2" />;
        }
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {renderInlineTokens(line)}
          </p>
        );
      })}
    </div>
  );
}

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 135000 && quality > 0.3) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > 145000) {
          // Downscale further if still large
          const smallCanvas = document.createElement('canvas');
          smallCanvas.width = Math.max(1, Math.round(width * 0.65));
          smallCanvas.height = Math.max(1, Math.round(height * 0.65));
          const sctx = smallCanvas.getContext('2d');
          if (sctx) {
            sctx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);
            dataUrl = smallCanvas.toDataURL('image/jpeg', 0.65);
          }
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export default function NewsView() {
  const theme = useStore((state) => state.theme);
  const isFrutigerAero = useStore((state) => state.isFrutigerAero);
  const language = useStore((state) => state.language);
  const user = useStore((state) => state.user);
  const userData = useStore((state) => state.userData);
  const simulatedRole = useStore((state) => state.simulatedRole);

  const actualRole = userData?.role || 'user';
  const effectiveRole = actualRole === 'developer' && simulatedRole ? simulatedRole : actualRole;
  const isDeveloper = effectiveRole === 'developer';
  const isLight = theme === 'light' && !isFrutigerAero;

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Composer Modal state (Developer only)
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [font, setFont] = useState<NewsFont>('sans');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [composerTab, setComposerTab] = useState<'write' | 'preview'>('write');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoadWarning(null);
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: NewsPost[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<NewsPost, 'id'>),
        }));
        setPosts(items);
        setLoading(false);
        setLoadWarning(null);
      },
      (err: any) => {
        setLoading(false);
        const msg = String(err?.message || '').toLowerCase();
        if (err?.code === 'permission-denied' || msg.includes('permission')) {
          try {
            handleFirestoreError(err, OperationType.LIST, 'news');
          } catch (wrapped) {
            setFatalError(wrapped as Error);
          }
        } else {
          setLoadWarning(err?.message || 'Unable to load news right now.');
        }
      }
    );
    return () => unsub();
  }, [reloadTick]);

  if (fatalError) {
    throw fatalError;
  }

  const resetComposer = () => {
    setEditingPostId(null);
    setTitle('');
    setContent('');
    setFont('sans');
    setImages([]);
    setImageUrlInput('');
    setComposerTab('write');
  };

  const openCreateModal = () => {
    if (!isDeveloper) return;
    resetComposer();
    setIsComposerOpen(true);
  };

  const openEditModal = (post: NewsPost) => {
    if (!isDeveloper) return;
    setEditingPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setFont(post.font || 'sans');
    setImages(Array.isArray(post.images) ? post.images : []);
    setImageUrlInput('');
    setComposerTab('write');
    setIsComposerOpen(true);
  };

  const applyFormatToSelection = (prefix: string, suffix: string, fallbackWord: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}${prev ? ' ' : ''}${prefix}${fallbackWord}${suffix}`);
      return;
    }

    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const selected = content.slice(start, end);

    let nextContent = '';
    let nextSelStart = start;
    let nextSelEnd = end;

    if (selected.length > 0) {
      // Handle multi-line selection per line so markdown inline tokens render properly on each line
      if (selected.includes('\n')) {
        const formattedMulti = selected
          .split('\n')
          .map((line) => (line.trim() ? `${prefix}${line}${suffix}` : line))
          .join('\n');
        nextContent = content.slice(0, start) + formattedMulti + content.slice(end);
        nextSelStart = start;
        nextSelEnd = start + formattedMulti.length;
      } else if (selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length >= prefix.length + suffix.length) {
        const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
        nextContent = content.slice(0, start) + unwrapped + content.slice(end);
        nextSelStart = start;
        nextSelEnd = start + unwrapped.length;
      } else {
        const wrapped = `${prefix}${selected}${suffix}`;
        nextContent = content.slice(0, start) + wrapped + content.slice(end);
        nextSelStart = start + prefix.length;
        nextSelEnd = start + prefix.length + selected.length;
      }
    } else {
      const wrapped = `${prefix}${fallbackWord}${suffix}`;
      nextContent = content.slice(0, start) + wrapped + content.slice(end);
      nextSelStart = start + prefix.length;
      nextSelEnd = start + prefix.length + fallbackWord.length;
    }

    setContent(nextContent);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextSelStart, nextSelEnd);
      }
    });
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
      notify.info(
        language === 'ru'
          ? 'Укажите корректную ссылку, начинающуюся с https:// или http://'
          : 'Please enter a valid URL starting with https:// or http://'
      );
      return;
    }
    if (images.length >= 6) {
      notify.info(language === 'ru' ? 'Максимум 6 изображений на новость' : 'Maximum 6 images per post');
      return;
    }
    setImages((prev) => [...prev, trimmed]);
    setImageUrlInput('');
  };

  const handleUploadImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;

    const remaining = 6 - images.length;
    if (remaining <= 0) {
      notify.info(language === 'ru' ? 'Максимум 6 изображений на новость' : 'Maximum 6 images per post');
      return;
    }

    const batch = files.slice(0, remaining);
    setIsUploadingImage(true);
    try {
      const added: string[] = [];
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        if (!file.type.startsWith('image/')) continue;

        let url = '';
        try {
          const storageRef = ref(storage, `users/${user.uid}/news_${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
          await uploadBytes(storageRef, file);
          url = await getDownloadURL(storageRef);
        } catch {
          // Reliable compressed data URL fallback within Firestore rules size budget
          url = await compressImageToDataUrl(file);
        }

        if (url && url.length <= 148000) {
          added.push(url);
        }
      }
      if (added.length > 0) {
        setImages((prev) => [...prev, ...added].slice(0, 6));
        notify.success(
          language === 'ru'
            ? `Добавлено изображений: ${added.length}`
            : `Added ${added.length} image(s)`
        );
      }
    } catch (err: any) {
      notify.error(err?.message || (language === 'ru' ? 'Ошибка загрузки изображения' : 'Failed to upload image'));
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDeveloper || !user) return;

    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle) {
      notify.info(language === 'ru' ? 'Введите заголовок новости' : 'Please enter a news title');
      return;
    }
    if (!cleanContent) {
      notify.info(language === 'ru' ? 'Напишите текст новости' : 'Please write some news content');
      return;
    }

    setIsPublishing(true);
    const now = new Date().toISOString();
    const existingPost = editingPostId ? posts.find((p) => p.id === editingPostId) : undefined;
    const postId = existingPost?.id || `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload: NewsPost = {
      id: postId,
      title: cleanTitle.slice(0, 200),
      content: cleanContent.slice(0, 25000),
      font,
      images: images.filter((img) => isSafeImageSrc(img) && img.length <= 150000).slice(0, 6),
      authorId: existingPost?.authorId || user.uid,
      authorName: (userData?.name || user.displayName || 'Developer').slice(0, 100),
      authorAvatar: (user.photoURL || userData?.avatarUrl || getDefaultAvatar(user.uid)).slice(0, 2048),
      createdAt: existingPost?.createdAt || now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'news', postId), payload);
      notify.success(
        editingPostId
          ? language === 'ru'
            ? 'Новость обновлена!'
            : 'News updated!'
          : language === 'ru'
            ? 'Новость опубликована для всех!'
            : 'News published for everyone!'
      );
      setIsComposerOpen(false);
      resetComposer();
    } catch (err: any) {
      try {
        handleFirestoreError(err, editingPostId ? OperationType.UPDATE : OperationType.CREATE, `news/${postId}`);
      } catch (wrapped: any) {
        notify.error(
          language === 'ru'
            ? 'Не удалось опубликовать новость (проверьте права роли Developer).'
            : 'Failed to publish news (verify Developer role permissions).'
        );
        console.error(wrapped);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeletePost = async (post: NewsPost) => {
    if (!isDeveloper) return;
    const confirmed = await confirmAction({
      title: language === 'ru' ? 'Удалить новость?' : 'Delete news post?',
      message:
        language === 'ru'
          ? `Удалить публикацию "${post.title}"? Это действие нельзя отменить.`
          : `Delete "${post.title}"? This action cannot be undone.`,
      confirmText: language === 'ru' ? 'Удалить' : 'Delete',
      cancelText: language === 'ru' ? 'Отмена' : 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'news', post.id));
      notify.success(language === 'ru' ? 'Новость удалена' : 'News post deleted');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `news/${post.id}`);
      } catch (wrapped) {
        notify.error(language === 'ru' ? 'Не удалось удалить новость' : 'Failed to delete news post');
        console.error(wrapped);
      }
    }
  };

  const cardSurface = isFrutigerAero
    ? 'frutiger-aero-glass border-white/70'
    : isLight
      ? 'bg-white border-[#E2E5EA] shadow-sm'
      : 'bg-[#181B20] border-[#262B33]';

  const inputSurface = isFrutigerAero
    ? 'bg-white/65 border-white/70 text-[#062038] placeholder:text-[#1e4b73]/60'
    : isLight
      ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315] focus:border-[#059669]'
      : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] focus:border-[#10B981]';

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-current/10">
          <div className="flex items-center gap-3.5">
            <div
              className={clsx(
                'w-11 h-11 rounded-xl flex items-center justify-center border shrink-0',
                isFrutigerAero
                  ? 'bg-white/60 border-white text-[#0284c7] shadow-sm'
                  : isLight
                    ? 'bg-[#059669]/10 border-[#059669]/25 text-[#059669]'
                    : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]'
              )}
            >
              <Newspaper className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {language === 'ru' ? 'Новости EPL Studio' : 'EPL Studio News'}
              </h1>
              <p className={clsx('text-xs mt-0.5', isFrutigerAero ? 'text-[#1e4b73]' : isLight ? 'text-[#6B7280]' : 'text-[#9CA3AF]')}>
                {language === 'ru'
                  ? 'Официальные обновления, релизы и анонсы от разработчика платформы'
                  : 'Official platform updates, releases, and announcements from the Developer'}
              </p>
            </div>
          </div>

          {/* ONLY Developer sees the + button */}
          {isDeveloper && (
            <button
              onClick={openCreateModal}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 shadow-sm',
                isFrutigerAero
                  ? 'frutiger-aero-button'
                  : isLight
                    ? 'bg-[#059669] hover:bg-[#047857] text-white'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
              )}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{language === 'ru' ? 'Создать новость' : 'Publish News'}</span>
            </button>
          )}
        </div>

        {/* Non-fatal transient load banner */}
        {loadWarning && (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 flex items-center justify-between gap-3 text-sm">
            <span>{loadWarning}</span>
            <button
              type="button"
              onClick={() => setReloadTick((t) => t + 1)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold text-xs cursor-pointer"
            >
              {language === 'ru' ? 'Повторить' : 'Retry'}
            </button>
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-70">
            <Loader2 className="w-7 h-7 animate-spin text-[#10B981]" />
            <span className="text-sm">{language === 'ru' ? 'Загрузка новостей...' : 'Loading news...'}</span>
          </div>
        ) : posts.length === 0 ? (
          <div className={clsx('rounded-2xl border p-12 text-center', cardSurface)}>
            <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 border border-[#10B981]/25 text-[#10B981] flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold mb-1">
              {language === 'ru' ? 'Пока нет новостей' : 'No news posts yet'}
            </h2>
            <p className={clsx('text-sm max-w-md mx-auto', isFrutigerAero ? 'text-[#1e4b73]' : isLight ? 'text-[#6B7280]' : 'text-[#9CA3AF]')}>
              {isDeveloper
                ? language === 'ru'
                  ? 'Нажмите кнопку «+ Создать новость» сверху, чтобы опубликовать первое объявление для всех пользователей.'
                  : 'Click the "+ Publish News" button above to share the first announcement with all users.'
                : language === 'ru'
                  ? 'Здесь скоро появятся важные обновления, патчи и анонсы от разработчика.'
                  : 'Check back soon for updates, release notes, and developer announcements.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => {
              const safeImages = (post.images || []).filter(isSafeImageSrc);
              const dateText = (() => {
                try {
                  return new Date(post.createdAt).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                } catch {
                  return post.createdAt;
                }
              })();

              return (
                <article
                  key={post.id}
                  className={clsx('rounded-2xl border p-5 sm:p-7 transition-colors', cardSurface)}
                >
                  {/* Author & Meta */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={post.authorAvatar || getDefaultAvatar(post.authorId)}
                        alt={post.authorName}
                        className="w-9 h-9 rounded-lg object-cover border border-current/15 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">{post.authorName}</span>
                          <UserRoleBadge role="developer" size="xs" showLabel />
                        </div>
                        <p className={clsx('text-xs font-mono-num', isFrutigerAero ? 'text-[#1e4b73]' : isLight ? 'text-[#6B7280]' : 'text-[#9CA3AF]')}>
                          {dateText}
                          {post.updatedAt && post.updatedAt !== post.createdAt && (
                            <span className="ml-2 opacity-75">
                              ({language === 'ru' ? 'изм.' : 'edited'})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {isDeveloper && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openEditModal(post)}
                          title={language === 'ru' ? 'Редактировать' : 'Edit'}
                          className={clsx(
                            'p-2 rounded-lg border transition-colors cursor-pointer',
                            isFrutigerAero
                              ? 'border-white/60 text-[#062038] hover:bg-white/50'
                              : isLight
                                ? 'border-[#E2E5EA] text-[#4B5563] hover:bg-[#F5F6F8]'
                                : 'border-[#262B33] text-[#9CA3AF] hover:bg-[#20242B] hover:text-white'
                          )}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(post)}
                          title={language === 'ru' ? 'Удалить' : 'Delete'}
                          className={clsx(
                            'p-2 rounded-lg border transition-colors cursor-pointer',
                            isFrutigerAero
                              ? 'border-white/60 text-red-600 hover:bg-red-500/15'
                              : isLight
                                ? 'border-[#E2E5EA] text-red-600 hover:bg-red-50'
                                : 'border-[#262B33] text-red-400 hover:bg-red-500/10'
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Title in chosen font */}
                  <h2
                    style={getFontStyle(post.font || 'sans')}
                    className="text-xl sm:text-2xl font-bold tracking-tight mb-3 break-words"
                  >
                    {post.title}
                  </h2>

                  {/* Formatted Rich Body */}
                  <div className={clsx(isFrutigerAero ? 'text-[#062038]/90' : isLight ? 'text-[#1F2937]' : 'text-[#D1D5DB]')}>
                    <RichNewsBody content={post.content} font={post.font || 'sans'} />
                  </div>

                  {/* Attached Images */}
                  {safeImages.length > 0 && (
                    <div
                      className={clsx(
                        'mt-5 grid gap-3',
                        safeImages.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                      )}
                    >
                      {safeImages.map((imgSrc, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightboxSrc(imgSrc)}
                          className={clsx(
                            'group relative overflow-hidden rounded-xl border text-left cursor-zoom-in',
                            isLight ? 'border-[#E2E5EA] bg-[#F5F6F8]' : 'border-[#262B33] bg-[#111315]'
                          )}
                        >
                          <img
                            src={imgSrc}
                            alt={`${post.title} #${i + 1}`}
                            className={clsx(
                              'w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]',
                              safeImages.length === 1 ? 'max-h-[440px]' : 'h-56'
                            )}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Developer News Composer Modal */}
      {isComposerOpen && isDeveloper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
          <div
            className={clsx(
              'w-full max-w-3xl max-h-[92vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl',
              isFrutigerAero
                ? 'frutiger-aero-glass border-white'
                : isLight
                  ? 'bg-white border-[#E2E5EA] text-[#111315]'
                  : 'bg-[#181B20] border-[#262B33] text-[#F3F4F6]'
            )}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-current/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#10B981]/15 text-[#10B981]">
                  <Newspaper className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingPostId
                      ? language === 'ru'
                        ? 'Редактировать новость'
                        : 'Edit News Post'
                      : language === 'ru'
                        ? 'Новая публикация'
                        : 'New News Post'}
                  </h3>
                  <p className="text-[11px] opacity-70">
                    {language === 'ru'
                      ? 'Видно всем пользователям • Публикация только для Developer'
                      : 'Visible to everyone • Developer exclusive publishing'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-current/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handlePublish} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                  {language === 'ru' ? 'Заголовок новости' : 'Headline / Title'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  style={getFontStyle(font)}
                  placeholder={language === 'ru' ? 'Например: Обновление DRPL v2.1 уже здесь!' : 'e.g., Major DRPL v2.1 Update is Live!'}
                  className={clsx('w-full px-3.5 py-2.5 rounded-xl border text-base font-bold focus:outline-none', inputSurface)}
                />
              </div>

              {/* Font Selector */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-75 mb-2">
                  <Type className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>{language === 'ru' ? 'Шрифт новости' : 'Post Typography / Font'}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {FONT_OPTIONS.map((opt) => {
                    const active = font === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFont(opt.value)}
                        className={clsx(
                          'px-3 py-2 rounded-xl border text-left transition-all cursor-pointer',
                          active
                            ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981] ring-1 ring-[#10B981]/40'
                            : isLight
                              ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:border-slate-300'
                              : 'bg-[#111315] border-[#262B33] hover:border-[#374151]'
                        )}
                      >
                        <div style={opt.sampleStyle} className="text-base font-bold leading-tight">
                          Aa Bb
                        </div>
                        <div className="text-[11px] opacity-80 truncate mt-0.5">
                          {language === 'ru' ? opt.labelRu : opt.labelEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rich Formatting Toolbar + Textarea / Preview */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection('**', '**', language === 'ru' ? 'жирный' : 'bold')}
                      title={language === 'ru' ? 'Жирный (Bold) — выделите слово и нажмите' : 'Bold — select text and click'}
                      className={clsx(
                        'px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer',
                        isLight ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-zinc-200' : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      <Bold className="w-3.5 h-3.5" />
                      <span>Bold</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection('*', '*', language === 'ru' ? 'курсив' : 'curve')}
                      title={language === 'ru' ? 'Наклонный / Curve (Italic) — выделите слово и нажмите' : 'Curve / Italic — select text and click'}
                      className={clsx(
                        'px-2.5 py-1.5 rounded-lg border text-xs italic font-serif flex items-center gap-1 transition-colors cursor-pointer',
                        isLight ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-zinc-200' : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      <Italic className="w-3.5 h-3.5" />
                      <span>Curve</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection('__', '__', language === 'ru' ? 'подчёркнутый' : 'underline')}
                      title={language === 'ru' ? 'Подчёркнутый' : 'Underline'}
                      className={clsx(
                        'px-2.5 py-1.5 rounded-lg border text-xs underline flex items-center gap-1 transition-colors cursor-pointer',
                        isLight ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-zinc-200' : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      <Underline className="w-3.5 h-3.5" />
                      <span>U</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection('~~', '~~', language === 'ru' ? 'зачёркнутый' : 'strike')}
                      title={language === 'ru' ? 'Зачёркнутый' : 'Strikethrough'}
                      className={clsx(
                        'px-2.5 py-1.5 rounded-lg border text-xs line-through flex items-center gap-1 transition-colors cursor-pointer',
                        isLight ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-zinc-200' : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      <Strikethrough className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection('++', '++', language === 'ru' ? 'акцент' : 'highlight')}
                      title={language === 'ru' ? 'Выделить цветом' : 'Highlight'}
                      className={clsx(
                        'px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer',
                        isLight ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-zinc-200' : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      <Highlighter className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection('`', '`', 'code()')}
                      title={language === 'ru' ? 'Вставка кода' : 'Inline code'}
                      className={clsx(
                        'px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer',
                        isLight ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-zinc-200' : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      <Code className="w-3.5 h-3.5 text-[#10B981]" />
                    </button>
                  </div>

                  {/* Write / Preview toggle */}
                  <div className={clsx('inline-flex rounded-lg border p-0.5', isLight ? 'bg-[#F5F6F8] border-[#E2E5EA]' : 'bg-[#111315] border-[#262B33]')}>
                    <button
                      type="button"
                      onClick={() => setComposerTab('write')}
                      className={clsx(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                        composerTab === 'write'
                          ? 'bg-[#10B981] text-[#09120E] font-semibold'
                          : 'opacity-70 hover:opacity-100'
                      )}
                    >
                      {language === 'ru' ? 'Текст' : 'Write'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerTab('preview')}
                      className={clsx(
                        'px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer',
                        composerTab === 'preview'
                          ? 'bg-[#10B981] text-[#09120E] font-semibold'
                          : 'opacity-70 hover:opacity-100'
                      )}
                    >
                      <Eye className="w-3 h-3" />
                      <span>{language === 'ru' ? 'Предпросмотр' : 'Preview'}</span>
                    </button>
                  </div>
                </div>

                {composerTab === 'write' ? (
                  <>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={8}
                      maxLength={25000}
                      style={getFontStyle(font)}
                      placeholder={
                        language === 'ru'
                          ? 'Выделите любое слово и нажмите Bold, Curve или U сверху, чтобы стилизовать его...'
                          : 'Select any word(s) and click Bold, Curve, or U above to style them...'
                      }
                      className={clsx('w-full px-3.5 py-3 rounded-xl border text-sm leading-relaxed focus:outline-none resize-y', inputSurface)}
                    />
                    <p className="text-[11px] opacity-60 mt-1">
                      {language === 'ru'
                        ? 'Подсказка: **жирный**, *наклонный (curve)*, __подчёркнутый__, ~~зачёркнутый~~, ++выделенный++, `код`'
                        : 'Tip: **bold**, *curve/italic*, __underline__, ~~strike~~, ++highlight++, `code`'}
                    </p>
                  </>
                ) : (
                  <div className={clsx('min-h-[200px] p-4 rounded-xl border', inputSurface)}>
                    {title && (
                      <h3 style={getFontStyle(font)} className="text-xl font-bold mb-2">
                        {title}
                      </h3>
                    )}
                    {content.trim() ? (
                      <RichNewsBody content={content} font={font} />
                    ) : (
                      <p className="text-sm opacity-50">
                        {language === 'ru' ? 'Текст пока пустой...' : 'Nothing to preview yet...'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Images Upload / URL */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-75 mb-2">
                  <ImagePlus className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>
                    {language === 'ru'
                      ? `Картинки (${images.length}/6)`
                      : `Images (${images.length}/6)`}
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <div className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddImageUrl();
                          }
                        }}
                        placeholder={language === 'ru' ? 'Вставить URL картинки (https://...)' : 'Paste image URL (https://...)'}
                        className={clsx('w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none', inputSurface)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className={clsx(
                        'px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer shrink-0',
                        isLight ? 'bg-[#F5F6F8] border-[#E2E5EA] hover:bg-zinc-200' : 'bg-[#111315] border-[#262B33] hover:bg-[#20242B]'
                      )}
                    >
                      {language === 'ru' ? 'Добавить URL' : 'Add URL'}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadImageFiles}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingImage || images.length >= 6}
                    onClick={() => fileInputRef.current?.click()}
                    className={clsx(
                      'px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-50',
                      'bg-[#10B981]/10 border-[#10B981]/35 text-[#10B981] hover:bg-[#10B981]/20'
                    )}
                  >
                    {isUploadingImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{language === 'ru' ? 'Загрузить с устройства' : 'Upload Images'}</span>
                  </button>
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {images.map((src, idx) => (
                      <div
                        key={idx}
                        className={clsx(
                          'relative group rounded-xl overflow-hidden border h-28',
                          isLight ? 'border-[#E2E5EA] bg-[#F5F6F8]' : 'border-[#262B33] bg-[#111315]'
                        )}
                      >
                        <img
                          src={src}
                          alt={`Attachment ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/75 text-white hover:bg-red-600 transition-colors cursor-pointer"
                          title={language === 'ru' ? 'Убрать' : 'Remove'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-current/10">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className={clsx(
                    'px-4 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer',
                    isLight ? 'border-[#E2E5EA] hover:bg-[#F5F6F8]' : 'border-[#262B33] hover:bg-[#20242B]'
                  )}
                >
                  {language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isPublishing || isUploadingImage}
                  className={clsx(
                    'px-5 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50',
                    isFrutigerAero
                      ? 'frutiger-aero-button'
                      : 'bg-[#10B981] hover:bg-[#059669] text-[#09120E]'
                  )}
                >
                  {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {editingPostId
                      ? language === 'ru'
                        ? 'Сохранить изменения'
                        : 'Save Changes'
                      : language === 'ru'
                        ? 'Опубликовать для всех'
                        : 'Publish for Everyone'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="News full preview"
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
