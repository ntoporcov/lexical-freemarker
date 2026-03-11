export type FreemarkerTokenKind = 'directive' | 'interpolation' | 'comment' | 'text';

export interface FreemarkerToken {
  kind: FreemarkerTokenKind;
  value: string;
  start: number;
  end: number;
}

export interface FreemarkerPluginOptions {
  /**
   * Called whenever template text is parsed into tokens.
   */
  onTokens?: (tokens: FreemarkerToken[]) => void;
}
