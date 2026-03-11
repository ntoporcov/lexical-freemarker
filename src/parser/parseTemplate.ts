import type {
  ConditionalDirectiveToken,
  FreemarkerDiagnostic,
  FreemarkerDirectiveKind,
  FreemarkerToken,
  ParseResult,
} from '../types.js';
import {
  findDirectiveEnd,
  isBlockDirective,
  isBranchDirective,
  parseDirectiveHead,
} from './directiveGrammar.js';

interface ScanResult {
  token: FreemarkerToken;
  nextIndex: number;
  diagnostics: FreemarkerDiagnostic[];
}

const DIRECTIVE_OPEN_PREFIX = '<#';
const DIRECTIVE_CLOSE_PREFIX = '</#';
const COMMENT_PREFIX = '<#--';
const INTERPOLATION_PREFIX = '${';

export function parseTemplate(input: string): ParseResult {
  const tokens: FreemarkerToken[] = [];
  const diagnostics: FreemarkerDiagnostic[] = [];
  const directiveStack: Array<{ name: string; start: number }> = [];

  let index = 0;

  while (index < input.length) {
    const nextMarker = findNextMarker(input, index);

    if (nextMarker === -1) {
      pushTextToken(tokens, input, index, input.length);
      break;
    }

    pushTextToken(tokens, input, index, nextMarker);

    const scanResult = scanSpecialToken(input, nextMarker);
    tokens.push(scanResult.token);
    diagnostics.push(...scanResult.diagnostics);
    updateDirectiveDiagnostics(scanResult.token, directiveStack, diagnostics);
    index = scanResult.nextIndex;
  }

  for (const unclosedDirective of directiveStack) {
    diagnostics.push({
      code: `unclosed-${unclosedDirective.name}-directive`,
      message: `Missing </#${unclosedDirective.name}> closing directive.`,
      severity: 'error',
      start: unclosedDirective.start,
      end: input.length,
    });
  }

  return { tokens, diagnostics };
}

export function getDirectiveKind(tokenValue: string): FreemarkerDirectiveKind {
  const match = tokenValue.match(/^<\/?#([a-zA-Z][\w-]*)/);
  return (match?.[1] ?? 'unknown') as FreemarkerDirectiveKind;
}

export function getIfExpression(tokenValue: string): string {
  const parsed = parseDirectiveHead(tokenValue);
  return parsed.head?.expression ?? tokenValue.replace(/^<#if\s*/, '').replace(/>$/, '').trim();
}

export function findIfDirectiveEnd(input: string, start: number): number {
  return findDirectiveEnd(input, start);
}

function findNextMarker(input: string, fromIndex: number): number {
  const candidates = [
    input.indexOf(COMMENT_PREFIX, fromIndex),
    input.indexOf(INTERPOLATION_PREFIX, fromIndex),
    input.indexOf(DIRECTIVE_OPEN_PREFIX, fromIndex),
    input.indexOf(DIRECTIVE_CLOSE_PREFIX, fromIndex),
  ].filter((value) => value >= 0);

  if (candidates.length === 0) {
    return -1;
  }

  return Math.min(...candidates);
}

function pushTextToken(tokens: FreemarkerToken[], input: string, start: number, end: number): void {
  if (end <= start) {
    return;
  }

  tokens.push({
    kind: 'text',
    value: input.slice(start, end),
    start,
    end,
  });
}

function scanSpecialToken(input: string, start: number): ScanResult {
  if (input.startsWith(COMMENT_PREFIX, start)) {
    return scanComment(input, start);
  }

  if (input.startsWith(INTERPOLATION_PREFIX, start)) {
    return scanInterpolation(input, start);
  }

  return scanDirective(input, start);
}

function scanComment(input: string, start: number): ScanResult {
  const endIndex = input.indexOf('-->', start + COMMENT_PREFIX.length);

  if (endIndex === -1) {
    return {
      token: {
        kind: 'comment',
        value: input.slice(start),
        start,
        end: input.length,
      },
      nextIndex: input.length,
      diagnostics: [
        {
          code: 'unclosed-comment',
          message: 'Comment directive was not closed.',
          severity: 'error',
          start,
          end: input.length,
        },
      ],
    };
  }

  const end = endIndex + 3;
  return {
    token: {
      kind: 'comment',
      value: input.slice(start, end),
      start,
      end,
    },
    nextIndex: end,
    diagnostics: [],
  };
}

function scanInterpolation(input: string, start: number): ScanResult {
  let index = start + INTERPOLATION_PREFIX.length;
  let depth = 1;
  let quote: string | null = null;

  while (index < input.length) {
    const char = input[index];
    const previous = input[index - 1];

    if (quote !== null) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === '{') {
      depth += 1;
      index += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      index += 1;
      if (depth === 0) {
        return {
          token: {
            kind: 'interpolation',
            value: input.slice(start, index),
            start,
            end: index,
          },
          nextIndex: index,
          diagnostics: [],
        };
      }
      continue;
    }

    index += 1;
  }

  return {
    token: {
      kind: 'interpolation',
      value: input.slice(start),
      start,
      end: input.length,
    },
    nextIndex: input.length,
    diagnostics: [
      {
        code: 'unclosed-interpolation',
        message: 'Interpolation was not closed.',
        severity: 'error',
        start,
        end: input.length,
      },
    ],
  };
}

function scanDirective(input: string, start: number): ScanResult {
  const end = findDirectiveEnd(input, start);

  if (end === -1) {
    return {
      token: {
        kind: 'directive',
        value: input.slice(start),
        start,
        end: input.length,
      },
      nextIndex: input.length,
      diagnostics: [
        {
          code: 'unclosed-directive',
          message: 'Directive was not closed.',
          severity: 'error',
          start,
          end: input.length,
        },
      ],
    };
  }

  const value = input.slice(start, end);
  const parsed = parseDirectiveHead(value);
  const diagnostics = parsed.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    start,
    end,
  }));
  const token: ConditionalDirectiveToken = {
    kind: 'directive',
    value,
    start,
    end,
    directiveKind: parsed.head?.kind ?? getDirectiveKind(value),
    expression: parsed.head?.expression,
  };

  return {
    token,
    nextIndex: end,
    diagnostics,
  };
}

function updateDirectiveDiagnostics(
  token: FreemarkerToken,
  directiveStack: Array<{ name: string; start: number }>,
  diagnostics: FreemarkerDiagnostic[],
): void {
  if (token.kind !== 'directive') {
    return;
  }

  const parsed = parseDirectiveHead(token.value);
  const head = parsed.head;
  if (!head) {
    return;
  }

  if (isBlockDirective(head)) {
    directiveStack.push({ name: head.name, start: token.start });
    return;
  }

  if (isBranchDirective(head)) {
    if (directiveStack.length === 0) {
      diagnostics.push({
        code: `stray-${head.name}-directive`,
        message: `Encountered <#${head.name}> without a matching opener.`,
        severity: 'error',
        start: token.start,
        end: token.end,
      });
    }
    return;
  }

  if (head.isClosing) {
    if (directiveStack.length === 0) {
      diagnostics.push({
        code: `stray-${head.name}-close-directive`,
        message: `Encountered </#${head.name}> without a matching opener.`,
        severity: 'error',
        start: token.start,
        end: token.end,
      });
      return;
    }

    const current = directiveStack.at(-1);
    if (current?.name !== head.name) {
      diagnostics.push({
        code: 'mismatched-directive-close',
        message: `Encountered </#${head.name}> while <#${current?.name}> is still open.`,
        severity: 'error',
        start: token.start,
        end: token.end,
      });
      return;
    }

    directiveStack.pop();
  }
}
