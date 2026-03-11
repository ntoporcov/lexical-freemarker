import { parseTemplate } from '../parser/parseTemplate.js';
import type { FreemarkerPluginOptions, FreemarkerToken, ParseResult } from '../types.js';

/**
 * Small utility plugin starter for Freemarker-aware text parsing.
 *
 * This does not mutate editor state; it exposes deterministic tokenization and
 * diagnostics so host apps can wire editor-side behaviors around them.
 */
export class FreemarkerTemplatePlugin {
  constructor(private readonly options: FreemarkerPluginOptions = {}) {}

  parse(template: string): FreemarkerToken[] {
    return this.parseResult(template).tokens;
  }

  parseResult(template: string): ParseResult {
    const result = parseTemplate(template);
    this.options.onTokens?.(result.tokens);
    this.options.onParse?.(result);
    return result;
  }
}
