export interface AchievementData {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS_DB: Record<string, AchievementData> = {
  early_adopter: { id: 'early_adopter', icon: '🚀', title: 'Early Adopter', description: 'Joined early beta' },
  first_publish: { id: 'first_publish', icon: '🎮', title: 'First Publish', description: 'Published an app' },
  popular_creator: { id: 'popular_creator', icon: '🔥', title: 'Popular Creator', description: 'Got 10+ downloads' },
  vip_member: { id: 'vip_member', icon: '⭐', title: 'VIP Member', description: 'Admin/Dev role' },
  creative_soul: { id: 'creative_soul', icon: '🎨', title: 'Creative Soul', description: 'Created first block' },
  code_trainer: { id: 'code_trainer', icon: '🎓', title: 'Code Trainer', description: 'Finished Tutorial' },
  vibe_coding: { id: 'vibe_coding', icon: '🤖', title: 'Vibe Coding', description: 'Used AI Agent' },
  together_create: { id: 'together_create', icon: '🤝', title: "Don't create alone!", description: 'Together Create' },
  trader: { id: 'trader', icon: '🏪', title: 'The Trader', description: 'Published to Asset Store' },
  gamer: { id: 'gamer', icon: '🕹️', title: 'Gamer', description: 'Downloaded a game' },
};
