export type AppCategory = 'games' | 'apps' | 'work' | 'AI' | 'Programming Language' | 'Store' | 'Other';

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
  downloads: number;
  likes: number;
  dislikes: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserVote {
  userId: string;
  appId: string;
  type: 'like' | 'dislike';
}

export interface Review {
  id: string;
  appId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}
