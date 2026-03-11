# Lexical Freemarker Plugin Library — Initial Requirements

## Goal
Build an npm library that adds Freemarker-aware editing support to Lexical editors (token awareness, parsing, validation hooks, and optional UI helpers).

## Product Scope (Phase 1)
1. Parse Freemarker syntax in text content:
   - Interpolations: `${...}`
   - Directives: `<#if>`, `<#list>`, `<#assign>`, etc.
   - Comments: `<#-- ... -->`
2. Expose typed parser output and diagnostics.
3. Provide Lexical integration primitives:
   - command registration helpers
   - node transform hooks
   - decorator/highlight utilities (non-destructive)
4. Ship as framework-agnostic TS package for React Lexical consumers.

## Non-Goals (Phase 1)
- Full Freemarker runtime evaluation
- Java-side template execution
- Auto-fixing invalid templates

## Functional Requirements
- FR1: Tokenizer must classify Freemarker blocks and return source ranges.
- FR2: Parser API must return stable typed structures consumable by Lexical plugins.
- FR3: API should support incremental parsing (or lightweight re-parse strategy) for editor updates.
- FR4: Diagnostic API should report unclosed/interrupted directives and malformed interpolations.
- FR5: Plugin API should allow host apps to subscribe to token/diagnostic events.

## Lexical Integration Requirements
- LR1: Works with current Lexical peer dependency range.
- LR2: Must not mutate editor state outside Lexical update transactions.
- LR3: Optional highlighting/decorations should be toggleable and style-agnostic.
- LR4: Should support read-only mode without runtime errors.

## Packaging Requirements
- PR1: Publish as npm package with ESM + CJS + d.ts outputs.
- PR2: Tree-shakable exports and clear entrypoints.
- PR3: Semantic versioning and changelog discipline.

## Quality Requirements
- QR1: Unit tests for tokenizer/parser edge cases.
- QR2: Integration tests for Lexical command/transform wiring.
- QR3: Lint + typecheck + build must pass in CI.

## Suggested Backlog for Codex Delegation
1. Implement robust tokenizer with exhaustive token types.
2. Add parser diagnostics model and error taxonomy.
3. Create `registerFreemarkerPlugin(editor, options)` helper.
4. Add optional decorator/highlight plugin for token classes.
5. Add Vitest suite with fixtures from Freemarker docs examples.
6. Add CI workflow (typecheck, test, build).
7. Add versioned release workflow.

## Manual Sources Downloaded Locally
Saved to `docs/freemarker-manual/` from Apache FreeMarker manual pages.
