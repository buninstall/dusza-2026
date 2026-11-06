export type InsertableBlock = { readonly lines: readonly string[] };

export const FIELD = /‹([^›]+)›/g;

export function hasFields(block: InsertableBlock): boolean {
  return block.lines.some((line) => line.includes("‹"));
}

export const INDENT_WIDTH = 4;

const HEADERS = new Set(["if", "while", "else"]);

type SnippetPlan = { from: number; to: number; template: string };

export type Insertion = {
  from: number;
  to: number;
  text: string;
  firstLine: number;
  lastLine: number;
  cursor: number;
  snippet: SnippetPlan | null;
};

type LineInfo = { number: number; from: number; to: number; text: string };

export function indentOf(text: string): number {
  return /^ */.exec(text)?.[0].length ?? 0;
}

export function isHeader(text: string): boolean {
  return HEADERS.has(text.trim().split(" ")[0] ?? "");
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

function linesOf(doc: string): LineInfo[] {
  let offset = 0;
  return doc.split("\n").map((text, index) => {
    const line = { number: index + 1, from: offset, to: offset + text.length, text };
    offset += text.length + 1;
    return line;
  });
}

function lineAt(lines: readonly LineInfo[], cursor: number): LineInfo {
  return (
    lines.find((line) => cursor <= line.to) ??
    lines[lines.length - 1] ?? {
      number: 1,
      from: 0,
      to: 0,
      text: "",
    }
  );
}

function blankBase(lines: readonly LineInfo[], line: LineInfo): number {
  const previous = lines
    .slice(0, line.number - 1)
    .reverse()
    .find((candidate) => !isBlank(candidate.text));
  if (!previous) {
    return 0;
  }
  return indentOf(previous.text) + (isHeader(previous.text) ? INDENT_WIDTH : 0);
}

function indented(block: InsertableBlock, base: number): string[] {
  return block.lines.map((line) => `${" ".repeat(base)}${line.replace(FIELD, "$1")}`);
}

function templateLines(
  block: InsertableBlock,
  base: number,
  autoIndent: number,
  isFirstIndented: boolean,
): string[] | null {
  let field = 0;
  const lines: string[] = [];
  for (const [index, line] of block.lines.entries()) {
    const target = base + indentOf(line);
    const own = index === 0 && !isFirstIndented ? target : target - autoIndent;
    if (own < 0) {
      return null;
    }
    const body = line.trimStart().replace(FIELD, (_, name: string) => {
      field += 1;
      return `\${${field}:${name}}`;
    });
    lines.push(`${" ".repeat(own)}${body}`);
  }
  return lines;
}

function snippetFor(
  block: InsertableBlock,
  base: number,
  plan: {
    from: number;
    to: number;
    autoIndent: number;
    firstIndent: number;
    mode: "replace" | "before" | "after";
  },
): SnippetPlan | null {
  if (!hasFields(block)) {
    return null;
  }
  const lines = templateLines(block, base, plan.autoIndent, plan.mode === "after");
  if (!lines) {
    return null;
  }
  const [first = "", ...rest] = lines;
  const head = first.slice(plan.firstIndent);
  const joined = [head, ...rest].join("\n");
  const template =
    plan.mode === "after" ? `\n${joined}` : plan.mode === "before" ? `${joined}\n` : joined;
  return { from: plan.from, to: plan.to, template };
}

function emptyDocument(block: InsertableBlock): Insertion {
  const text = indented(block, 0).join("\n");
  return {
    from: 0,
    to: 0,
    text,
    firstLine: 1,
    lastLine: block.lines.length,
    cursor: text.length,
    snippet: snippetFor(block, 0, {
      from: 0,
      to: 0,
      autoIndent: 0,
      firstIndent: 0,
      mode: "replace",
    }),
  };
}

export function planInsertion(doc: string, cursor: number, block: InsertableBlock): Insertion {
  if (doc.length === 0) {
    return emptyDocument(block);
  }
  const lines = linesOf(doc);
  const line = lineAt(lines, cursor);
  const count = block.lines.length;
  const own = indentOf(line.text);

  if (isBlank(line.text)) {
    const base = blankBase(lines, line);
    const text = indented(block, base).join("\n");
    return {
      from: line.from,
      to: line.to,
      text,
      firstLine: line.number,
      lastLine: line.number + count - 1,
      cursor: line.from + text.length,
      snippet: snippetFor(block, base, {
        from: line.from,
        to: line.to,
        autoIndent: line.text.length,
        firstIndent: 0,
        mode: "replace",
      }),
    };
  }

  if (cursor - line.from <= own) {
    const body = indented(block, own).join("\n");
    return {
      from: line.from,
      to: line.from,
      text: `${body}\n`,
      firstLine: line.number,
      lastLine: line.number + count - 1,
      cursor: line.from + body.length,
      snippet: snippetFor(block, own, {
        from: line.from + own,
        to: line.from + own,
        autoIndent: own,
        firstIndent: own,
        mode: "before",
      }),
    };
  }

  const base = own + (isHeader(line.text) ? INDENT_WIDTH : 0);
  const body = indented(block, base).join("\n");
  return {
    from: line.to,
    to: line.to,
    text: `\n${body}`,
    firstLine: line.number + 1,
    lastLine: line.number + count,
    cursor: line.to + body.length + 1,
    snippet: snippetFor(block, base, {
      from: line.to,
      to: line.to,
      autoIndent: own,
      firstIndent: 0,
      mode: "after",
    }),
  };
}
