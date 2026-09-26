export const colors = {
  background: '#15131C',
  surface: '#1F1C29',
  text: '#F2EDE4',
  textSecondary: '#8B87A0',
  accent: '#E3A548',
  accentSoft: 'rgba(227, 165, 72, 0.22)',
  border: '#2A2635',
  // Destructive actions (delete highlight / note).
  danger: '#FF746C',
  dangerSoft: 'rgba(255, 116, 108, 0.28)',
};

// Highlight colors the user can ask for by name ("highlight that in blue").
// Yellow is the default and matches the app's amber accent.
export const HIGHLIGHT_COLORS = {
  yellow: '#E3A548',
  orange: '#F0954A',
  green: '#6CC08B',
  blue: '#6AA6F2',
  pink: '#F07FB5',
  purple: '#AE8CF2',
} as const;

export type HighlightColorName = keyof typeof HIGHLIGHT_COLORS;
export const HIGHLIGHT_COLOR_NAMES = Object.keys(HIGHLIGHT_COLORS) as HighlightColorName[];

// '#RRGGBB' → 'rgba(r, g, b, alpha)' for translucent highlight backgrounds.
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
