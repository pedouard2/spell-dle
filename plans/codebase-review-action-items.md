# Codebase Review Action Items

Date: 2026-03-22  
Scope reviewed: `app/`, `app/utils/`, root config/docs, npm scripts

## P0 - Must Fix Immediately

1. Fix failing ESLint errors so CI/local quality gates pass.
   - Evidence:
     - `app/page.tsx:176`, `app/page.tsx:185`, `app/utils/game-logic.ts:57` (`no-explicit-any`)
     - `app/page.tsx:347` (`react/no-unescaped-entities`)
   - Action:
     - Replace `any` with concrete API response interfaces and typed error handling.
     - Escape quote characters in JSX or render quotes via entities.
   - Done when:
     - `npm run lint` exits with code 0 and no errors.

2. Prevent duplicate `loadWord()` calls on reset/mode change (race + extra network requests).
   - Evidence:
     - `resetGame()` calls `loadWord()` directly (`app/page.tsx:135-143`).
     - `useEffect` also calls `loadWord()` on difficulty changes (`app/page.tsx:79-86`).
   - Action:
     - Centralize word loading in one path (prefer effect-driven flow).
     - Remove direct fetch call from `resetGame()` or add guard/debounce.
   - Done when:
     - One mode switch/reset triggers exactly one dictionary request.

## P1 - High Priority

3. Resolve stale closure risks in hooks.
   - Status: Completed (2026-03-22)
   - Evidence:
     - `react-hooks/exhaustive-deps` warnings at `app/page.tsx:72`, `86`, `93`.
   - Action:
     - Memoize `resetGame`, `loadWord`, `playAudio` with `useCallback` or restructure effects.
     - Include full dependency arrays and explicit cancelation strategy.
   - Done when:
     - `npm run lint` has zero hook dependency warnings.

4. Add abort/race handling for async word generation in infinite mode.
   - Status: Completed (2026-03-22)
   - Evidence:
     - `getTargetWord()` may await network (`app/utils/game-logic.ts:90-96`) without abort support.
     - `loadWord()` sets state after async boundaries (`app/page.tsx:154-183`).
   - Action:
     - Introduce request ID or mounted token check before `setTargetWord`/`setWordData`.
     - Support `AbortSignal` propagation into Datamuse fetch.
   - Done when:
     - Rapid difficulty/mode changes cannot show stale words/data.

5. Fix unreachable error UI path for "No words generated".
   - Status: Completed (2026-03-22)
   - Evidence:
     - `setErrorMsg(...)` then early return while status stays `'loading'` (`app/page.tsx:156`).
     - Render prioritizes loading spinner over error (`app/page.tsx:333-337`).
   - Action:
     - Set `status` to a non-loading error state, or reorder render conditions.
   - Done when:
     - Simulated no-word condition visibly renders an error message.

## P2 - Medium Priority

6. Add test infrastructure and baseline coverage for core game logic.
   - Status: Completed (2026-03-22)
   - Evidence:
     - No `test` script in `package.json`.
   - Action:
     - Add Vitest/Jest + React Testing Library.
     - Cover difficulty transitions, daily determinism, infinite fallback, misspelling tracking.
   - Done when:
     - `npm test` exists and runs deterministic unit tests for `app/utils/game-logic.ts`.

7. Remove or implement unused dependency `@mlc-ai/web-llm`.
   - Status: Completed (2026-03-22)
   - Evidence:
     - Declared in `package.json:12`; no references in source.
   - Action:
     - Delete dependency if not planned, or add feature/docs proving usage.
   - Done when:
     - `npm ls @mlc-ai/web-llm` aligns with intentional use.

8. Improve metadata and project docs from template defaults.
   - Status: Completed (2026-03-22)
   - Evidence:
     - `app/layout.tsx:16-17` default title/description.
     - `README.md` still generic create-next-app text.
   - Action:
     - Replace with product-specific metadata and setup/gameplay docs.
   - Done when:
     - App and README accurately describe Spell-DLE behavior and commands.

9. Tighten input UX validation.
   - Status: Completed (2026-03-22)
   - Evidence:
     - Empty submissions can be recorded as misspellings (`app/page.tsx:226-236`).
   - Action:
     - Ignore empty/whitespace-only guesses and show a lightweight prompt.
   - Done when:
     - Empty submit does not mutate misspelling history.

## P3 - Nice to Have

10. Separate game state/logic from presentation.
    - Status: Completed (2026-03-22)
    - Evidence:
      - `app/page.tsx` is monolithic (~420 lines).
    - Action:
      - Extract custom hooks/components (`useGameState`, `GameHeader`, `ResultPanel`, etc.).
    - Done when:
      - Main page becomes orchestration-focused; logic is unit-testable in isolation.

11. Improve accessibility semantics.
    - Status: Completed (2026-03-22)
    - Evidence:
      - Audio/hint controls rely on icon/text with no explicit ARIA labels.
    - Action:
      - Add `aria-label`, keyboard focus states, and screen reader hints for mode/difficulty feedback.
    - Done when:
      - Core loop is fully usable via keyboard and announced meaningfully by assistive tech.

## Validation Checklist (After Changes)

- `npm run lint` passes with no warnings/errors.
- `npm run build` passes.
- Manual QA:
  - Daily flow from start to completion.
  - Infinite mode loops correctly at hard difficulty.
  - Offline/failed API path still playable.
  - No duplicate request bursts on reset/mode switch.
