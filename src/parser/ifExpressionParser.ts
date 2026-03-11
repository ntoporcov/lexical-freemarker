const IDENTIFIER_PATTERN = /[A-Za-z_]/;
const IDENTIFIER_PART_PATTERN = /[A-Za-z0-9_\-$]/;
const DIGIT_PATTERN = /[0-9]/;

export function validateIfExpression(input: string): boolean {
  const parser = new ExpressionParser(input);
  return parser.parse();
}

class ExpressionParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse(): boolean {
    this.skipWhitespace();
    if (this.index >= this.input.length) {
      return false;
    }

    if (!this.parseExpression(0)) {
      return false;
    }

    this.skipWhitespace();
    return this.index === this.input.length;
  }

  private parseExpression(minPrecedence: number): boolean {
    if (!this.parsePrefix()) {
      return false;
    }

    while (true) {
      this.skipWhitespace();
      const operator = this.peekBinaryOperator();
      if (!operator) {
        break;
      }

      const precedence = getPrecedence(operator);
      if (precedence < minPrecedence) {
        break;
      }

      this.index += operator.length;
      this.skipWhitespace();
      if (!this.parseExpression(precedence + 1)) {
        return false;
      }
    }

    return true;
  }

  private parsePrefix(): boolean {
    this.skipWhitespace();
    const unaryOperator = this.peekUnaryOperator();
    if (unaryOperator) {
      this.index += unaryOperator.length;
      return this.parsePrefix();
    }

    if (!this.parsePrimary()) {
      return false;
    }

    while (true) {
      this.skipWhitespace();
      const char = this.input[this.index];

      if (char == '.') {
        this.index += 1;
        if (!this.readIdentifier()) {
          return false;
        }
        continue;
      }

      if (char == '[') {
        this.index += 1;
        if (!this.parseExpression(0)) {
          return false;
        }
        this.skipWhitespace();
        if (this.input[this.index] !== ']') {
          return false;
        }
        this.index += 1;
        continue;
      }

      if (char == '(') {
        this.index += 1;
        this.skipWhitespace();
        if (this.input[this.index] !== ')') {
          while (true) {
            if (!this.parseExpression(0)) {
              return false;
            }
            this.skipWhitespace();
            if (this.input[this.index] === ',') {
              this.index += 1;
              this.skipWhitespace();
              continue;
            }
            break;
          }
        }

        if (this.input[this.index] !== ')') {
          return false;
        }
        this.index += 1;
        continue;
      }

      if (char == '?') {
        this.index += 1;
        if (!this.readIdentifier()) {
          return false;
        }
        continue;
      }

      break;
    }

    return true;
  }

  private parsePrimary(): boolean {
    this.skipWhitespace();
    const char = this.input[this.index];

    if (char === '(') {
      this.index += 1;
      if (!this.parseExpression(0)) {
        return false;
      }
      this.skipWhitespace();
      if (this.input[this.index] !== ')') {
        return false;
      }
      this.index += 1;
      return true;
    }

    if (char === '"' || char === "'") {
      return this.readString(char);
    }

    if (char && DIGIT_PATTERN.test(char)) {
      return this.readNumber();
    }

    return this.readIdentifier();
  }

  private readIdentifier(): boolean {
    const start = this.index;
    const first = this.input[this.index];
    if (!first || !IDENTIFIER_PATTERN.test(first)) {
      return false;
    }

    this.index += 1;
    while (this.index < this.input.length && IDENTIFIER_PART_PATTERN.test(this.input[this.index])) {
      this.index += 1;
    }

    return this.index > start;
  }

  private readNumber(): boolean {
    const start = this.index;
    while (this.index < this.input.length && DIGIT_PATTERN.test(this.input[this.index])) {
      this.index += 1;
    }

    if (this.input[this.index] === '.') {
      this.index += 1;
      while (this.index < this.input.length && DIGIT_PATTERN.test(this.input[this.index])) {
        this.index += 1;
      }
    }

    return this.index > start;
  }

  private readString(quote: string): boolean {
    this.index += 1;
    while (this.index < this.input.length) {
      const char = this.input[this.index];
      const previous = this.input[this.index - 1];
      if (char === quote && previous !== '\\') {
        this.index += 1;
        return true;
      }
      this.index += 1;
    }

    return false;
  }

  private peekUnaryOperator(): string | null {
    for (const operator of ['!', '-']) {
      if (this.input.startsWith(operator, this.index)) {
        return operator;
      }
    }

    return null;
  }

  private peekBinaryOperator(): string | null {
    for (const operator of ['||', '&&', '==', '!=', '>=', '<=', '>', '<', '+', '-', '*', '/', '%']) {
      if (this.input.startsWith(operator, this.index)) {
        return operator;
      }
    }

    return null;
  }

  private skipWhitespace(): void {
    while (this.index < this.input.length && /\s/.test(this.input[this.index])) {
      this.index += 1;
    }
  }
}

function getPrecedence(operator: string): number {
  switch (operator) {
    case '||':
      return 1;
    case '&&':
      return 2;
    case '==':
    case '!=':
      return 3;
    case '>':
    case '<':
    case '>=':
    case '<=':
      return 4;
    case '+':
    case '-':
      return 5;
    case '*':
    case '/':
    case '%':
      return 6;
    default:
      return 0;
  }
}
