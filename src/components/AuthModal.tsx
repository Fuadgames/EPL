import React, { useState } from 'react';
import { Mail, Lock, User, X, Loader2, AlertCircle, Chrome, Apple } from 'lucide-react';
import { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, resetPassword } from '../firebase';
import { useStore } from '../store/useStore';
import { translations } from '../lib/translations';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const language = useStore(state => state.language);
  const t = translations[language].auth;
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim();
    const cleanName = name.trim();
    try {
      if (isReset) {
        const { error } = await resetPassword(cleanEmail);
        if (error) throw error;
        setMessage(language === 'ru' ? 'Инструкции по сбросу пароля отправлены на email' : 'Password reset instructions sent to your email');
      } else if (isLogin) {
        const { error } = await signInWithEmail(cleanEmail, password);
        if (error) throw error;
        onClose();
      } else {
        const { error } = await signUpWithEmail(cleanEmail, password, cleanName);
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let errorMessage = err.message;

      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = language === 'ru' ? 'Этот email уже используется.' : 'This email is already in use.';
          break;
        case 'auth/invalid-email':
          errorMessage = language === 'ru' ? 'Некорректный email.' : 'Invalid email address.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage =
            language === 'ru'
              ? 'Вход через email/пароль не включен в настройках Firebase Authentication.'
              : 'Email/password sign-in is not enabled in Firebase Authentication.';
          break;
        case 'auth/weak-password':
          errorMessage = language === 'ru' ? 'Слишком слабый пароль.' : 'Password is too weak.';
          break;
        case 'auth/user-disabled':
          errorMessage = language === 'ru' ? 'Пользователь заблокирован.' : 'User account has been disabled.';
          break;
        case 'auth/user-not-found':
          errorMessage = language === 'ru' ? 'Пользователь не найден.' : 'User not found.';
          break;
        case 'auth/wrong-password':
          errorMessage = language === 'ru' ? 'Неверный пароль.' : 'Incorrect password.';
          break;
        case 'auth/invalid-credential':
          errorMessage = language === 'ru' ? 'Неверный email или пароль.' : 'Invalid email or password.';
          break;
        case 'auth/popup-blocked':
          errorMessage = language === 'ru' ? 'Всплывающее окно заблокировано браузером.' : 'Popup was blocked by the browser.';
          break;
        case 'auth/network-request-failed':
          errorMessage = language === 'ru' ? 'Ошибка сети. Проверьте подключение.' : 'Network error. Check your connection.';
          break;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        if (error.code === 'auth/popup-closed-by-user') return;
        throw error;
      }
      onClose();
    } catch (err: any) {
      console.error('Google Auth error:', err);
      let errorMessage = err.message || 'Ошибка входа через Google';
      if (err.code === 'auth/popup-blocked') {
        errorMessage =
          language === 'ru'
            ? 'Всплывающее окно заблокировано браузером. Пожалуйста, разрешите всплывающие окна в адресной строке.'
            : 'Popup was blocked by browser. Please allow popups in the URL bar.';
      } else if (err.code === 'auth/unauthorized-domain') {
        errorMessage =
          language === 'ru'
            ? `Домен ${window.location.hostname} не добавлен в Authorized Domains в Firebase.`
            : `Domain ${window.location.hostname} is not authorized in Firebase.`;
      } else if (err.message && err.message.includes('Missing or insufficient permissions')) {
        errorMessage = language === 'ru' ? 'Ошибка доступа к базе данных. Пожалуйста, попробуйте еще раз.' : 'Database access error. Please try again.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await signInWithApple();
      if (error) throw error;
      onClose();
    } catch (err: any) {
      console.error('Apple Auth error:', err);
      let errorMessage = err.message;
      if (err.code === 'auth/popup-blocked') {
        errorMessage = language === 'ru' ? 'Всплывающее окно заблокировано браузером. Пожалуйста, разрешите всплывающие окна.' : 'Popup was blocked by the browser.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = language === 'ru' ? 'Вход через Apple не включен в консоли Firebase.' : 'Apple sign-in is not enabled in Firebase Console.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#181B20] border border-[#262B33] w-full max-w-md rounded-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#262B33] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#F3F4F6]">
            {isReset ? t.forgotPassword : isLogin ? t.signIn : t.signUp}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#22262E] rounded-lg transition-colors text-[#9CA3AF] hover:text-[#F3F4F6] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-lg flex items-start gap-2.5 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {message && (
            <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg flex items-start gap-2.5 text-[#10B981] text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{message}</p>
            </div>
          )}

          {!isLogin && !isReset && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{language === 'ru' ? 'Имя' : 'Name'}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#111315] border border-[#262B33] rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#F3F4F6] placeholder:text-[#6B7280] focus:outline-none focus:border-[#10B981] transition-colors"
                  placeholder={language === 'ru' ? 'Ваше имя' : 'Your name'}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{t.email}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111315] border border-[#262B33] rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#F3F4F6] placeholder:text-[#6B7280] focus:outline-none focus:border-[#10B981] transition-colors"
                placeholder="email@example.com"
              />
            </div>
          </div>

          {!isReset && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{t.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#111315] border border-[#262B33] rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#F3F4F6] placeholder:text-[#6B7280] focus:outline-none focus:border-[#10B981] transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed text-[#0A0C0E] rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isReset ? t.login : isLogin ? t.login : t.register}
          </button>

          <div className="relative py-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#262B33]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase font-semibold">
              <span className="bg-[#181B20] px-2 text-[#6B7280]">{language === 'ru' ? 'ИЛИ' : 'OR'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="py-2.5 bg-white hover:bg-zinc-100 text-[#111315] rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Chrome className="w-4 h-4" />
              Google
            </button>

            <button
              type="button"
              onClick={handleAppleSignIn}
              disabled={loading}
              className="py-2.5 bg-[#111315] border border-[#262B33] hover:bg-[#22262E] text-[#F3F4F6] rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Apple className="w-4 h-4" />
              Game Center
            </button>
          </div>

          <div className="pt-3 text-center space-y-2">
            {!isReset && (
              <p className="text-xs text-[#9CA3AF]">
                {isLogin ? t.noAccount : t.hasAccount}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-[#10B981] hover:text-[#34D399] font-semibold cursor-pointer"
                >
                  {isLogin ? t.register : t.login}
                </button>
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setIsReset(!isReset);
                setIsLogin(true);
                setError(null);
                setMessage(null);
              }}
              className="text-xs text-[#6B7280] hover:text-[#D1D5DB] cursor-pointer"
            >
              {isReset ? (language === 'ru' ? 'Вернуться к входу' : 'Back to login') : t.forgotPassword}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
