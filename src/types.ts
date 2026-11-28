export type AppCategory = 'games' | 'apps' | 'work' | 'AI' | 'Programming Language' | 'Store' | 'Custom Editor' | 'Other';

export interface StoreAsset {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  price: number;
  stock: number | 'infinite';
  authorId: string;
  authorName: string;
  type: 'style' | 'mod' | 'editor' | 'inventory';
  content: string;
  status?: 'pending' | 'verified';
  visits?: number;
  version?: string;
  createdAt: string;
}

export interface AppData {
  id: string;
  title: string;
  description: string;
  code: string;
  version: string;
  category: AppCategory;
  supportedPlatforms?: string[];
  windowsUrl?: string;
  macosUrl?: string;
  linuxUrl?: string;
  apkUrl?: string;
  authorId: string;
  authorName: string;
  iconUrl?: string;
  screenshotUrl?: string;
  bannerUrl?: string;
  isAiGenerated?: boolean;
  isPrivate?: boolean;
  isLocked?: boolean;
  unlockCode?: string;
  allowCopy?: boolean;
  originalAppId?: string;
  originalAppName?: string;
  status?: 'pending' | 'verified' | 'rejected';
  isVerified: boolean;
  moderationStatus?: 'approved' | 'rejected' | 'pending';
  moderationReason?: string;
  moderationFlags?: string[];
  moderatedAt?: string;
  moderatedBy?: string;
  price?: number;
  downloads: number;
  likes: number;
  dislikes: number;
  rating: number;
  visits?: number;
  isWebsite?: boolean;
  websiteDomain?: string;
  hideWatermark?: boolean;
  events?: Array<{ title: string; description: string; imageUrl?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface AiModerationLog {
  id: string;
  appId: string;
  appTitle: string;
  authorId: string;
  authorName: string;
  approved: boolean;
  reason: string;
  flags: string[];
  riskScore: number;
  model: string;
  createdAt: string;
  codeSnippet?: string;
  manualOverride?: boolean;
  manualReviewer?: string;
}

export interface UserVote {
  userId: string;
  appId: string;
  type: 'like' | 'dislike';
}

export type PremiumTier = 'none' | 'plus' | 'premium' | 'ultra';

export interface Review {
  id: string;
  appId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  premiumTier?: PremiumTier;
  rating: number;
  comment: string;
  aiChecked?: boolean;
  createdAt: string;
}

export interface PremiumChatThread {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  premiumTier?: PremiumTier;
  lastMessage: string;
  lastSenderRole?: 'user' | 'developer';
  lastMessageAt: string;
  unreadForDev?: boolean;
  unreadForUser?: boolean;
}

export interface PremiumChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'developer';
  text: string;
  createdAt: string;
}

export interface RemoteControlCommand {
  commandId: string;
  type: 'navigate' | 'setCode' | 'setTheme' | 'setComputerStyle' | 'setFrutigerAero' | 'prank' | 'sound' | 'toast';
  payload: any;
  timestamp: string;
}

export interface RemoteControlSession {
  targetUid: string;
  targetName?: string;
  controllerUid: string;
  controllerName: string;
  status: 'active' | 'declined' | 'ended';
  command?: RemoteControlCommand;
  declinedAt?: string;
  updatedAt: string;
}

export interface TrollInboxEvent {
  eventId: string;
  targetUid: string;
  senderUid: string;
  senderName?: string;
  kind: 'troll_message' | 'prank_fx' | 'soundboard' | 'clear';
  title?: string;
  message?: string;
  style?: 'neon' | 'retro' | 'drama' | 'hacker';
  effect?: string;
  durationMs?: number;
  sound?: string;
  createdAt: string;
}

export interface EplCustomCategory {
  id: string;
  label: string;
  color?: string;
  icon?: string;
}

export interface EplCustomTab {
  id: string;
  label: string;
  categoryId: string;
  icon?: string;
  color?: string;
  badge?: string;
  subtitle?: string;
  eplCode: string;
}

export interface EplCustomWidget {
  id: string;
  kind: 'badge' | 'button' | 'card' | 'banner' | 'epl-mini-app' | 'sticker';
  text: string;
  subtext?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: number;
  fontSize?: number;
  targetView?: string;
  eplCode?: string;
  visibleOn?: 'all' | string;
}

export interface EplTabOverlay {
  code: string;
  position: 'top' | 'bottom' | 'replace' | 'floating';
  height?: number;
}

export interface EplSiteThemeSpec {
  canvasBg?: string;
  canvasGradient?: string;
  sidebarBg?: string;
  cardBg?: string;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  borderColor?: string;
  borderRadius?: number;
  fontFamily?: 'default' | 'mono' | 'space' | 'serif' | 'rounded';
  fontScale?: number;
  sidebarWidth?: number;
  sidebarSide?: 'left' | 'right';
  glassBlur?: number;
  glowIntensity?: number;
  bgEffect?: 'none' | 'grid' | 'dots' | 'scanlines' | 'stars' | 'aurora' | 'matrix';
}

export interface EplSiteCustomizationSpec {
  brandTitle?: string;
  brandSubtitle?: string;
  brandBadge?: string;
  brandIcon?: 'terminal' | 'sparkles' | 'crown' | 'rocket' | 'globe' | 'gamepad' | 'cpu';
  theme: EplSiteThemeSpec;
  labelOverrides: Record<string, string>;
  domTextOverrides: Record<string, string>;
  domStyleOverrides: Record<
    string,
    {
      bg?: string;
      color?: string;
      borderColor?: string;
      radius?: number;
      fontSize?: number;
      tx?: number;
      ty?: number;
      hidden?: boolean;
    }
  >;
  categoryOrder?: string[];
  categoryNames?: Record<string, string>;
  categoryColors?: Record<string, string>;
  tabOrders?: Record<string, string[]>;
  hiddenTabIds?: string[];
  customCategories: EplCustomCategory[];
  customTabs: EplCustomTab[];
  widgets: EplCustomWidget[];
  tabEplOverlays: Record<string, EplTabOverlay>;
  globalEplCode?: string;
}

export interface EplShopItem {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  screenshotUrl: string;
  price: number;
  stock: number | 'infinite';
  sales?: number;
  authorId: string;
  authorName: string;
  spec: EplSiteCustomizationSpec;
  status?: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

