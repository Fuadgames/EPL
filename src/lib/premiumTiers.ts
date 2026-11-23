import { PremiumTier } from '../types';

export const TIER_ORDER: Record<PremiumTier, number> = {
  none: 0,
  plus: 1,
  premium: 2,
  ultra: 3,
};

export function hasTierAccess(current: PremiumTier, required: Exclude<PremiumTier, 'none'>): boolean {
  return TIER_ORDER[current] >= TIER_ORDER[required];
}

export function resolveEffectiveTier(
  isPremium?: boolean,
  premiumTier?: PremiumTier | string | null
): PremiumTier {
  if (premiumTier === 'plus' || premiumTier === 'premium' || premiumTier === 'ultra') {
    return premiumTier;
  }
  if (isPremium) {
    return 'premium';
  }
  return 'none';
}

export interface TierMeta {
  id: Exclude<PremiumTier, 'none'>;
  name: string;
  taglineEn: string;
  taglineRu: string;
  badgeText: string;
  priceLabel: string;
  codePrefix: string;
  allowedEn: string[];
  allowedRu: string[];
  lockedEn: string[];
  lockedRu: string[];
}

export const PREMIUM_TIERS: Record<Exclude<PremiumTier, 'none'>, TierMeta> = {
  plus: {
    id: 'plus',
    name: 'Plus',
    taglineEn: 'Starter tier with clean slate styling',
    taglineRu: 'Базовый уровень с простым оформлением',
    badgeText: 'PLUS',
    priceLabel: '$2.99',
    codePrefix: 'PLUS',
    allowedEn: [
      'Unlimited standard & Faster AI requests',
      'Thinking AI mode unlocked',
      'Computer Style in Editor',
      'Copy Protection for projects',
      'Extra Premium Access (Starter: Matrix Rain, Confetti Cannon, Accent Studio, Typewriter SFX, Focus Pomodoro)',
    ],
    allowedRu: [
      'Безлимитные базовые и быстрые запросы к ИИ',
      'Разблокирован режим Thinking AI',
      'Компьютерный стиль в редакторе',
      'Запрет копирования ваших проектов',
      'Extra Premium Access (База: Матрица, Конфетти-пушка, Акцент-студия, Звуки клавиш, Помодоро)',
    ],
    lockedEn: [
      'Pro AI mode',
      'App Password Lock & Paid Apps',
      'Remove .epl Website Watermark',
      'Troll Message & Target Screen Pranks',
      'Control My EPL (Remote Takeover) & Ultra Soundboard',
    ],
    lockedRu: [
      'Режим Pro AI',
      'Блокировка приложений паролем и платные приложения',
      'Удаление водяного знака на .epl сайтах',
      'Troll Message и пранки на экране других игроков',
      'Control My EPL (удалённое управление) и Ultra-саундборд',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    taglineEn: 'Crystalline violet-emerald edition for creators',
    taglineRu: 'Уникальный изумрудно-фиолетовый уровень для создателей',
    badgeText: 'PREMIUM',
    priceLabel: '$5.99',
    codePrefix: 'PREM',
    allowedEn: [
      'Everything in Plus',
      'Pro AI mode unlocked + Priority generation',
      'App Access Locking & Paid Apps in Store',
      'Remove "Created in EPL Studio" watermark on .epl websites',
      'Message to Developer direct support chat',
      'Extra Premium Access Mid-Tier: Troll Message (send popup to any user!), RGB Cursor Trail, 180° Screen Flip, Disco Party, Earthquake Shake, UwU/1337 Text Mode',
    ],
    allowedRu: [
      'Всё из уровня Plus',
      'Режим Pro AI и приоритетная генерация',
      'Блокировка проектов паролем и продажа приложений за монеты',
      'Удаление водяного знака на .epl сайтах',
      'Прямой чат Message to Developer с разработчиком',
      'Extra Premium Access (Средний уровень): Troll Message (сообщение на экран игрока!), RGB-след курсора, Переворот экрана 180°, Диско-режим, Землетрясение, UwU/1337 текст',
    ],
    lockedEn: [
      'Control My EPL (real-time remote EPL control)',
      'Fake Hacker Terminal HUD & Target System Pranks',
      'Full Prank Soundboard Attack Deck',
    ],
    lockedRu: [
      'Control My EPL (удалённое управление EPL игрока)',
      'Фейковый хакерский HUD и системные пранки на цель',
      'Полный пранк-саундборд на других игроков',
    ],
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    taglineEn: 'Epic obsidian-gold prismatic flagship — 100% unlocked',
    taglineRu: 'Самый эпичный золотой уровень с радужным сиянием — открыто ВСЁ',
    badgeText: 'ULTRA',
    priceLabel: '$11.99',
    codePrefix: 'ULTR',
    allowedEn: [
      'EVERYTHING from Plus & Premium unlocked',
      'Control My EPL — take live remote control of a player’s EPL (with their "I don’t want it" safety switch)',
      'Full Troll Message + Target Prank FX + Soundboard Attack Deck',
      'Fake Epic Hacker Terminal HUD & Target Screen Takeovers',
      'Priority Developer Chat badge & Ultra Obsidian-Gold Profile Aura',
      'Zero restrictions across the entire Extra Premium Access lab',
    ],
    allowedRu: [
      'АБСОЛЮТНО ВСЁ из Plus и Premium без ограничений',
      'Control My EPL — живое управление EPL игрока (с кнопкой защиты «I don’t want it» у игрока)',
      'Полный набор: Troll Message + любые экранные пранки + Саундборд-атаки',
      'Эпичный фейковый хакерский HUD и системные розыгрыши',
      'Приоритетный значок Ultra в чате с разработчиком и золотая аура',
      'Открыты все функции во вкладке Extra Premium Access на максимум',
    ],
    lockedEn: [],
    lockedRu: [],
  },
};

export interface ExtraFeatureDefinition {
  id: string;
  requiredTier: Exclude<PremiumTier, 'none'>;
  category: 'target' | 'visual' | 'fun';
  titleEn: string;
  titleRu: string;
  descEn: string;
  descRu: string;
}

export const EXTRA_FEATURES_CATALOG: ExtraFeatureDefinition[] = [
  {
    id: 'trollMessage',
    requiredTier: 'premium',
    category: 'target',
    titleEn: 'Troll Message',
    titleRu: 'Troll Message',
    descEn: 'Pick any player and beam a custom styled popup alert directly onto their screen.',
    descRu: 'Выберите любого игрока и отправьте всплывающее тролль-сообщение прямо на его экран.',
  },
  {
    id: 'controlMyEpl',
    requiredTier: 'ultra',
    category: 'target',
    titleEn: 'Control My EPL',
    titleRu: 'Control My EPL',
    descEn: 'Control a player’s EPL Studio live (tabs, code, theme). Target sees an "I don’t want it" disconnect button.',
    descRu: 'Управляйте EPL игрока в реальном времени (вкладки, код, темы). У игрока снизу есть кнопка «I don’t want it».',
  },
  {
    id: 'targetPrankFx',
    requiredTier: 'premium',
    category: 'target',
    titleEn: 'Target Screen Prank FX',
    titleRu: 'Пранк-эффекты на игрока',
    descEn: 'Trigger timed Shake, Confetti Bomb, 180° Flip, Glitch, or Synth Soundboard on a target player.',
    descRu: 'Запустите тряску экрана, конфетти-бомбу, переворот на 180°, глитч или звук на экране выбранного игрока.',
  },
  {
    id: 'matrixRain',
    requiredTier: 'plus',
    category: 'visual',
    titleEn: 'Matrix Code Rain',
    titleRu: 'Дождь кода Матрицы',
    descEn: 'Atmospheric digital rain overlay with adjustable speed, opacity, and neon color.',
    descRu: 'Атмосферный цифровой дождь поверх интерфейса с настройкой скорости, прозрачности и цвета.',
  },
  {
    id: 'confettiCannon',
    requiredTier: 'plus',
    category: 'fun',
    titleEn: 'Confetti & Emoji Cannon',
    titleRu: 'Пушка конфетти и эмодзи',
    descEn: 'Launch celebration bursts or continuous ambient emoji rain across your studio.',
    descRu: 'Запускайте взрывы конфетти или непрерывный дождь эмодзи в вашем окне.',
  },
  {
    id: 'accentStudio',
    requiredTier: 'plus',
    category: 'visual',
    titleEn: 'Custom Accent Glow Studio',
    titleRu: 'Студия неоновой подсветки',
    descEn: 'Apply a custom ambient neon halo and vignette tint around your EPL Studio workspace.',
    descRu: 'Добавьте собственную неоновую ауру и цветовой оттенок вокруг интерфейса EPL Studio.',
  },
  {
    id: 'typewriterSfx',
    requiredTier: 'plus',
    category: 'fun',
    titleEn: 'Mechanical Keystroke SFX',
    titleRu: 'Звуки клавиатуры и синта',
    descEn: 'Real Web Audio API mechanical switches, cyber synth, or retro 8-bit clicks as you type.',
    descRu: 'Настоящие звуки механики, кибер-синта или 8-bit кликов при каждом нажатии клавиши.',
  },
  {
    id: 'pomodoroFocus',
    requiredTier: 'plus',
    category: 'fun',
    titleEn: 'Focus Pomodoro + Lo-Fi Pad',
    titleRu: 'Таймер фокуса + Lo-Fi фон',
    descEn: 'Floating focus timer HUD with optional soothing ambient harmonic drone.',
    descRu: 'Плавающий таймер продуктивности со встроенным мягким эмбиент-синтезатором.',
  },
  {
    id: 'rgbCursor',
    requiredTier: 'premium',
    category: 'visual',
    titleEn: 'RGB Particle Cursor Trail',
    titleRu: 'RGB-след из частиц за курсором',
    descEn: 'Follows your mouse with glowing stardust, matrix sparks, or golden particles.',
    descRu: 'Красивый шлейф из светящихся искр, золотой пыли или неоновых частиц за курсором.',
  },
  {
    id: 'screenFlip',
    requiredTier: 'premium',
    category: 'visual',
    titleEn: '180° Screen Flip / Mirror',
    titleRu: 'Переворот экрана 180° / Зеркало',
    descEn: 'Flip upside down, mirror horizontally, or tilt the entire workspace for fun challenges.',
    descRu: 'Переверните интерфейс вверх ногами, отразите по горизонтали или наклоните экран.',
  },
  {
    id: 'discoParty',
    requiredTier: 'premium',
    category: 'visual',
    titleEn: 'Disco Neon Party Mode',
    titleRu: 'Диско Неон-вечеринка',
    descEn: 'Animated rainbow party frame and dynamic hue pulse synced to adjustable BPM.',
    descRu: 'Анимированная радужная подсветка по краям экрана с настраиваемым ритмом BPM.',
  },
  {
    id: 'earthquakeShake',
    requiredTier: 'premium',
    category: 'fun',
    titleEn: 'Earthquake Screen Shake',
    titleRu: 'Эффект землетрясения',
    descEn: 'Subtle or chaotic tremor physics across your workspace with intensity control.',
    descRu: 'Лёгкая или мощная вибрация экрана с точной настройкой интенсивности.',
  },
  {
    id: 'textTransform',
    requiredTier: 'premium',
    category: 'fun',
    titleEn: 'UwU / 1337 / Reverse Lab',
    titleRu: 'UwU / 1337 / Реверс текста',
    descEn: 'Convert messages into UwU, hacker leetspeak, or mirrored text + show ticker banner.',
    descRu: 'Мгновенный переводчик фраз в UwU-стиль, 1337-хакерский сленг или реверс с бегущей строкой.',
  },
  {
    id: 'hackerHud',
    requiredTier: 'ultra',
    category: 'visual',
    titleEn: 'Epic Hacker Terminal HUD',
    titleRu: 'Эпичный хакерский HUD',
    descEn: 'Cinematic live telemetry & fake mainframe decryption stream pinned cleanly in the corner.',
    descRu: 'Кинематографичный мини-терминал с потоком телеметрии и взлома мейнфрейма в углу экрана.',
  },
  {
    id: 'soundboard',
    requiredTier: 'ultra',
    category: 'fun',
    titleEn: 'Ultra Prank Soundboard',
    titleRu: 'Ultra Саундборд пранков',
    descEn: 'Instant Web Audio effects (Airhorn, Vine Boom, Error, Siren, Level Up) locally or on targets.',
    descRu: 'Мгновенные звуки (Горн, Vine Boom, Ошибка Windows, Сирена, Level Up) у себя или на игроках.',
  },
];
