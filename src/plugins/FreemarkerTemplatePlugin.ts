import type { FreemarkerPluginOptions, FreemarkerToken } from '../types.js';

const tokenRegex = /(<#--[\s\S]*?-->)|(\$\{[^}]+\})|(<#\/?[^>]+>)/g;

/**
 * Small utility plugin starter for Freemarker-aware text parsing.
 *
 * This does not mutate editor state yet; it gives you a typed place to start
 * building Lexical node transforms/commands around Freemarker syntax.
 */
export class FreemarkerTemplatePlugin {
  constructor(private readonly options: FreemarkerPluginOptions = {}) {}

  parse(template: string): FreemarkerToken[] {
    const tokens: FreemarkerToken[] = [];
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(template)) !== null) {
      const value = match[0];
      const start = match.index;
      const end = start + value.length;

      const kind = value.startsWith('<#--')
        ? 'comment'
        : value.startsWith('${')
          ? 'interpolation'
          : 'directive';

      tokens.push({ kind, value, start, end });
    }

    this.options.onTokens?.(tokens);
    return tokens;
  }
}
