# 乱画俱乐部 · AFTERHOURS DRAW CLUB

给马来西亚朋友的午夜华语画猜派对。2–12 人，免注册，手机即玩。选一个怪可爱的分身，把房号丢进群，轮流画画、抢答、比默契。

The interface uses a phone-first midnight arcade system: charcoal surfaces, acid lime actions, lavender characters, and a light 4:3 drawing canvas. The lobby, drawing round and final podium each have a dedicated layout. Game rules and reconnect identities remain compatible.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chineseskribbl.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f16726b3-91c3-4723-b062-f6b732d5c207).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## UI checks

With Bun installed, run `bun test tests/ui/arcade.test.tsx` for the avatar compatibility and component rendering checks. `bunx tsc --noEmit` checks types and `bun run build` builds the app.

The older Python browser scripts under `tests/e2e/` refer to the previous interface. Their screen text and selectors need updating before they can exercise the redesigned entry flow.
