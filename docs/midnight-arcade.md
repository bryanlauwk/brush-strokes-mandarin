# Midnight arcade redesign

The product is now **乱画俱乐部 · AFTERHOURS DRAW CLUB**, a phone-first Chinese drawing party for Malaysian friends. The visual language is charcoal, acid lime, lavender, and eight original vector creatures.

## Experience

- The homepage offers a small working guessing preview and two-step entry: nickname/character, then create/join.
- An invited player joins directly from the room URL.
- The lobby is a social space with the invite code, native sharing or copy-link fallback, player presence, and collapsed host settings.
- Gameplay allocates space to a proportional 4:3 canvas and a visible answer composer. The keyboard layout uses the visible viewport; chat expands when requested.
- Drawing uses labeled pen, eraser, fill, undo, clear, size and color controls. Palette swatches are horizontally scrollable touch targets.
- Round answers and final winners have separate presentations. The final screen has a podium and replay.
- Instructions, empty/error states, metadata and favicon use the new identity. Game sounds can be muted.

The UX-writing and accessibility review guided local language, explicit errors, Chinese IME handling, keyboard focus, reduced motion, text contrast and touch targets.

## Compatibility

Room services, themes, scoring, realtime synchronization, reconnect identities and normalized stroke coordinates are unchanged. Avatar SVGs remain within the existing server size and content limits. They are displayed as image resources rather than inserted HTML.

## Verification

Completed: production build, TypeScript, changed-file lint (one existing mixed-export fast-refresh warning), five rendering/compatibility checks, static mobile layout and contrast checks, whitespace check, and independent review of game-state wiring.

Browser visual verification was blocked because the computer-use browser could not verify its admin-enforced policy. No alternate browser method was used. The rendering tests are not end-to-end gameplay tests.

Before release, verify on an actual phone:

1. Create/join, Chinese keyboard candidate selection, and share sheet/copy fallback.
2. Draw and guess with two clients, including pen sizes, palette and eraser.
3. Observe canvas and composer with the keyboard open, browser bars changing, and landscape orientation.
4. Reveal, final podium, replay, disconnect/rejoin and sound mute.
5. Check 320px, 390px and desktop widths, text zoom and reduced motion.

The legacy Python browser scripts use previous UI labels and have not been represented as passing for this overhaul.
