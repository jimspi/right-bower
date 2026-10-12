# Right Bower

A mobile-first, single-player **Euchre** game built as a Progressive Web App. You sit South and play with the computer partner at North against two computer opponents. No backend, no database, no accounts: everything runs on your device and works offline once loaded.

## How to play

- 24-card deck (9–A in four suits), 5 cards each, a 4-card kitty with a turned-up card.
- **Trump order:** right bower (J of trump) > left bower (J of the same color, which *is* trump) > A, K, Q, 10, 9. Other suits rank A, K, Q, J, 10, 9.
- **Bidding:** round 1 you may order up the upcard's suit (the dealer picks it up and discards). If all pass, round 2 lets you name any other suit. If all pass again the hand is thrown in. Optional **Stick the Dealer**. Whoever calls trump can **go alone**.
- **Play:** five tricks, you must follow suit (the left bower counts as trump).
- **Scoring:** makers take 3–4 tricks = 1, march = 2 (4 if alone), euchred = 2 to the defenders. First to 10 wins.

The in-app **Menu → How to Play** has the full rules.

## Features

- Pure TypeScript game engine (`lib/euchre`) with a reducer/state machine, independent of React.
- Computer players that bid by hand strength and position, count cards, win cheaply, and avoid trumping their partner.
- Custom SVG cards, logo, and card back (no copyrighted art); four-color suit option.
- Saved game, settings, and lifetime record in `localStorage`.
- Installable PWA with offline support (service worker) and iOS Home Screen metadata.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine unit tests + 1,000-game AI simulation
npm run lint
npm run type-check
npm run build && npm start
npm run icons      # regenerate icons/OG image from public/logo.svg
```

## Tech stack

Next.js (App Router), TypeScript, Tailwind CSS v4, Framer Motion, Vitest, sharp (icon generation).

## Project layout

```
lib/euchre/   engine (rules, reducer), AI, tests
lib/          persistence, haptics/sound, useGame hook
components/   Game table, cards, sheets (menu/rules/settings)
public/       logo, icons, manifest, service worker
scripts/      generate-icons.mjs
```
