# Spell-DLE

Spell-DLE is a Next.js spelling game where players hear a word, read a definition clue, and type the correct spelling.

## Features

- `Daily` mode: deterministic easy -> medium -> hard sequence.
- `Infinite` mode: unlimited rounds at the selected difficulty.
- Pronunciation from dictionary audio when available, with speech-synthesis fallback.
- Misspelling history with edit-distance feedback at end-of-run.

## Tech Stack

- Next.js `App Router` + React + TypeScript
- Tailwind CSS (v4)
- Datamuse API (infinite word generation)
- DictionaryAPI (definitions and pronunciation audio)

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev`: start local dev server.
- `npm run lint`: run ESLint checks.
- `npm run test`: run unit tests with Vitest.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run build`: production build.
- `npm run start`: serve production build.

## Project Structure

- `app/page.tsx`: game loop, UI, mode/difficulty flow.
- `app/utils/game-logic.ts`: daily seed logic and infinite API word selection.
- `app/utils/game-logic.test.ts`: unit coverage for core word-selection behavior.
- `app/globals.css`: global styles and animation tokens.

## Testing Focus

Current baseline tests cover:

- deterministic daily selection behavior
- difficulty rank-band selection
- infinite-mode API success path
- infinite-mode fallback path
- cancellation behavior (`AbortError`) propagation

## Notes

- No secrets are required for local usage.
- App remains playable when external API calls fail (offline/fallback definition mode).
