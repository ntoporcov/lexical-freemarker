# @mininic-nt/lexical-freemarker

Lexical plugin utilities for working with Freemarker template syntax.

> This repo moves fast. The code should still be deterministic, even if the vibes are reckless.

## Install

```bash
npm i @mininic-nt/lexical-freemarker lexical
```

This library stays framework-light. React support lives in the tester app, not in the library package runtime.

## Conditional Node MVP

```ts
import {
  createIfNodeFactory,
  parseIfBlock,
  parseTemplate,
  registerFreemarkerPlugin,
} from '@mininic-nt/lexical-freemarker';

const ifFactory = createIfNodeFactory();

const result = parseTemplate('<#if (user.age > 18)>Adult</#if>');
console.log(result.tokens, result.diagnostics);

const block = parseIfBlock(`
<#if (user.age > 18)>
  Adult
<#else>
  Minor
</#if>
`);

console.log(block.settings.ifExpression);
```

`createIfNodeFactory()` ships with:
- a typed factory contract for Conditional nodes
- a minimal fallback settings panel renderer
- class-map styling hooks for host apps
- deterministic Freemarker serialization with optional override support

## Tester App

A separate React/Vite tester app lives in [apps/tester](/Users/mininic/LexicalFreemarker/apps/tester).
It is intentionally a React implementation of the library rather than a library dependency.

It includes:
- a Lexical editor instance with the Conditional node class enabled
- live diagnostics via `registerFreemarkerPlugin`
- serializer output previews
- conditional insertion controls
- a class-map preset playground for the fallback settings UI
- manual parse-back from output into Lexical via `Parse Into Lexical`
- node-level Freemarker error containment so malformed `<#if` blocks become error cards instead of editor-wide failures

## Future Context

Repo architecture notes for future maintainers and future context windows live in [docs/architecture-notes.md](/Users/mininic/LexicalFreemarker/docs/architecture-notes.md).

GitHub Pages deployment is defined in [.github/workflows/deploy-pages.yml](/Users/mininic/LexicalFreemarker/.github/workflows/deploy-pages.yml). The remaining manual step, if needed, is setting the repository Pages source to **GitHub Actions** in GitHub settings.

The tester now supports plain-text, markdown, and HTML round-trip editing with Freemarker If cards preserved as raw template blocks between rich-text segments. Editor-to-output sync stays live; output-to-editor sync is manual so imported failures stay contained. Markdown/HTML import is best-effort and intentionally favors editor stability over perfect fidelity.

## Development

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Tester app only:

```bash
npm run dev:tester
npm run build:tester
```

Fast pre-commit path:

```bash
npm run test:changed
```
