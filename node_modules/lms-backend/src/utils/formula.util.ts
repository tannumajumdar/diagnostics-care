/**
 * Calculated parameters - LDL from the lipid panel, MCV from the CBC, eGFR
 * from creatinine and the patient.
 *
 * A formula names other parameters of the same test between # signs, by short
 * name or full name, exactly as a Word report format does:
 *
 *   #TC# - #HDL# - (#TG# / 5)
 *
 * Numbers, + - * / ^, brackets and min(), max(), abs(), sqrt(), ln(), log(),
 * exp() and round(x, places) are understood. #AGE# (years), #MALE# and
 * #FEMALE# (1 or 0) describe the patient. Nothing is ever passed to eval.
 *
 * Mirrors frontend/src/utils/formula.ts - keep the two in step.
 */

/** "#Total Chol#" and "#TOTALCHOL#" are the same name. */
export const formulaKey = (name: unknown) => String(name ?? '').trim().replace(/\s+/g, '').toUpperCase();

export const PATIENT_TAGS = ['AGE', 'MALE', 'FEMALE'];

type Token =
  | { t: 'num'; v: number }
  | { t: 'tag'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const FUNCS: Record<string, (...a: number[]) => number> = {
  MIN: (...a) => Math.min(...a),
  MAX: (...a) => Math.max(...a),
  ABS: (a) => Math.abs(a),
  SQRT: (a) => Math.sqrt(a),
  LN: (a) => Math.log(a),
  LOG: (a) => Math.log10(a),
  EXP: (a) => Math.exp(a),
  ROUND: (a, places = 0) => {
    const f = 10 ** Math.max(0, Math.min(6, Math.trunc(places)));
    return Math.round(a * f) / f;
  },
};

class FormulaError extends Error {}

const tokenize = (src: string): Token[] => {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (c === '#') {
      const end = src.indexOf('#', i + 1);
      if (end < 0) throw new FormulaError('A # has no closing # after it');
      const name = formulaKey(src.slice(i + 1, end));
      if (!name) throw new FormulaError('Empty ## in the formula');
      out.push({ t: 'tag', v: name });
      i = end + 1;
    } else if (/[\d.]/.test(c)) {
      const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
      if (!m) throw new FormulaError(`Bad number near "${src.slice(i, i + 6)}"`);
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-z]/i.test(c)) {
      const m = src.slice(i).match(/^[a-z]+/i)!;
      out.push({ t: 'id', v: m[0].toUpperCase() });
      i += m[0].length;
    } else if ('+-*/^(),'.includes(c)) {
      out.push({ t: 'op', v: c });
      i += 1;
    } else {
      throw new FormulaError(`"${c}" cannot be used in a formula`);
    }
  }
  return out;
};

type Node =
  | { k: 'num'; v: number }
  | { k: 'tag'; v: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

const parse = (tokens: Token[]): Node => {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`Expected "${v}"`);
    pos += 1;
  };

  const expr = (): Node => {
    let node = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as any).v;
      node = { k: 'bin', op, a: node, b: term() };
    }
    return node;
  };
  const term = (): Node => {
    let node = unary();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as any).v;
      node = { k: 'bin', op, a: node, b: unary() };
    }
    return node;
  };
  const unary = (): Node => {
    if (isOp('-')) {
      pos += 1;
      return { k: 'neg', a: unary() };
    }
    if (isOp('+')) {
      pos += 1;
      return unary();
    }
    return power();
  };
  // Right-associative, and binds tighter than a leading minus on its right.
  const power = (): Node => {
    const base = primary();
    if (isOp('^')) {
      pos += 1;
      return { k: 'bin', op: '^', a: base, b: unary() };
    }
    return base;
  };
  const primary = (): Node => {
    const tok = peek();
    if (!tok) throw new FormulaError('The formula ends too early');
    if (tok.t === 'num') {
      pos += 1;
      return { k: 'num', v: tok.v };
    }
    if (tok.t === 'tag') {
      pos += 1;
      return { k: 'tag', v: tok.v };
    }
    if (tok.t === 'id') {
      if (!FUNCS[tok.v]) {
        throw new FormulaError(`Unknown word "${tok.v.toLowerCase()}" - put parameter names between # signs`);
      }
      pos += 1;
      expect('(');
      const args: Node[] = [expr()];
      while (isOp(',')) {
        pos += 1;
        args.push(expr());
      }
      expect(')');
      return { k: 'call', fn: tok.v, args };
    }
    if (isOp('(')) {
      pos += 1;
      const inner = expr();
      expect(')');
      return inner;
    }
    throw new FormulaError(`Unexpected "${tok.v}"`);
  };

  const node = expr();
  if (pos < tokens.length) throw new FormulaError(`Unexpected "${(tokens[pos] as any).v}"`);
  return node;
};

const tagsOf = (node: Node, into: Set<string>) => {
  if (node.k === 'tag') into.add(node.v);
  else if (node.k === 'neg') tagsOf(node.a, into);
  else if (node.k === 'bin') {
    tagsOf(node.a, into);
    tagsOf(node.b, into);
  } else if (node.k === 'call') node.args.forEach((a) => tagsOf(a, into));
  return into;
};

const compile = (formula: string) => parse(tokenize(formula));

/**
 * Checks a formula as it is saved on the test master. Returns the problem in
 * words, or '' when it is fine. `known` are the names the test's parameters
 * answer to (short and full, through formulaKey).
 */
export const formulaProblem = (formula: string, known: Set<string>, self?: string): string => {
  if (!String(formula || '').trim()) return '';
  try {
    const tags = tagsOf(compile(formula), new Set());
    if (!tags.size) return 'The formula uses no parameter - put names between # signs, e.g. #HB#';
    for (const tag of tags) {
      if (self && tag === self) return 'A parameter cannot be calculated from itself';
      if (!known.has(tag) && !PATIENT_TAGS.includes(tag)) return `#${tag}# is not a parameter of this test`;
    }
    return '';
  } catch (err: any) {
    return err?.message || 'The formula cannot be read';
  }
};

/** A number off a result value - "12.5" is, "Positive" and "<0.1" are not. */
const numberOf = (value: unknown): number | undefined => {
  const s = String(value ?? '').trim();
  if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return undefined;
  return Number(s);
};

const run = (node: Node, scope: Map<string, number>): number | undefined => {
  switch (node.k) {
    case 'num':
      return node.v;
    case 'tag':
      return scope.get(node.v);
    case 'neg': {
      const a = run(node.a, scope);
      return a === undefined ? undefined : -a;
    }
    case 'bin': {
      const a = run(node.a, scope);
      const b = run(node.b, scope);
      if (a === undefined || b === undefined) return undefined;
      if (node.op === '+') return a + b;
      if (node.op === '-') return a - b;
      if (node.op === '*') return a * b;
      if (node.op === '/') return b === 0 ? undefined : a / b;
      return a ** b;
    }
    case 'call': {
      const args = node.args.map((a) => run(a, scope));
      if (args.some((a) => a === undefined)) return undefined;
      return FUNCS[node.fn](...(args as number[]));
    }
  }
};

/** Up to 2 decimals unless the formula rounds itself, with no trailing zeros. */
const format = (n: number) => String(Number(n.toFixed(Math.abs(n) >= 1000 ? 0 : 2)));

export interface FormulaRow {
  parameterName?: string;
  shortName?: string;
  value?: string;
  resultType?: string;
}

/**
 * Fills in every calculated row of a sheet. `formulaOf` gives a row's formula
 * ('' for a typed one) and `skip` the calculated rows the bench overrode by
 * hand. A formula can use another calculated value (Globulin, then A/G), so
 * rows are worked out until nothing more changes. A row whose inputs are not
 * all there yet comes back ''.
 *
 * Returns the new value of each calculated row, keyed by the row's index.
 */
export const calculateSheet = (
  rows: FormulaRow[],
  formulaOf: (row: FormulaRow) => string,
  patient: { age?: number | string; gender?: string } = {},
  skip: (row: FormulaRow, index: number) => boolean = () => false
): Map<number, string> => {
  const scope = new Map<string, number>();
  const age = numberOf(patient.age);
  if (age !== undefined) scope.set('AGE', age);
  const gender = String(patient.gender || '');
  if (gender) {
    scope.set('FEMALE', gender.startsWith('Female') ? 1 : 0);
    scope.set('MALE', gender.startsWith('Male') ? 1 : 0);
  }

  const put = (row: FormulaRow, n: number | undefined) => {
    for (const name of [row.shortName, row.parameterName]) {
      const key = formulaKey(name);
      if (!key) continue;
      if (n === undefined) scope.delete(key);
      else scope.set(key, n);
    }
  };

  const calculated: { index: number; row: FormulaRow; node: Node | null }[] = [];
  rows.forEach((row, index) => {
    if (row.resultType === 'Header') return;
    const formula = formulaOf(row);
    if (formula && !skip(row, index)) {
      let node: Node | null = null;
      try {
        node = compile(formula);
      } catch {
        node = null;
      }
      calculated.push({ index, row, node });
    } else {
      put(row, numberOf(row.value));
    }
  });

  const out = new Map<number, string>();
  calculated.forEach(({ index }) => out.set(index, ''));
  for (let pass = 0; pass <= calculated.length; pass += 1) {
    let changed = false;
    for (const { index, row, node } of calculated) {
      if (!node || out.get(index)) continue;
      const n = run(node, scope);
      if (n === undefined || !Number.isFinite(n)) continue;
      out.set(index, format(n));
      put(row, Number(format(n)));
      changed = true;
    }
    if (!changed) break;
  }
  return out;
};
