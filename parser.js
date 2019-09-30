const Tokenizer = require('./tokenizer');
const {
  PRINT,
  LET,
  REM,
  PAUSE,
  INPUT,
  FOR,
  NEXT,
  GOTO,
  END,
  IF,
  Variable
} = require('./nodes');
const exprToJS = require('./expr');

class Parser {
  static parseLine(line) {
    const t = new Tokenizer(line, { debug: true });
    t.tokenize();

    const lineno = getLineNo(t.next());

    const p = new Parser(t, lineno);

    return p.parse();
  }

  constructor(tokenizer, lineno) {
    this.tokenizer = tokenizer;
    this.lineno = lineno;
  }

  parse() {
    const top = this.tokenizer.next();
    assertType(top, 'keyword');

    switch (top.lexeme) {
      case 'PRINT':
        return new PRINT(this.lineno, this.expectExpr(), this.acceptLineMod());

      case 'LET': {
        const variable = this.expectVariable();
        this.expectOperation('=');
        return new LET(this.lineno, variable, this.expectExpr());
      }

      case 'REM':
        return new REM(this.lineno, this.expectComment());

      case 'PAUSE':
        return new PAUSE(this.lineno, this.expectExpr());

      case 'INPUT': {
        const expr = this.expectExpr();
        this.expectLineMod();
        return new INPUT(this.lineno, expr, this.expectVariable());
      }

      case 'FOR': {
        const variable = this.expectVariable();
        this.expectOperation('=');
        const frm = this.expectExpr();
        this.expectKeyword('TO');
        const to = this.expectExpr();
        const step = this.acceptKeyword('STEP') ? this.expectExpr() : null;

        return new FOR(this.lineno, variable, frm, to, step);
      }

      case 'NEXT':
        return new NEXT(this.lineno, this.expectVariable());

      case 'GOTO':
        return new GOTO(this.lineno, this.expectExpr());

      case 'END':
        return new END(this.lineno);

      case 'IF':
        const cond = this.expectExpr();
        this.expectKeyword('THEN');
        const then = this.parse();
        let other = null;
        if (this.acceptKeyword('else')) {
          other = this.parse();
        }

        return new IF(this.lineno, cond, then, other);
    }

    throw new Error(`Unexpected token ${top.lexeme}`);
  }

  acceptKeyword(keyword) {
    if (this.tokenizer.peek().type === 'keyword') {
      return this.tokenizer.next();
    }

    return null;
  }

  expectKeyword(keyword) {
    const t = this.acceptKeyword(keyword);
    if (t == null) {
      throw new Error(`Expected ${keyword} but got ${this.tokenizer.peek().lexeme}`);
    }

    return t.lexeme;
  }

  expectComment() {
    const t = this.tokenizer.next();

    if (t.type === 'comment') {
      assertType(this.tokenizer.next(), 'eof');
      return t.lexeme;
    }

    assertType(t, 'eof');
    return '';
  }

  expectOperation(op) {
    const t = this.tokenizer.next();
    assertType(t, 'operation');
    if (t.lexeme !== op) {
      throw new Error('Expected operation ' + op)
    }
    return t.lexeme;
  }

  expectVariable() {
    const t = this.tokenizer.next();
    assertType(t, 'variable');
    return new Variable(this.lineno, t.lexeme, this.acceptSubscript());
  }

  expectExpr() {
    const expr = [];
    const brackets = 0;
    while (this.tokenizer.peek() != Tokenizer.eof) {
      if (!Tokenizer.expressionTypes.includes(this.tokenizer.peek().type)) {
        break;
      }

      const t = this.tokenizer.peek();

      // We might be in a subscript or function call and if we see an
      // extra paren it's not ours to eat.
      if (brackets === 0 && (t.lexeme === ']' || t.lexeme === ')')) {
        break;
      }

      this.tokenizer.next();

      if (t.lexeme === '[' || t.lexeme === '(') {
        brackets++;
      }

      if (t.lexeme === ']' || t.lexeme === ']') {
        brackets--;
      }

      expr.push(t);
    }

    if (expr.length === 0) {
      throw new Error('Expected expression');
    }

    return exprToJS(expr);
  }

  expectLineMod() {
    if (!this.acceptLineMod()) {
      throw new Error('Expected ;');
    }

    return true;
  }

  acceptLineMod() {
    if (this.tokenizer.peek().type === 'linemod') {
      this.tokenizer.next();
      return true;
    }

    return false;
  }

  acceptSubscript() {
    if (this.tokenizer.peek().lexeme !== '[') return null;

    assertType(this.tokenizer.next(), 'operation', '[');

    const expr = this.expectExpr();

    assertType(this.tokenizer.next(), 'operation', ']');

    return expr;
  }
}

function assertType(token, expected, value = null) {
  if (token.type !== expected) {
    throw new Error(`Expect token of type ${expected} but got ${token.type}`);
  }

  if (value != null && token.lexeme !== value) {
    throw new Error(`Expected token value to be ${value} but got ${token.lexeme}`);
  }
}

function getLineNo(token) {
  assertType(token, 'lineno');

  if (typeof token.lexeme !== 'number') {
    throw new Error('lineno should be a number');
  }

  return token.lexeme;
}

module.exports = Parser;