export function getDefaultAvatar(seed: string): string {
  const emojis = ['😀', '😎', '🤖', '👾', '👻', '👽', '🤠', '🤡', '🦁', '🦊', '🐻', '🐼', '🐨', '🐯', '🦄', '🐰', '🐸', '🐵', '🦉', '🐙'];
  const hash = seed ? seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const emoji = emojis[hash % emojis.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
export const DEFAULT_EMOJIS = ['😀', '😎', '🤖', '👾', '👻', '👽', '🤠', '🤡', '🦁', '🦊', '🐻', '🐼', '🐨', '🐯', '🦄', '🐰', '🐸', '🐵', '🦉', '🐙'];
export function getEmojiAvatar(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
