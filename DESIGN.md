---
name: HYRD Intelligence
colors:
  surface: '#0f1321'
  surface-dim: '#0f1321'
  surface-bright: '#353849'
  surface-container-lowest: '#0a0d1c'
  surface-container-low: '#171b2a'
  surface-container: '#1b1f2e'
  surface-container-high: '#262939'
  surface-container-highest: '#303444'
  on-surface: '#dfe1f6'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dfe1f6'
  inverse-on-surface: '#2c303f'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#ff516a'
  on-tertiary-container: '#5b0017'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#0f1321'
  on-background: '#dfe1f6'
  surface-variant: '#303444'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system is engineered for a high-stakes, AI-powered interview environment where clarity, speed, and sophistication are paramount. The brand personality is "The Silent Expert"—calm under pressure, technically superior, and deeply intuitive. 

The aesthetic sits at the intersection of **Minimalism** and **Glassmorphism**. It utilizes a "Dark Mode First" philosophy to reduce eye strain during long interview sessions, employing translucent layers and vibrant backdrop blurs to create a sense of depth and focus. This is a production-ready YC startup aesthetic: clean, expensive-looking, and devoid of unnecessary decorative clutter. The emotional response should be one of confidence and technological empowerment.

## Colors
The palette is rooted in a deep, void-like primary neutral (#050816) to establish a premium foundation. 

- **Primary Indigo (#6366f1):** Used sparingly for key actions, focus states, and AI-driven insights. It should feel like a soft glow rather than a flat block of color.
- **Surface Strategy:** Instead of solid grays, surfaces use high-transparency white overlays (3-8%) paired with `backdrop-filter: blur(12px)`. This creates the signature glassmorphic look.
- **Accents:** Secondary Emerald is used for "Success" or "Correct" signals, while Tertiary Rose is reserved for "Critical" or "Error" states. All accents should be slightly desaturated to maintain the sophisticated dark aesthetic.

## Typography
We utilize **Geist** for its technical precision and exceptional legibility in monospaced-adjacent grotesque forms. 

- **Hierarchy:** Display and Headline styles use tight letter-spacing and heavier weights to feel "engineered." 
- **Readability:** Body text uses a generous line height (1.6) to ensure AI-generated transcripts and notes are easily scannable during live interviews.
- **Labels:** Small labels use increased letter spacing and uppercase styling to denote metadata or status chips without competing with primary content.

## Layout & Spacing
The layout philosophy is **expansive and fluid**. We avoid dense, "dashboard-heavy" grids in favor of wide margins and generous vertical stacking.

- **Grid:** A 12-column system with a 24px gutter. On desktop, content is often centered with a max-width of 1440px to prevent information fragmentation.
- **Rhythm:** Spacing follows a 4px baseline, but primary component gaps should lean towards larger increments (24px, 48px) to reinforce the premium, "breathable" feel.
- **Adaptation:** On mobile, margins shrink to 16px, and multi-column layouts collapse into a single-column stack, prioritizing the video feed and the AI hint-card sequence.

## Elevation & Depth
Depth is communicated through **translucency and luminosity** rather than traditional drop shadows.

- **Tonal Layers:** The background is the lowest level. Surface containers sit "above" using a 1px border (`rgba(255, 255, 255, 0.08)`) and a subtle inner glow.
- **Active States:** High-priority elements (like an active AI suggestion) use a soft, indigo outer glow (`box-shadow: 0 0 30px rgba(99, 102, 241, 0.15)`).
- **Glassmorphism:** All modal overlays and cards must use `backdrop-filter: blur(16px)` to maintain context of the underlying video stream while ensuring legibility.

## Shapes
The shape language is sophisticated and approachable, defined by a consistent **20px (1.25rem)** corner radius for primary cards and containers.

- **Primary Components:** Cards, large inputs, and modals use the 20px radius (`rounded-xl`).
- **Interactive Elements:** Buttons and smaller chips use a slightly tighter 12px radius (`rounded-lg`) to feel more precise.
- **Indicators:** Status pips and small avatars remain fully circular.

## Components
- **Buttons:** Primary buttons use a solid Indigo background with a subtle top-light inner shadow. Secondary buttons are "ghost" style: 1px borders with a slight hover-fill of 5% white.
- **Input Fields:** Search and note inputs are dark glass containers with 1px borders that glow Indigo when focused. Labels sit above the input in `label-sm` style.
- **AI Suggestion Cards:** These are the centerpiece. They feature a 20px radius, a slightly thicker left-border accent in Indigo, and a very subtle pulse animation to indicate "Thinking" or "New Insight."
- **Chips/Badges:** Small, 12px rounded elements for skills or tags. Use a background of `rgba(255, 255, 255, 0.05)` and `label-sm` typography.
- **Video Feed:** Should be treated as a component with a 24px radius, featuring a subtle inner vignette to make UI overlays pop against the video content.
- **Live Transcript:** Uses a "faded" approach where older text reduces in opacity, keeping the focus on the current conversation.