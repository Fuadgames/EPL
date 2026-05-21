import React, { useState } from 'react';
import { Mail, Lock, User, X, Loader2, AlertCircle, Chrome } from 'lucide-react';
import { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, resetPassword } from '../firebase';
import { useStore } from '../store/useStore';
import { translations } from '../lib/translations';
import { Apple } from 'lucide-react';

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

  const setUser = useStore(state => state.setUser);
  const setUserData = useStore(state => state.setUserData);
  const setIsBackdoor = useStore(state => state.setIsBackdoor);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleSubmit called", { isLogin, isReset, email });
    setLoading(true);
    setError(null);
    setMessage(null);

    // Developer Backdoor
    if (isLogin && !isReset && email.toLowerCase() === 'fufazada@gmail.com' && password === '12345678901') {
      try {
        const { user, error } = await signInWithEmail(email, password);
        if (error && (error.code === 'auth/operation-not-allowed' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
          // Mock login if real auth is disabled or user not found
          console.log("Using mock login for developer");
          const mockUser = {
            uid: 'dev-backdoor-uid',
            email: 'fufazada@gmail.com',
            displayName: 'Fuadgames',
            photoURL: null,
            emailVerified: true,
          } as any;
          
          const mockUserData = {
            uid: mockUser.uid,
            name: 'Fuadgames',
            email: mockUser.email,
            role: 'developer' as const,
            eplCoins: 1000,
            purchasedItems: [],
            uploadedFiles: [],
            createdAt: new Date().toISOString()
          };
          
          setIsBackdoor(true);
          setUser(mockUser);
          setUserData(mockUserData);
          onClose();
          return;
        } else if (error) {
          throw error;
        }
        onClose();
        return;
      } catch (err) {
        console.error("Backdoor attempt failed", err);
      }
    }

    try {
      if (isReset) {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setMessage(language === 'ru' ? 'Инструкции по сбросу пароля отправлены на email' : 'Password reset instructions sent to your email');
      } else if (isLogin) {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
        onClose();
      } else {
        const { error } = await signUpWithEmail(email, password, name);
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let errorMessage = err.message;
      
      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = language === 'ru' ? 'Этот email уже используется.' : 'This email is already in use.';
          break;
        case 'auth/invalid-email':
          errorMessage = language === 'ru' ? 'Некорректный email.' : 'Invalid email address.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = language === 'ru' 
            ? 'Вход через email/пароль не включен. Пожалуйста, включите "Email/Password" в разделе Authentication -> Sign-in method в консоли Firebase.' 
            : 'Email/password sign-in is not enabled. Please enable "Email/Password" in the Authentication -> Sign-in method section of your Firebase Console.';
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
    console.log("handleGoogleSignIn called");
    setLoading(true);
    setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      onClose();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      let errorMessage = err.message;
      if (err.code === 'auth/popup-blocked') {
        errorMessage = language === 'ru' ? 'Всплывающее окно заблокировано браузером. Пожалуйста, разрешите всплывающие окна.' : 'Popup was blocked by the browser. Please allow popups.';
      } else if (err.message.includes('Missing or insufficient permissions')) {
        errorMessage = language === 'ru' ? 'Ошибка доступа к базе данных. Пожалуйста, попробуйте еще раз.' : 'Database access error. Please try again.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    console.log("handleAppleSignIn called");
    setLoading(true);
    setError(null);
    try {
      const { error } = await signInWithApple();
      if (error) throw error;
      onClose();
    } catch (err: any) {
      console.error("Apple Auth error:", err);
      let errorMessage = err.message;
      if (err.code === 'auth/popup-blocked') {
        errorMessage = language === 'ru' ? 'Всплывающее окно заблокировано браузером. Пожалуйста, разрешите всплывающие окна.' : 'Popup was blocked by the browser. Please allow popups.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = language === 'ru' ? 'Вход через Apple не включен в консоли Firebase.' : 'Apple sign-in is not enabled in Firebase Console.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {isReset ? t.forgotPassword : (isLogin ? t.signIn : t.signUp)}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Backdoor Warning */}
      {isLogin && !isReset && email.toLowerCase() === 'fufazada@gmail.com' && password === '12345678901' && (
        <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">
            {language === 'ru' 
              ? 'ВНИМАНИЕ: Вы используете "бэкдор". Данные НЕ БУДУТ сохраняться в облаке. Используйте Google или Email для сохранения.' 
              : 'WARNING: You are using the backdoor. Data will NOT be saved to the cloud. Use Google or Email for persistent storage.'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {message && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-emerald-500 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{message}</p>
            </div>
          )}

          {!isLogin && !isReset && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">{language === 'ru' ? 'Имя' : 'Name'}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder={language === 'ru' ? 'Ваше имя' : 'Your name'}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">{t.email}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="email@example.com"
              />
            </div>
          </div>

          {!isReset && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">{t.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isReset ? t.login : (isLogin ? t.login : t.register))}
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500">{language === 'ru' ? 'ИЛИ' : 'OR'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="py-3 bg-white hover:bg-zinc-100 text-zinc-900 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Chrome className="w-5 h-5" />
              Google
            </button>

            <button
              type="button"
              onClick={handleAppleSignIn}
              disabled={loading}
              className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Apple className="w-5 h-5" />
              Game Center
            </button>
          </div>

          <div className="pt-4 text-center space-y-2">
            {!isReset && (
              <p className="text-sm text-zinc-400">
                {isLogin ? t.noAccount : t.hasAccount}{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-emerald-500 hover:text-emerald-400 font-medium"
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
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {isReset ? (language === 'ru' ? 'Вернуться к входу' : 'Back to login') : t.forgotPassword}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
