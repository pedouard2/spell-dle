# Repository Guidelines

## Project Structure & Module Organization
Core code lives in `app/` (Next.js App Router). `app/page.tsx` contains the game UI and state flow, while shared logic belongs in `app/utils/` (for example, `game-logic.ts` for word selection rules). Global styles are in `app/globals.css`, static assets are in `public/`, and framework/tooling config is at the root (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`).

## Build, Test, and Development Commands
Run commands from the repository root:

- `npm install`: install dependencies.
- `npm run dev`: start local development server at `http://localhost:3000`.
- `npm run build`: create a production build.
- `npm run start`: serve the built app.
- `npm run lint`: run ESLint (Next.js Core Web Vitals + TypeScript rules).

There is currently no `npm test` script in this project.

## Coding Style & Naming Conventions
Use TypeScript with strict typing (`tsconfig.json` has `"strict": true`). Follow existing style: 2-space indentation, semicolons, and single quotes. Use:

- `PascalCase` for React component/type names.
- `camelCase` for variables, functions, and hooks.
- Clear, descriptive names for game states and handlers (for example, `handleSubmit`, `currentMisspellings`).

Prefer the `@/*` path alias for internal imports when practical.

## Testing Guidelines
Automated tests are not set up yet. For new logic-heavy work, add tests alongside the feature using `*.test.ts` / `*.test.tsx` naming (for example, `app/utils/game-logic.test.ts`). At minimum, include manual verification steps in the PR:

- daily and infinite mode flows
- difficulty transitions (`easy -> medium -> hard`)
- API-failure fallback behavior

## Commit & Pull Request Guidelines
Git history is minimal, so use a clear, conventional format going forward: short imperative subject, optional scope (for example, `feat: add retry limit for dictionary fetch`). Keep commits focused.

PRs should include:

- what changed and why
- linked issue (if available)
- manual test notes
- screenshots/GIFs for UI changes

## Security & Configuration Tips
Do not commit secrets or local env files (`.env*` is ignored). This app calls external dictionary/word APIs; preserve graceful error handling and fallback paths when modifying network logic.
