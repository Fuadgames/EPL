export interface LanguageMeta {
  code: string;
  name: string;
  englishName: string;
  flag: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', englishName: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Русский', englishName: 'Russian', flag: '🇷🇺' },
  { code: 'uk', name: 'Українська', englishName: 'Ukrainian', flag: '🇺🇦' },
  { code: 'be', name: 'Беларуская', englishName: 'Belarusian', flag: '🇧🇾' },
  { code: 'kk', name: 'Қазақша', englishName: 'Kazakh', flag: '🇰🇿' },
  { code: 'uz', name: 'Oʻzbekcha', englishName: 'Uzbek', flag: '🇺🇿' },
  { code: 'az', name: 'Azərbaycan', englishName: 'Azerbaijani', flag: '🇦🇿' },
  { code: 'hy', name: 'Հայերեն', englishName: 'Armenian', flag: '🇦🇲' },
  { code: 'ka', name: 'ქართული', englishName: 'Georgian', flag: '🇬🇪' },
  { code: 'ky', name: 'Кыргызча', englishName: 'Kyrgyz', flag: '🇰🇬' },
  { code: 'tg', name: 'Тоҷикӣ', englishName: 'Tajik', flag: '🇹🇯' },
  { code: 'tk', name: 'Türkmençe', englishName: 'Turkmen', flag: '🇹🇲' },
  { code: 'es', name: 'Español', englishName: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', englishName: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', englishName: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', englishName: 'Polish', flag: '🇵🇱' },
  { code: 'cs', name: 'Čeština', englishName: 'Czech', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovenčina', englishName: 'Slovak', flag: '🇸🇰' },
  { code: 'ro', name: 'Română', englishName: 'Romanian', flag: '🇷🇴' },
  { code: 'hu', name: 'Magyar', englishName: 'Hungarian', flag: '🇭🇺' },
  { code: 'bg', name: 'Български', englishName: 'Bulgarian', flag: '🇧🇬' },
  { code: 'el', name: 'Ελληνικά', englishName: 'Greek', flag: '🇬🇷' },
  { code: 'hr', name: 'Hrvatski', englishName: 'Croatian', flag: '🇭🇷' },
  { code: 'sr', name: 'Српски', englishName: 'Serbian', flag: '🇷🇸' },
  { code: 'sl', name: 'Slovenščina', englishName: 'Slovenian', flag: '🇸🇮' },
  { code: 'bs', name: 'Bosanski', englishName: 'Bosnian', flag: '🇧🇦' },
  { code: 'mk', name: 'Македонски', englishName: 'Macedonian', flag: '🇲🇰' },
  { code: 'sq', name: 'Shqip', englishName: 'Albanian', flag: '🇦🇱' },
  { code: 'ca', name: 'Català', englishName: 'Catalan', flag: '🇪🇸' },
  { code: 'gl', name: 'Galego', englishName: 'Galician', flag: '🇪🇸' },
  { code: 'eu', name: 'Euskara', englishName: 'Basque', flag: '🇪🇸' },
  { code: 'ga', name: 'Gaeilge', englishName: 'Irish', flag: '🇮🇪' },
  { code: 'cy', name: 'Cymraeg', englishName: 'Welsh', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { code: 'mt', name: 'Malti', englishName: 'Maltese', flag: '🇲🇹' },
  { code: 'lb', name: 'Lëtzebuergesch', englishName: 'Luxembourgish', flag: '🇱🇺' },
  { code: 'sv', name: 'Svenska', englishName: 'Swedish', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', englishName: 'Norwegian', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk', englishName: 'Danish', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', englishName: 'Finnish', flag: '🇫🇮' },
  { code: 'is', name: 'Íslenska', englishName: 'Icelandic', flag: '🇮🇸' },
  { code: 'et', name: 'Eesti', englishName: 'Estonian', flag: '🇪🇪' },
  { code: 'lv', name: 'Latviešu', englishName: 'Latvian', flag: '🇱🇻' },
  { code: 'lt', name: 'Lietuvių', englishName: 'Lithuanian', flag: '🇱🇹' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', flag: '🇹🇷' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', flag: '🇸🇦', rtl: true },
  { code: 'he', name: 'עברית', englishName: 'Hebrew', flag: '🇮🇱', rtl: true },
  { code: 'fa', name: 'فارسی', englishName: 'Persian', flag: '🇮🇷', rtl: true },
  { code: 'ur', name: 'اردو', englishName: 'Urdu', flag: '🇵🇰', rtl: true },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali', flag: '🇧🇩' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', englishName: 'Gujarati', flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ', englishName: 'Kannada', flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam', flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', flag: '🇮🇳' },
  { code: 'ne', name: 'नेपाली', englishName: 'Nepali', flag: '🇳🇵' },
  { code: 'si', name: 'සිංහල', englishName: 'Sinhala', flag: '🇱🇰' },
  { code: 'zh-CN', name: '简体中文', englishName: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', englishName: 'Chinese (Traditional)', flag: '🇹🇼' },
  { code: 'ja', name: '日本語', englishName: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', englishName: 'Korean', flag: '🇰🇷' },
  { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th', name: 'ไทย', englishName: 'Thai', flag: '🇹🇭' },
  { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', englishName: 'Malay', flag: '🇲🇾' },
  { code: 'tl', name: 'Filipino', englishName: 'Filipino (Tagalog)', flag: '🇵🇭' },
  { code: 'my', name: 'မြန်မာ', englishName: 'Myanmar (Burmese)', flag: '🇲🇲' },
  { code: 'km', name: 'ខ្មែរ', englishName: 'Khmer', flag: '🇰🇭' },
  { code: 'lo', name: 'ລາວ', englishName: 'Lao', flag: '🇱🇦' },
  { code: 'mn', name: 'Монгол', englishName: 'Mongolian', flag: '🇲🇳' },
  { code: 'sw', name: 'Kiswahili', englishName: 'Swahili', flag: '🇰🇪' },
  { code: 'am', name: 'አማርኛ', englishName: 'Amharic', flag: '🇪🇹' },
  { code: 'af', name: 'Afrikaans', englishName: 'Afrikaans', flag: '🇿🇦' },
  { code: 'zu', name: 'isiZulu', englishName: 'Zulu', flag: '🇿🇦' },
  { code: 'yo', name: 'Yorùbá', englishName: 'Yoruba', flag: '🇳🇬' },
  { code: 'ha', name: 'Hausa', englishName: 'Hausa', flag: '🇳🇬' },
  { code: 'so', name: 'Soomaali', englishName: 'Somali', flag: '🇸🇴' },
  { code: 'eo', name: 'Esperanto', englishName: 'Esperanto', flag: '🌍' },
  { code: 'la', name: 'Latina', englishName: 'Latin', flag: '🏛️' },
];

export const POPULAR_LANGUAGE_CODES = [
  'en',
  'ru',
  'uk',
  'es',
  'de',
  'fr',
  'zh-CN',
  'ja',
  'ko',
  'ar',
  'tr',
  'pt',
];

export const RTL_LANGUAGE_CODES = new Set(
  SUPPORTED_LANGUAGES.filter((l) => l.rtl).map((l) => l.code)
);

const LANGUAGE_MAP = new Map<string, LanguageMeta>(
  SUPPORTED_LANGUAGES.map((l) => [l.code.toLowerCase(), l])
);

export function getLanguageMeta(code?: string | null): LanguageMeta {
  const normalized = String(code || 'en').trim().toLowerCase();
  return (
    LANGUAGE_MAP.get(normalized) ||
    LANGUAGE_MAP.get(normalized.split('-')[0]) ||
    SUPPORTED_LANGUAGES[0]
  );
}

export function isRtlLanguage(code?: string | null): boolean {
  const meta = getLanguageMeta(code);
  return Boolean(meta.rtl || RTL_LANGUAGE_CODES.has(meta.code));
}
