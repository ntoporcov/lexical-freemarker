import type {
  DirectiveParseResult,
  FreemarkerDiagnostic,
  FreemarkerDirectiveAssignment,
  FreemarkerDirectiveHead,
} from '../types.js';
import { validateIfExpression } from './ifExpressionParser.js';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_\-$]*$/;
const BLOCK_DIRECTIVE_NAMES = new Set(['if', 'list', 'macro', 'attempt', 'switch']);
const BRANCH_DIRECTIVE_NAMES = new Set(['else', 'elseif', 'recover', 'case', 'default']);

export function findDirectiveEnd(input: string, start: number): number {
  let index = start + 2;
  let quote: string | null = null;
  const candidates: number[] = [];

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

    if (char === '>') {
      candidates.push(index + 1);
    }

    if (char === '\n' || char === '\r') {
      break;
    }

    if (candidates.length > 0 && (input.startsWith('</#', index) || input.startsWith('<#else>', index))) {
      break;
    }

    index += 1;
  }

  const validCandidates = candidates.filter((candidate) => {
    const directiveText = input.slice(start, candidate);
    return parseDirectiveHead(directiveText).valid;
  });

  if (validCandidates.length > 0) {
    const structuralCandidate = validCandidates.find((candidate) => {
      const nextChar = input[candidate] ?? '';
      return nextChar === '' || nextChar === '\n' || nextChar === '\r' || nextChar === '<';
    });

    return structuralCandidate ?? validCandidates.at(-1) ?? -1;
  }

  return candidates.at(-1) ?? -1;
}

export function parseDirectiveHead(directiveText: string): DirectiveParseResult {
  if (!directiveText.startsWith('<#') && !directiveText.startsWith('</#')) {
    return invalidDirective('Directive must start with <# or </#>.');
  }

  if (!directiveText.endsWith('>')) {
    return invalidDirective('Directive must end with >.');
  }

  const isClosing = directiveText.startsWith('</#');
  const prefixLength = isClosing ? 3 : 2;
  const inner = directiveText.slice(prefixLength, -1).trim();
  if (inner.length === 0) {
    return invalidDirective('Directive name is required.');
  }

  const match = inner.match(/^([A-Za-z][\w-]*)(?:\s+([\s\S]*))?$/);
  if (!match) {
    return invalidDirective('Directive name is malformed.');
  }

  const name = match[1];
  const rawArguments = match[2]?.trim() ?? '';

  if (isClosing) {
    if (rawArguments.length > 0) {
      return invalidDirective('Closing directives cannot contain arguments.');
    }

    return {
      valid: true,
      diagnostics: [],
      head: {
        kind: name,
        name,
        isClosing: true,
        rawArguments: '',
      },
    };
  }

  switch (name) {
    case 'if':
    case 'elseif':
    case 'switch':
    case 'case':
      return parseExpressionDirective(name, rawArguments);
    case 'list':
      return parseListDirective(rawArguments);
    case 'assign':
      return parseAssignDirective(rawArguments);
    case 'macro':
      return parseMacroDirective(rawArguments);
    case 'attempt':
    case 'else':
    case 'recover':
    case 'default':
    case 'break':
    case 'continue':
      if (rawArguments.length > 0) {
        return invalidDirective(`${name} does not accept arguments.`);
      }
      return {
        valid: true,
        diagnostics: [],
        head: {
          kind: name,
          name,
          isClosing: false,
          rawArguments,
        },
      };
    default:
      return parseGenericDirective(name, rawArguments);
  }
}

export function isBlockDirective(head: FreemarkerDirectiveHead): boolean {
  return !head.isClosing && BLOCK_DIRECTIVE_NAMES.has(head.name);
}

export function isBranchDirective(head: FreemarkerDirectiveHead): boolean {
  return !head.isClosing && BRANCH_DIRECTIVE_NAMES.has(head.name);
}

function parseExpressionDirective(name: string, rawArguments: string): DirectiveParseResult {
  if (rawArguments.length === 0 || !validateIfExpression(rawArguments)) {
    return invalidDirective(`${name} requires a valid expression.`);
  }

  return {
    valid: true,
    diagnostics: [],
    head: {
      kind: name,
      name,
      isClosing: false,
      rawArguments,
      expression: rawArguments,
    },
  };
}

function parseListDirective(rawArguments: string): DirectiveParseResult {
  const asIndex = findTopLevelKeyword(rawArguments, 'as');
  if (asIndex === -1) {
    if (!validateIfExpression(rawArguments)) {
      return invalidDirective('list requires an iterable expression, optionally followed by `as item`.');
    }

    return {
      valid: true,
      diagnostics: [],
      head: {
        kind: 'list',
        name: 'list',
        isClosing: false,
        rawArguments,
        expression: rawArguments,
      },
    };
  }

  const expression = rawArguments.slice(0, asIndex).trim();
  const loopVariable = rawArguments.slice(asIndex + 2).trim();
  if (!validateIfExpression(expression) || !IDENTIFIER_PATTERN.test(loopVariable)) {
    return invalidDirective('list requires a valid expression and loop variable.');
  }

  return {
    valid: true,
    diagnostics: [],
    head: {
      kind: 'list',
      name: 'list',
      isClosing: false,
      rawArguments,
      expression,
      loopVariable,
    },
  };
}

function parseAssignDirective(rawArguments: string): DirectiveParseResult {
  const parts = splitTopLevel(rawArguments, ',');
  if (parts.length === 0) {
    return invalidDirective('assign requires at least one assignment target.');
  }

  const assignments: FreemarkerDirectiveAssignment[] = [];
  for (const part of parts) {
    const equalsIndex = findTopLevelCharacter(part, '=');
    if (equalsIndex === -1) {
      if (!IDENTIFIER_PATTERN.test(part.trim())) {
        return invalidDirective('assign targets must be identifiers.');
      }
      assignments.push({ name: part.trim() });
      continue;
    }

    const name = part.slice(0, equalsIndex).trim();
    const expression = part.slice(equalsIndex + 1).trim();
    if (!IDENTIFIER_PATTERN.test(name) || !validateIfExpression(expression)) {
      return invalidDirective('assign requires identifier = expression pairs.');
    }
    assignments.push({ name, expression });
  }

  return {
    valid: true,
    diagnostics: [],
    head: {
      kind: 'assign',
      name: 'assign',
      isClosing: false,
      rawArguments,
      assignments,
    },
  };
}

function parseMacroDirective(rawArguments: string): DirectiveParseResult {
  const segments = splitWhitespaceTopLevel(rawArguments);
  if (segments.length === 0 || !IDENTIFIER_PATTERN.test(segments[0])) {
    return invalidDirective('macro requires a macro name.');
  }

  const params = segments.slice(1);
  const validParams = params.every((segment) => {
    const equalsIndex = findTopLevelCharacter(segment, '=');
    if (equalsIndex === -1) {
      return IDENTIFIER_PATTERN.test(segment);
    }

    const name = segment.slice(0, equalsIndex).trim();
    const expression = segment.slice(equalsIndex + 1).trim();
    return IDENTIFIER_PATTERN.test(name) && validateIfExpression(expression);
  });

  if (!validParams) {
    return invalidDirective('macro parameters must be identifiers or identifier=expression pairs.');
  }

  return {
    valid: true,
    diagnostics: [],
    head: {
      kind: 'macro',
      name: 'macro',
      isClosing: false,
      rawArguments,
      macroName: segments[0],
      params,
    },
  };
}

function parseGenericDirective(name: string, rawArguments: string): DirectiveParseResult {
  if (!isBalanced(rawArguments)) {
    return invalidDirective(`${name} contains unbalanced arguments.`);
  }

  return {
    valid: true,
    diagnostics: [],
    head: {
      kind: name,
      name,
      isClosing: false,
      rawArguments,
    },
  };
}

function splitTopLevel(input: string, separator: ',' | ' '): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const previous = input[index - 1];
    if (quote !== null) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '(' || char === '[') {
      depth += 1;
      continue;
    }

    if (char === ')' || char === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0 && char === separator) {
      const part = input.slice(start, index).trim();
      if (part.length > 0) {
        parts.push(part);
      }
      start = index + 1;
    }
  }

  const tail = input.slice(start).trim();
  if (tail.length > 0) {
    parts.push(tail);
  }

  return parts;
}

function splitWhitespaceTopLevel(input: string): string[] {
  const parts: string[] = [];
  let start = -1;
  let quote: string | null = null;
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const previous = input[index - 1];
    if (quote !== null) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      if (start === -1) {
        start = index;
      }
      quote = char;
      continue;
    }

    if (char === '(' || char === '[') {
      if (start === -1) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === ')' || char === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0 && /\s/.test(char)) {
      if (start !== -1) {
        parts.push(input.slice(start, index));
        start = -1;
      }
      continue;
    }

    if (start === -1) {
      start = index;
    }
  }

  if (start !== -1) {
    parts.push(input.slice(start));
  }

  return parts.map((part) => part.trim()).filter(Boolean);
}

function findTopLevelKeyword(input: string, keyword: 'as'): number {
  let quote: string | null = null;
  let depth = 0;

  for (let index = 0; index <= input.length - keyword.length; index += 1) {
    const char = input[index];
    const previous = input[index - 1];
    if (quote !== null) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '(' || char === '[') {
      depth += 1;
      continue;
    }

    if (char === ')' || char === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0 && input.slice(index, index + keyword.length) == keyword) {
      const before = input[index - 1] ?? ' ';
      const after = input[index + keyword.length] ?? ' ';
      if (/\s/.test(before) && /\s/.test(after)) {
        return index;
      }
    }
  }

  return -1;
}

function findTopLevelCharacter(input: string, target: '='): number {
  let quote: string | null = null;
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const previous = input[index - 1];
    if (quote !== null) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '(' || char === '[') {
      depth += 1;
      continue;
    }

    if (char === ')' || char === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0 && char === target) {
      return index;
    }
  }

  return -1;
}

function isBalanced(input: string): boolean {
  let quote: string | null = null;
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const previous = input[index - 1];
    if (quote !== null) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '(' || char === '[') {
      depth += 1;
      continue;
    }

    if (char === ')' || char === ']') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }

  return quote === null && depth === 0;
}

function invalidDirective(message: string): DirectiveParseResult {
  const diagnostic: FreemarkerDiagnostic = {
    code: 'malformed-directive-shape',
    message,
    severity: 'error',
    start: 0,
    end: 0,
  };

  return {
    valid: false,
    diagnostics: [diagnostic],
  };
}
