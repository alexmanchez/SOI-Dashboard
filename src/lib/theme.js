// Catena design tokens — CSS variable references pointing to index.css :root declarations.
// All values are rgb(var(...)) so they respond to light/dark theme switches.

export const BG        = 'rgb(var(--catena-bg))';
export const PANEL     = 'rgb(var(--catena-panel))';
export const PANEL_2   = 'rgb(var(--catena-panel2))';
export const BORDER    = 'rgb(var(--catena-border))';
export const TEXT      = 'rgb(var(--catena-text))';
export const TEXT_DIM  = 'rgb(var(--catena-text-dim))';
export const TEXT_MUTE = 'rgb(var(--catena-text-mute))';
export const ACCENT    = 'rgb(var(--catena-accent))';
export const ACCENT_2  = 'rgb(var(--catena-accent2))';
export const GREEN     = 'rgb(var(--catena-green))';
export const RED       = 'rgb(var(--catena-red))';
export const GOLD      = 'rgb(var(--catena-gold))';
export const VIOLET    = 'rgb(var(--catena-violet))';

// Pre-computed alpha variants — replaces the old COLOR+'HH' hex-alpha string pattern.
// Hex suffix → approximate opacity: 11≈0.07  22≈0.13  33≈0.20  44≈0.27
export const ACCENT_11 = 'rgb(var(--catena-accent) / 0.07)';
export const ACCENT_22 = 'rgb(var(--catena-accent) / 0.13)';
export const ACCENT_33 = 'rgb(var(--catena-accent) / 0.20)';
export const ACCENT_44 = 'rgb(var(--catena-accent) / 0.27)';
export const GREEN_22  = 'rgb(var(--catena-green)  / 0.13)';
export const GREEN_44  = 'rgb(var(--catena-green)  / 0.27)';
export const RED_44    = 'rgb(var(--catena-red)    / 0.27)';
export const RED_66    = 'rgb(var(--catena-red)    / 0.40)';
export const GOLD_11   = 'rgb(var(--catena-gold)   / 0.07)';
export const GOLD_22   = 'rgb(var(--catena-gold)   / 0.13)';
export const GOLD_33   = 'rgb(var(--catena-gold)   / 0.20)';
export const GOLD_44   = 'rgb(var(--catena-gold)   / 0.27)';
export const VIOLET_11 = 'rgb(var(--catena-violet) / 0.07)';
export const VIOLET_22 = 'rgb(var(--catena-violet) / 0.13)';
export const VIOLET_33 = 'rgb(var(--catena-violet) / 0.20)';
export const VIOLET_44 = 'rgb(var(--catena-violet) / 0.27)';
