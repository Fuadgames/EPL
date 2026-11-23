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

