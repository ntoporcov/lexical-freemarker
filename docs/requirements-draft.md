# Lexical Freemarker — Requirements Draft (v0)

_Status: Draft for discussion (not finalized)_

## 1) Purpose
Build an npm library that adds first-class **Freemarker template awareness** to Lexical editors so users can safely author mixed rich text + Freemarker syntax.

## 2) Primary Users
- Product/dev teams building editors where template placeholders and directives are common
- Developers integrating Lexical into internal tools/CMS workflows

## 3) Core Problems to Solve
1. Freemarker syntax is hard to edit safely in rich text editors.
2. Users need fast feedback when syntax is malformed.
3. Hosts need extensible APIs to react to tokens/diagnostics.

## 4) Phase 1 Scope (MVP)
### In scope
- Parse and classify:
  - Interpolations: `${...}`
  - Directives: `<#if>`, `<#list>`, `<#assign>`, etc.
  - Comments: `<#-- ... -->`
- Return token ranges for highlighting and tooling.
- Basic diagnostics:
  - unclosed interpolation/directive/comment
  - malformed directive shape (best-effort)
- Lexical integration helper(s):
  - register plugin behavior on editor updates
  - expose callback hooks for tokens + diagnostics

### Out of scope
- Running/evaluating Freemarker templates
- Full Freemarker semantic validation parity with Java runtime
- Auto-repair of broken templates

## 5) Functional Requirements
- **FR-1 Tokenization:** Deterministic token stream with stable offsets.
- **FR-2 Parsing API:** `parseTemplate(input)` returns `{ tokens, diagnostics }`.
- **FR-3 Incremental strategy:** Re-parse should be fast enough for typing latency targets.
- **FR-4 Diagnostics model:** Include code, message, severity, start/end.
- **FR-5 Plugin hooks:** Host can subscribe to parse output per editor update.

## 6) Non-Functional Requirements
- **NFR-1 Performance:** Target < 10ms parse for typical document snippets (~5–20KB).
- **NFR-2 Safety:** No editor state mutation outside Lexical update cycle.
- **NFR-3 Packaging:** ESM + CJS + d.ts, tree-shakable exports.
- **NFR-4 Reliability:** Unit tests for edge cases from Freemarker manual examples.

## 7) API Shape (Draft)
```ts
export interface ParseResult {
  tokens: FreemarkerToken[];
  diagnostics: FreemarkerDiagnostic[];
}

export function parseTemplate(input: string): ParseResult;

export interface RegisterFreemarkerOptions {
  onParse?: (result: ParseResult) => void;
  enabled?: boolean;
}

export function registerFreemarkerPlugin(
  editor: LexicalEditor,
  options?: RegisterFreemarkerOptions,
): () => void; // unregister
```

## 8) Acceptance Criteria (MVP)
- Given valid Freemarker snippets, parser returns accurate token boundaries.
- Given malformed snippets, diagnostics identify key issue location.
- Integration helper can be attached/removed without leaks.
- Build/test/typecheck pass in CI.

## 9) Open Questions
1. Should highlighting ship in core package or optional sub-package?
2. Should diagnostics severity be only `error|warning` for MVP?
3. Do we need directive-specific token subtypes in MVP (`ifOpen`, `ifClose`, etc.)?
4. Should we preserve plain-text spans as explicit `text` tokens?
5. For default UI, do we expose a global class map only, or class map + per-node overrides?

## 10) Proposed Technical Direction (Nic Draft)

### Core model
- Library exports **ready-to-use Lexical Node factories** for Freemarker constructs.
- Goal is broad coverage over time: directives, built-ins/method-like constructs, and template structures.
- Node internals are mostly schema-driven; by default nodes are **content-agnostic** (they store config + body, not semantic runtime validation).

### Node factory contract
Each node type should be created via factory helpers so host apps can provide UI and serialization behavior:

```ts
type CreateIfNodeOptions = {
  type?: string; // optional custom node type key
  renderSettingsPanel: React.ComponentType<IfSettingsPanelProps>;
  toFreemarker?: (node: IfNodeModel, ctx: SerializeContext) => string;
};
```

- `renderSettingsPanel`: host-provided React UI used inside editor workflows to edit node settings.
- `toFreemarker`: optional host override for serialization rules (fallback to library default serializer).

### Conditional node (first implementation target)
Initial conditional node data model should include:
- `ifExpression: string`
- `content: Lexical child content`
- `elseContent: Lexical child content` (optional but supported by model)

Default Freemarker output target:

```ftl
<#if {ifExpression}>
  {content}
<#else>
  {elseContent}
</#if>
```

### Integration expectation
- Consumer app already has Lexical running.
- Consumer installs package, registers generated nodes/plugins, and wires host UI.
- Library provides primitives + defaults; host app controls UX details.

### Default/Fallback UI strategy
- Ship a **minimal raw-HTML fallback UI** for each node settings panel so integration works out of the box.
- Allow full replacement with host-provided React components.
- Expose styling hooks for Tailwind/class-based styling via a class map API:

```ts
export type FreemarkerUiClassMap = {
  panel?: string;
  section?: string;
  label?: string;
  input?: string;
  textarea?: string;
  helpText?: string;
  button?: string;
  buttonPrimary?: string;
  buttonDanger?: string;
  row?: string;
  column?: string;
  errorText?: string;
};

export interface FreemarkerUiOptions {
  classes?: FreemarkerUiClassMap; // global defaults
  perNodeClasses?: Record<string, Partial<FreemarkerUiClassMap>>; // optional per-node overrides
}
```

- Class map should apply to "every tidbit" of fallback settings UI to make Tailwind adoption straightforward.

## 11) API Contracts (Draft for Codex)

### 11.1 Shared types
```ts
import type { LexicalEditor, LexicalNode } from 'lexical';
import type { ComponentType } from 'react';

export type FreemarkerDirectiveKind =
  | 'if'
  | 'list'
  | 'assign'
  | 'macro'
  | 'attempt'
  | 'switch'
  | (string & {});

export interface FreemarkerSerializeContext {
  newline: '\n' | '\r\n';
  indent: (depth: number) => string;
  escapeExpression?: (raw: string) => string;
}

export interface FreemarkerDiagnostic {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  start: number;
  end: number;
}
```

### 11.2 UI hooks and class styling
```ts
export type FreemarkerUiClassMap = {
  panel?: string;
  section?: string;
  label?: string;
  input?: string;
  textarea?: string;
  helpText?: string;
  button?: string;
  buttonPrimary?: string;
  buttonDanger?: string;
  row?: string;
  column?: string;
  errorText?: string;
};

export interface FreemarkerUiOptions {
  classes?: FreemarkerUiClassMap;
  perNodeClasses?: Record<string, Partial<FreemarkerUiClassMap>>;
}

export interface SettingsRenderProps<TSettings> {
  value: TSettings;
  onChange: (next: TSettings) => void;
  classes: FreemarkerUiClassMap;
  diagnostics?: FreemarkerDiagnostic[];
}
```

### 11.3 Conditional node contracts
```ts
export interface IfNodeSettings {
  ifExpression: string;
}

export interface IfNodeModel {
  kind: 'if';
  settings: IfNodeSettings;
  contentNodeKeys: string[];
  elseContentNodeKeys?: string[];
}

export interface CreateIfNodeFactoryOptions {
  type?: string;
  ui?: FreemarkerUiOptions;
  renderSettingsPanel?: ComponentType<SettingsRenderProps<IfNodeSettings>>;
  toFreemarker?: (node: IfNodeModel, ctx: FreemarkerSerializeContext) => string;
}

export interface IfNodeFactory {
  nodeType: string;
  createInitialNode: () => LexicalNode;
  register: (editor: LexicalEditor) => () => void;
  serializeNode: (node: IfNodeModel, ctx: FreemarkerSerializeContext) => string;
}

export declare function createIfNodeFactory(
  options?: CreateIfNodeFactoryOptions,
): IfNodeFactory;
```

### 11.4 Plugin-level registration
```ts
export interface FreemarkerNodeFactory {
  nodeType: string;
  register: (editor: LexicalEditor) => () => void;
}

export interface RegisterFreemarkerPluginOptions {
  factories: FreemarkerNodeFactory[];
  onDiagnostics?: (diagnostics: FreemarkerDiagnostic[]) => void;
}

export declare function registerFreemarkerPlugin(
  editor: LexicalEditor,
  options: RegisterFreemarkerPluginOptions,
): () => void;
```

## 12) Demo/Tester Web App Requirement (GitHub Pages)

Ship a demo tester app in-repo for trying nodes live and inspecting generated Freemarker output.

### Requirements
- Build a small React app (Vite preferred) under `apps/tester`.
- Deploy to GitHub Pages automatically on push to `main`.
- Tester must include:
  1. Lexical editor instance with Freemarker nodes enabled
  2. Controls to insert/edit at least the Conditional node
  3. Live output panel showing serialized Freemarker text
  4. Diagnostics panel for parser/plugin messages
  5. Basic style switcher or class-map playground to test Tailwind classes

### CI/CD requirements
- Add GitHub Action workflow to build and publish Pages artifact.
- Keep library build + tester build in same CI pipeline (fail fast on either).
- Document tester URL in README once available.

## 13) Testing Requirements (Node-by-Node, Edge-Case Heavy)

### 13.1 Testing philosophy
- Every node factory must ship with **extensive unit tests** plus integration tests in a Lexical editor harness.
- Avoid regex-only parsing assumptions where delimiters can appear in valid expressions.
- Prefer token/state-machine parsing logic for directive boundaries.

### 13.2 Minimum test layers
1. **Tokenizer/Parser unit tests** (pure functions)
2. **Node model tests** (settings + serialization)
3. **Lexical integration tests** (register/unregister, editor updates, command behavior)
4. **Round-trip tests** where applicable (node model -> Freemarker output -> parser expectations)

### 13.3 Conditional node test matrix (mandatory)
The Conditional node must include explicit tests for:

- basic forms
  - simple `ifExpression`
  - `if + else`
  - nested conditional content
- operator handling in expression
  - `a > b`
  - `a >= b`
  - `a < b`
  - `a <= b`
  - logical combinations with `&&` / `||`
- quoting/escaping
  - double quotes inside expression
  - single quotes inside expression
  - escaped quote sequences
- complex bodies
  - body content containing `>` characters
  - body containing Freemarker interpolation `${x > y}`
  - body containing HTML-like text
- malformed input handling
  - missing closing tags
  - empty expression
  - stray `<#else>` without opener

### 13.4 Regression requirement for delimiter bug class
Add dedicated regression tests proving conditional parsing/serialization does **not** break when `>` appears inside expression logic.

Example case (must pass):

```ftl
<#if user.age > 18>
  Adult
<#else>
  Minor
</#if>
```

Expected behavior:
- expression captured as `user.age > 18`
- delimiter handling remains correct
- no truncation at first `>` inside expression

### 13.5 Serializer invariants (all nodes)
- Output must be deterministic for same input model.
- Whitespace/newline strategy should be snapshot-tested.
- Serializer override hooks must be test-covered.

### 13.6 CI quality gates
- PR blocked unless test suite passes.
- Coverage thresholds (initial target):
  - parser/tokenizer: >= 90%
  - node serializers: >= 90%
  - integration layer: >= 80%

### 13.7 Local git hooks (required)
Implement repository hooks so broken code is difficult to commit/push:

- Use Husky + lint-staged (or equivalent) with npm scripts.
- `pre-commit` must run at minimum:
  - typecheck (or staged type-safe validation)
  - relevant test subset for changed files (fast path)
- `pre-push` must run:
  - full test suite
  - build
- If hook checks fail, commit/push is blocked.

Recommended scripts:
- `npm run test`
- `npm run test:changed` (fast path)
- `npm run typecheck`
- `npm run build`

Note: "impossible to ship bugs" is aspirational; hooks + CI should make regressions significantly harder to land.

## 14) Suggested Immediate Next Step
Freeze this draft into a v1 requirements baseline, then hand to Codex for implementation planning + task breakdown.
