import type {
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  SerializedLexicalNode,
} from 'lexical';

export type FreemarkerTokenKind = 'directive' | 'interpolation' | 'comment' | 'text';

export interface FreemarkerToken {
  kind: FreemarkerTokenKind;
  value: string;
  start: number;
  end: number;
}

export interface FreemarkerDiagnostic {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  start: number;
  end: number;
}

export interface ParseResult {
  tokens: FreemarkerToken[];
  diagnostics: FreemarkerDiagnostic[];
}

export type FreemarkerDirectiveKind =
  | 'if'
  | 'elseif'
  | 'else'
  | 'list'
  | 'assign'
  | 'macro'
  | 'attempt'
  | 'recover'
  | 'switch'
  | 'case'
  | 'default'
  | (string & {});

export interface FreemarkerDirectiveAssignment {
  name: string;
  expression?: string;
}

export interface FreemarkerDirectiveHead {
  kind: FreemarkerDirectiveKind;
  name: string;
  isClosing: boolean;
  rawArguments: string;
  expression?: string;
  loopVariable?: string;
  assignments?: FreemarkerDirectiveAssignment[];
  macroName?: string;
  params?: string[];
}

export interface DirectiveParseResult {
  head?: FreemarkerDirectiveHead;
  diagnostics: FreemarkerDiagnostic[];
  valid: boolean;
}

export interface FreemarkerSerializeContext {
  newline: '\n' | '\r\n';
  indent: (depth: number) => string;
  escapeExpression?: (raw: string) => string;
  resolveNodeKey?: (nodeKey: string) => string;
}

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

/**
 * React-compatible function signature for host-provided settings UIs.
 *
 * The package keeps this intentionally framework-light for the MVP so host apps
 * can adapt it without requiring a runtime React dependency here.
 */
export type FreemarkerSettingsPanelComponent<TSettings> = (
  props: SettingsRenderProps<TSettings>,
) => unknown;

export interface SettingsRenderProps<TSettings> {
  value: TSettings;
  onChange: (next: TSettings) => void;
  classes: FreemarkerUiClassMap;
  diagnostics?: FreemarkerDiagnostic[];
}

export interface IfNodeSettings {
  ifExpression: string;
}

export interface IfNodeModel {
  kind: 'if';
  settings: IfNodeSettings;
  contentNodeKeys: string[];
  elseContentNodeKeys?: string[];
}

export interface ParsedIfBlock {
  kind: 'if';
  settings: IfNodeSettings;
  content: string;
  elseContent?: string;
}

export interface CreateIfNodeFactoryOptions {
  type?: string;
  ui?: FreemarkerUiOptions;
  renderSettingsPanel?: FreemarkerSettingsPanelComponent<IfNodeSettings>;
  toFreemarker?: (node: IfNodeModel, ctx: FreemarkerSerializeContext) => string;
}

export interface FreemarkerNodeFactory {
  nodeType: string;
  register: (editor: LexicalEditor) => () => void;
}

export interface IfNodeFactory extends FreemarkerNodeFactory {
  nodeClass: new (...args: any[]) => LexicalNode;
  createInitialNode: () => LexicalNode;
  serializeNode: (node: IfNodeModel, ctx: FreemarkerSerializeContext) => string;
  renderSettingsPanel: FreemarkerSettingsPanelComponent<IfNodeSettings>;
  getUiClasses: () => FreemarkerUiClassMap;
}

export interface RegisterFreemarkerPluginOptions {
  factories: FreemarkerNodeFactory[];
  onDiagnostics?: (diagnostics: FreemarkerDiagnostic[]) => void;
}

export interface FreemarkerPluginOptions {
  /**
   * Called whenever template text is parsed into tokens.
   */
  onTokens?: (tokens: FreemarkerToken[]) => void;
  /**
   * Called with the full parser result for each parse.
   */
  onParse?: (result: ParseResult) => void;
}

export type SerializedIfNode = SerializedElementNode<SerializedLexicalNode> & {
  type: string;
  version: 1;
  ifExpression: string;
};

export interface ConditionalDirectiveToken extends FreemarkerToken {
  kind: 'directive';
  directiveKind: FreemarkerDirectiveKind;
  expression?: string;
}

export interface NodeKeyResolver {
  (nodeKey: NodeKey): string;
}
