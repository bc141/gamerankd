# Gamdit Brand — Midnight Nova

This note defines the visual system for Gamdit. It is the single source of truth for tokens, controls, and gradient usage.

## Palette (names and intent)
- brand.gradient.start: Deep Midnight — anchor for hero gradients (backgrounds only)
- brand.gradient.end: Nova Violet — energetic edge of gradient (backgrounds only)
- brand.accent: Solid Violet — primary CTA, focus ring, key accents
- brand.spark: Cyan Spark — subtle highlight/selection tint
- neutral.bg: Base canvas (app background)
- neutral.bgElevated: Elevated layers (cards, sheets, menus)
- neutral.surface: Interactive surfaces (buttons, inputs, chips)
- neutral.border: Dividers and outlines
- text.strong: Primary text
- text.muted: Secondary/tertiary text
- status.success | warning | danger | info: Inline status, toasts, badges
- rating.star: Star icon tint for reviews

No raw hex in components. All styles reference tokens.

## Usage rules (Do / Don’t)
- Gradients live only on backgrounds/accent blocks. Never on text.
- One gradient hero per screen max (e.g., Discover header, featured card).
- Outline buttons by default; allow one solid primary CTA per view.
- Maintain AA contrast for text; visible 2px focus ring; minimum 44×44 tap targets.
- Prefer subtle elevation/shadow for speed and readability; avoid heavy blurs.

## Motion guidelines
- Durations: 150–200ms ease-out for hover/focus/press; 200–250ms for modal/hero entrances.
- Easing: ease-out or cubic-bezier(0.2, 0.8, 0.2, 1).
- Reduced Motion: Respect prefers-reduced-motion; disable non-essential transitions/animations.

## Gradient guidance
- Angle: Standardize at 135° (120°/135°/150° tested; 135° chosen for balance).
- Scale: Large blocks only (hero, featured panel). Consider subtle grain to avoid banding on wide areas.

## Controls hierarchy (buttons)
- Primary (Solid): single CTA per screen (e.g., Post). Reserved.
- Neutral (Outline): default everywhere else.
- Accent (Outline): emphasized but non-primary (e.g., Follow).
- Ghost (Text): low-emphasis inline actions.
- Destructive (Outline): irreversible actions.
- IconButton: icon-only; outline with subtle filled hover; must have accessible name.

### Sizes
- Small, Medium (default), Large — consistent heights and paddings; align to 8-pt rhythm.

### States
- default, hover (faint tint), pressed (slightly deeper/1px down), focus-visible (2px accent ring), disabled, loading (aria-busy).

### Content rules
- Sentence case labels; concise; icon left of text; avoid long labels.

## Accessibility
- Contrast: AA for text and icons on surfaces.
- Focus: Always visible, 2px ring in brand.accent with proper contrast.
- Icon-only controls require aria-label.

## Enforcement
- Tokens-first: all styles must reference tokens.
- PRs include mapping tables and screenshots (mobile/tablet/desktop) and must pass Axe checks with 0 serious/critical issues.
