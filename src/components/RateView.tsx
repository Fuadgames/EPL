import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Star, Trash2, Send, Shield, Bot, Sparkles, MessageSquareHeart, Crown } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, onSnapshot, setDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Review } from '../types';
import { getDefaultAvatar } from '../lib/avatar';
import UserRoleBadge from './UserRoleBadge';
import { notify, confirmAction } from '../store/useDialogStore';

export default function RateView() {
  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);
  const user = useStore(state => state.user);
  const userData = useStore(state => state.userData);
  const isPremium = useStore(state => state.isPremium);
  const premiumTier = useStore(state => state.premiumTier);
  const setIsAuthModalOpen = useStore(state => state.setIsAuthModalOpen);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanningAi, setScanningAi] = useState(false);

  const isLight = theme === 'light' && !isFrutigerAero;
  const isDeveloper = userData?.role === 'developer';

  useEffect(() => {
    const q = query(collection(db, 'reviews'), where('appId', '==', 'platform'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(d => ({ ...(d.data() as any), id: d.id } as Review))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setReviews(list);
        setLoading(false);
      },
      (err) => {
        console.warn('RateView reviews snapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    let sum = 0;
    for (const r of reviews) {
      const val = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
      counts[val - 1]++;
      sum += val;
    }
    const avg = reviews.length > 0 ? sum / reviews.length : 0;
    return { counts, avg, total: reviews.length };
  }, [reviews]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    const cleanComment = comment.trim();
    if (!cleanComment) {
      notify.error(language === 'ru' ? 'Напишите текст отзыва' : 'Please write a review comment');
      return;
    }

    const reviewId = `rev_${user.uid}_${Date.now()}`;
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken().catch(() => '');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      // First run AI Moderator check
      const modRes = await fetch('/api/ai/moderate-review', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reviewId,
          comment: cleanComment,
          rating,
          userName: userData?.name || user.displayName || 'Player',
          userId: user.uid,
        }),
      });

      if (modRes.ok) {
        const modData = await modRes.json();
        if (modData && modData.approved === false) {
          notify.error(
            modData.reason ||
              (language === 'ru'
                ? 'ИИ-модератор обнаружил нарушение и удалил/отклонил отзыв.'
                : 'AI Moderator detected a violation and removed the review.')
          );
          setSubmitting(false);
          return;
        }
      }

      const activeTier =
        userData?.premiumTier && userData.premiumTier !== 'none'
          ? userData.premiumTier
          : premiumTier !== 'none'
            ? premiumTier
            : isPremium || userData?.isPremium
              ? 'premium'
              : 'none';

      const payload: Review = {
        id: reviewId,
        appId: 'platform',
        userId: user.uid,
        userName: userData?.name || user.displayName || 'Player',
        userAvatar: userData?.avatarUrl || user.photoURL || '',
        userRole: userData?.role || 'user',
        premiumTier: activeTier,
        rating,
        comment: cleanComment,
        aiChecked: true,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'reviews', reviewId), payload);
      setComment('');
      setRating(5);
      notify.success(language === 'ru' ? 'Спасибо за отзыв! Проверено ИИ-модератором.' : 'Review posted and verified by AI Moderator!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, `reviews/${reviewId}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (rev: Review) => {
    const canDelete = isDeveloper || (user?.uid && rev.userId === user.uid);
    if (!canDelete) return;

    const ok = await confirmAction({
      title: language === 'ru' ? 'Удалить отзыв?' : 'Delete Review?',
      message: language === 'ru' ? 'Вы уверены, что хотите удалить этот отзыв?' : 'Are you sure you want to delete this review?',
      confirmText: language === 'ru' ? 'Удалить' : 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'reviews', rev.id));
      notify.success(language === 'ru' ? 'Отзыв удалён' : 'Review deleted');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `reviews/${rev.id}`);
    }
  };

  const handleAiScanAllReviews = async () => {
    if (!isDeveloper) return;
    setScanningAi(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken().catch(() => '');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/ai/moderate-all-reviews', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      // Also ensure any deletedIds returned by server are deleted via client SDK if needed
      if (Array.isArray(data.deletedIds)) {
        for (const id of data.deletedIds) {
          await deleteDoc(doc(db, 'reviews', id)).catch(() => {});
        }
      }

      notify.success(
        language === 'ru'
          ? `ИИ-модератор проверил отзывов: ${data.scanned}. Удалено нарушений: ${data.deletedCount}.`
          : `AI Moderator scanned ${data.scanned} reviews. Removed violations: ${data.deletedCount}.`
      );
    } catch (err: any) {
      notify.error(err?.message || 'AI Scan failed');
    } finally {
      setScanningAi(false);
    }
  };

  const cardSurface = isFrutigerAero
    ? 'bg-white/45 border-white/60 backdrop-blur-md shadow-sm'
    : isLight
      ? 'bg-white border-[#E2E5EA]'
      : 'bg-[#181B20] border-[#262B33]';

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-current/10">
          <div>
            <h1 className={clsx('text-2xl font-bold tracking-tight flex items-center gap-2.5', isFrutigerAero ? 'text-blue-900' : isLight ? 'text-[#111315]' : 'text-[#F3F4F6]')}>
              <MessageSquareHeart className="w-6 h-6 text-[#10B981]" />
              {language === 'ru' ? 'Оценить EPL Studio (Rate)' : 'Rate EPL Studio'}
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-1">
              {language === 'ru'
                ? 'Поставьте оценку от 1 до 5 звёзд и оставьте отзыв. ИИ-модератор автоматически удаляет нарушения.'
                : 'Rate EPL Studio from 1 to 5 stars and write a review. Protected automatically by AI Moderator.'}
            </p>
          </div>

          {isDeveloper && (
            <button
              type="button"
              onClick={handleAiScanAllReviews}
              disabled={scanningAi}
              className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Bot className={clsx('w-4 h-4', scanningAi && 'animate-spin')} />
              <span>
                {scanningAi
                  ? language === 'ru' ? 'ИИ проверяет...' : 'AI Scanning...'
                  : language === 'ru' ? 'ИИ-модерация отзывов' : 'AI Moderate Reviews'}
              </span>
            </button>
          )}
        </div>

        {/* Summary & Star Distribution */}
        <div className={clsx('rounded-2xl border p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center', cardSurface)}>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="text-5xl font-black font-mono-num tracking-tight text-[#10B981]">
              {stats.avg > 0 ? stats.avg.toFixed(1) : '—'}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  className={clsx(
                    'w-4 h-4',
                    s <= Math.round(stats.avg) ? 'text-amber-400 fill-amber-400' : 'text-[#6B7280]/40'
                  )}
                />
              ))}
            </div>
            <div className="text-xs text-[#9CA3AF] mt-1.5">
              {language === 'ru' ? `Всего отзывов: ${stats.total}` : `${stats.total} reviews`}
            </div>
          </div>

          <div className="sm:col-span-2 space-y-2">
            {[5, 4, 3, 2, 1].map(starVal => {
              const count = stats.counts[starVal - 1];
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={starVal} className="flex items-center gap-3 text-xs">
                  <span className="w-8 font-mono-num font-semibold flex items-center gap-1">
                    {starVal} <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  </span>
                  <div className={clsx('flex-1 h-2 rounded-full overflow-hidden', isLight ? 'bg-slate-200' : 'bg-[#111315]')}>
                    <div
                      className="h-full bg-gradient-to-r from-[#10B981] to-amber-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono-num text-[#9CA3AF]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Review Composer */}
        <form onSubmit={handleSubmitReview} className={clsx('rounded-2xl border p-6 space-y-4', cardSurface)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">
                {language === 'ru' ? 'Написать отзыв' : 'Write a Review'}
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                {language === 'ru'
                  ? 'Удалить отзыв может только автор, разработчик или ИИ-модератор.'
                  : 'Only the author, the Developer, or the AI Moderator can delete a review.'}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(val => {
                const active = (hoverRating || rating) >= val;
                return (
                  <button
                    key={val}
                    type="button"
                    onMouseEnter={() => setHoverRating(val)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(val)}
                    className="p-1 transition-transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={clsx(
                        'w-7 h-7 transition-colors',
                        active ? 'text-amber-400 fill-amber-400' : 'text-[#6B7280]/40'
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1500}
            placeholder={
              language === 'ru'
                ? 'Поделитесь впечатлениями об игре, редакторе EPL и функциях...'
                : 'Share your thoughts about EPL Studio, games, and features...'
            }
            className={clsx(
              'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none resize-none',
              isFrutigerAero
                ? 'bg-white/60 border-white/50 text-blue-950'
                : isLight
                  ? 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
                  : 'bg-[#111315] border-[#262B33] text-[#F3F4F6] focus:border-[#10B981]'
            )}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
              <Shield className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{language === 'ru' ? 'Защита ИИ-модератора активна' : 'AI Moderator protection active'}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#0A0C0E] text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? language === 'ru' ? 'Публикация...' : 'Submitting...'
                  : language === 'ru' ? 'Опубликовать отзыв' : 'Post Review'}
              </span>
            </button>
          </div>
        </form>

        {/* Reviews Feed */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#262B33] border-t-[#10B981]" />
            </div>
          ) : reviews.length === 0 ? (
            <div className={clsx('rounded-2xl border p-10 text-center text-sm text-[#9CA3AF]', cardSurface)}>
              {language === 'ru' ? 'Отзывов пока нет — будьте первым!' : 'No reviews yet — be the first to rate!'}
            </div>
          ) : (
            reviews.map(rev => {
              const canDelete = isDeveloper || (!!user?.uid && rev.userId === user.uid);
              return (
                <div key={rev.id} className={clsx('rounded-2xl border p-5 flex flex-col gap-3', cardSurface)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={rev.userAvatar || getDefaultAvatar(rev.userId)}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover border border-current/15 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold truncate">{rev.userName || 'User'}</span>
                          {rev.userRole && <UserRoleBadge role={rev.userRole} size="xs" showLabel />}
                          {rev.premiumTier && rev.premiumTier !== 'none' && (
                            <span
                              className={clsx(
                                'text-[10px] px-2 py-0.5 rounded font-bold uppercase inline-flex items-center gap-1',
                                rev.premiumTier === 'ultra'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : rev.premiumTier === 'premium'
                                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                    : 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                              )}
                            >
                              {rev.premiumTier === 'ultra' ? <Crown className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
                              {rev.premiumTier}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star
                                key={s}
                                className={clsx(
                                  'w-3.5 h-3.5',
                                  s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-[#6B7280]/30'
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-mono-num text-[#9CA3AF]">
                            {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(rev)}
                        title={language === 'ru' ? 'Удалить отзыв' : 'Delete review'}
                        className="p-2 rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{rev.comment}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
