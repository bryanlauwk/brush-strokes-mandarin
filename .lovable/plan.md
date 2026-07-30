# Plan: Homepage "画啦猜啦" headline fix & visual upgrade

## What we saw

The desktop screenshot at 1280 px shows **"画啦猜啦" breaking into two lines** ("画啦猜" / "啦"). Root cause: the left column is forced by `xl:grid-cols-[minmax(0,1fr)_300px]` to be narrower than the 8xl title, so the last character wraps. The user wants the title **always one line**, and the homepage **more fun / less flat** (animation level 4/5).

## Proposed changes

### 1. Headline: force single-line, size it per breakpoint

- Add `whitespace-nowrap` to the `<h1>`.
- Scale down the font on the breakpoints that currently wrap: `text-5xl sm:text-6xl lg:text-7xl xl:text-8xl`.
- Slightly widen the left column on XL so the title + preview card sit comfortably side-by-side without squeezing.

### 2. Title block: add a readable "paper" backing

- Wrap the title + subtitle in a small semi-transparent card / gradient blob so the text no longer floats directly on the busy Ukiyo-e illustration.
- Keep the brush style: preserve the existing `ink-title` text shadow.

### 3. Lively animations (level 4 — fun but not overwhelming)

- **Staggered title entrance**: each character of "画啦猜啦" pops in with a slight delay, using the existing `pop-in` keyframe.
- **Brush-stroke underline**: an animated stroke appears under the title on load (SVG or CSS pseudo-element).
- **Floating decorations**: slow CSS-only floating ink dots / sakura petals around the hero section.
- **Sparkle badge**: the top "马来西亚华语画猜" chip gets a gentle pulse.
- **Button micro-interactions**: enhance the existing `press` utility with a small bounce and color shift on hover.

### 4. Hero layout balance

- Adjust the XL grid ratio so the title column is not starved for space.
- On tablet/mobile, keep the title + subtitle on top, then the preview card, then the form — the current mobile order is fine but spacing will be tightened.

### 5. Form panel polish

- Restyle the "准备开玩" header into a bolder stamp/badge look with the paper texture.
- Add a small theme color/icon hint next to each theme option (or just the selected one) to make the theme selector feel less like a plain dropdown.

## Files to edit

- `src/routes/index.tsx` — headline sizing, title backing wrapper, animation classes, form header.
- `src/styles/home-ukiyo.css` — floating ink/petal decorations, title-area veil, responsive adjustments.
- `src/styles.css` — extend `ink-title` / `press` utilities and add any new keyframes needed.

## Out of scope

- No backend changes.
- No game logic changes.
- No new routes or dependencies.