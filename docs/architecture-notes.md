# Architecture Notes

Short version for future-you so you do not re-invent the repo by accident.

## Package boundaries

- Root package `@mininic-nt/lexical-freemarker` is the library.
- Keep the library runtime tied to **Lexical only**.
- Do **not** add `react`, `react-dom`, or `@lexical/react` to the root library package.
- React lives in the tester workspace under `apps/tester`.
- The tester is intentionally a **consumer implementation** of the library, not part of the library runtime surface.

## Parser layering

Current parsing lives in three layers:

1. `src/parser/ifExpressionParser.ts`
   - Validates expression strings used by directive heads.
   - Used as a grammar primitive, not an end-user API only.

2. `src/parser/directiveGrammar.ts`
   - Parses directive heads such as `if`, `list`, `assign`, `macro`, `attempt`, `switch`.
   - Owns directive boundary detection and block/branch classification.
   - This is the place to extend when adding more Freemarker directives.

3. `src/parser/parseTemplate.ts`
   - Tokenizes full templates.
   - Uses directive grammar instead of regex-only head parsing.
   - Owns diagnostics and stack-based open/close validation.

## Conditional node MVP

- `src/conditional/createIfNodeFactory.ts` is the current factory entry point.
- Serialization is model-driven.
- Fallback settings UI is framework-light raw HTML so the library stays React-free.
- The tester renders that fallback UI inside React via `dangerouslySetInnerHTML` on purpose.

## Tester app

- Location: `apps/tester`
- Role: live proving ground for parser diagnostics, serializer output, class-map styling, and Conditional insertion workflows.
- It should stay opinionated and useful for debugging, even if the library remains conservative.

## Scripts

From repo root:

- `npm run typecheck`
  - typechecks library + tester workspace
- `npm test`
  - builds library only, then runs library tests
- `npm run build`
  - builds library + tester workspace
- `npm run dev:tester`
  - runs the React tester app
- `npm run test:changed`
  - fast pre-commit path

## Guardrails

- If you need richer directive support, extend `directiveGrammar.ts` first.
- Avoid pushing parser behavior back into regexes unless you enjoy future regret.
- If you think "maybe the library should just depend on React now," the answer is still no.
