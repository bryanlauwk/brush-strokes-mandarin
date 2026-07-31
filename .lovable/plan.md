# Fix Homepage Left / Right Section Alignment

## Problem
The homepage main grid uses `items-center`, so the shorter left column (hero + steps) is vertically centered against the taller right column (the form panel). Visually, the left section sits in the middle of the right section instead of aligning with its top.

## Proposed Change
- In `src/routes/index.tsx`, update the `<main>` grid layout from `items-center` to `items-start content-center`.
- `items-start` makes both the left hero section and the right form panel start at the same vertical line (top-aligned).
- `content-center` keeps the overall grid centered vertically in the viewport, so the page still feels balanced.
- Keep the existing gap (`gap-5`) and grid columns (`lg:grid-cols-[minmax(0,1fr)_440px]`).

## Verification
- Preview the homepage on desktop and confirm the left hero block and the right "准备开玩" panel share the same top edge.
- Check mobile layout to ensure no regression on the single-column view.
