export type CaseStatus = "passed" | "failed" | "skipped";

export type TestCase = {
  key: string;
  name: string;
  file: string | null;
  line: number | null;
  status: CaseStatus;
  durationMs: number | null;
  message: string | null;
  details: string | null;
  severity?: Severity;
};

export type Severity = "blokkoló" | "magas" | "közepes" | "alacsony";

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

export function normalizePath(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function attributes(raw: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of raw.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    const name = match[1];
    if (name) found[name] = decodeEntities(match[3] ?? match[4] ?? "");
  }
  return found;
}

function firstLine(text: string | null): string | null {
  if (!text) return null;
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return line ? line.slice(0, 500) : null;
}

export function parseJUnit(xml: string, base: string | null = null): TestCase[] {
  const cases: TestCase[] = [];
  const suites: string[] = [];
  const tag = /<(\/?)(testsuite|testcase|failure|error|skipped)\b([^>]*?)(\/?)>/g;
  let current: TestCase | null = null;
  let failureStart = -1;
  let failureMessage: string | null = null;
  let match: RegExpExecArray | null = tag.exec(xml);
  while (match) {
    const [whole, closing, name, raw = "", selfClosing] = match;
    const attrs = attributes(raw);
    if (name === "testsuite") {
      if (closing) suites.pop();
      else if (!selfClosing) suites.push(attrs.name ?? "");
    } else if (name === "testcase") {
      if (closing) {
        if (current) cases.push(current);
        current = null;
      } else {
        const file = normalizePath(attrs.file ?? null);
        const path = suites.filter(
          (part, index) => index > 0 || !file || normalizePath(part) !== file,
        );
        const title = [...path.filter((part) => part.length > 0), attrs.name ?? "névtelen"].join(
          " › ",
        );
        const joinedFile = file && base ? `${base}/${file}` : file;
        const entry: TestCase = {
          key: `${joinedFile ?? ""}::${title}`,
          name: title,
          file: joinedFile,
          line: attrs.line ? Number(attrs.line) : null,
          status: "passed",
          durationMs: attrs.time ? Math.round(Number(attrs.time) * 1000) : null,
          message: null,
          details: null,
        };
        if (selfClosing) cases.push(entry);
        else current = entry;
      }
    } else if (current && (name === "failure" || name === "error")) {
      if (closing) {
        const body = decodeEntities(xml.slice(failureStart, match.index)).trim();
        current.details = stripAnsi(body) || null;
        current.message = stripAnsi(failureMessage ?? "") || firstLine(current.details);
      } else {
        current.status = "failed";
        failureMessage = attrs.message ?? attrs.type ?? null;
        failureStart = match.index + whole.length;
        if (selfClosing) current.message = stripAnsi(failureMessage ?? "Sikertelen.");
      }
    } else if (current && name === "skipped" && !closing) {
      current.status = "skipped";
      current.message = attrs.message ?? null;
    }
    match = tag.exec(xml);
  }
  return cases;
}

type PwError = { message?: string; stack?: string; location?: { file?: string; line?: number } };
type PwResult = { status?: string; duration?: number; error?: PwError; errors?: PwError[] };
type PwTest = { status?: string; projectName?: string; results?: PwResult[] };
type PwSpec = { title?: string; file?: string; line?: number; tests?: PwTest[] };
type PwSuite = { title?: string; file?: string; specs?: PwSpec[]; suites?: PwSuite[] };
type PwReport = { suites?: PwSuite[]; errors?: PwError[] };

export function parsePlaywright(json: string, base: string): TestCase[] {
  const report = JSON.parse(json) as PwReport;
  const cases: TestCase[] = [];
  const walk = (suite: PwSuite, trail: string[]) => {
    const here = suite.file && suite.title === suite.file ? trail : [...trail, suite.title ?? ""];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const last = results.at(-1);
        const errors = results.flatMap((result) => [
          ...(result.errors ?? []),
          ...(result.error && !(result.errors ?? []).length ? [result.error] : []),
        ]);
        const file = normalizePath(spec.file ?? suite.file ?? null);
        const title = [...here.filter((part) => part.length > 0), spec.title ?? "névtelen"].join(
          " › ",
        );
        const status: CaseStatus =
          test.status === "skipped"
            ? "skipped"
            : test.status === "expected"
              ? "passed"
              : test.status === "flaky"
                ? "passed"
                : "failed";
        const details = errors
          .map((error) => stripAnsi(error.stack ?? error.message ?? ""))
          .filter(Boolean)
          .join("\n\n");
        const location = errors.find((error) => error.location)?.location;
        cases.push({
          key: `${base}/${file ?? ""}::${title}`,
          name: test.status === "flaky" ? `${title} (instabil: csak újrapróbálva sikerült)` : title,
          file: file ? `${base}/${file}` : null,
          line: location?.line ?? spec.line ?? null,
          status,
          durationMs: last?.duration ?? null,
          message:
            firstLine(stripAnsi(errors[0]?.message ?? "")) ??
            (status === "failed" ? "Sikertelen." : null),
          details: details || null,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  for (const error of report.errors ?? []) {
    const message = stripAnsi(error.message ?? "Ismeretlen hiba");
    cases.push({
      key: `${base}::globális hiba::${firstLine(message)}`,
      name: "A Playwright nem tudta betölteni vagy futtatni a csomagot",
      file: normalizePath(error.location?.file ?? null),
      line: error.location?.line ?? null,
      status: "failed",
      durationMs: null,
      message: firstLine(message),
      details: stripAnsi(error.stack ?? message),
    });
  }
  return cases;
}

export function parseLibtest(output: string): TestCase[] {
  const text = stripAnsi(output).replaceAll("\r\n", "\n");
  const cases = new Map<string, TestCase>();
  for (const match of text.matchAll(/^test (\S+) \.\.\. (ok|FAILED|ignored)(?:, [^\n]*)?$/gm)) {
    const [, name = "", verdict] = match;
    const status: CaseStatus =
      verdict === "ok" ? "passed" : verdict === "FAILED" ? "failed" : "skipped";
    if (cases.get(name)?.status === "failed") continue;
    cases.set(name, {
      key: `rust::${name}`,
      name,
      file: null,
      line: null,
      status,
      durationMs: null,
      message: status === "failed" ? "Sikertelen." : null,
      details: null,
    });
  }
  for (const block of text.matchAll(
    /^---- (\S+) stdout ----\n([\s\S]*?)(?=^---- \S+ stdout ----|^failures:\s*$|^test result:)/gm,
  )) {
    const [, name = "", body = ""] = block;
    const entry = cases.get(name);
    if (!entry) continue;
    entry.details = body.trim() || null;
    const panic = body.match(
      /panicked at ([^\n]+?):(\d+):\d+:\n([\s\S]*?)(?:\nnote:|\nstack backtrace:|$)/,
    );
    if (panic) {
      entry.file = normalizePath(panic[1]);
      entry.line = Number(panic[2]);
      entry.message = firstLine(panic[3] ?? null) ?? entry.message;
    } else {
      entry.message = firstLine(body) ?? entry.message;
    }
  }
  return [...cases.values()];
}

export function parseBiomeGithub(output: string): TestCase[] {
  const cases: TestCase[] = [];
  for (const match of stripAnsi(output).matchAll(/^::(error|warning|notice) ([^:]*)::(.*)$/gm)) {
    const [, level, raw = "", message = ""] = match;
    const fields = Object.fromEntries(
      raw.split(",").map((part) => {
        const [key = "", ...rest] = part.split("=");
        return [key.trim(), rest.join("=")];
      }),
    );
    const file = normalizePath(fields.file ?? null);
    const line = fields.line ? Number(fields.line) : null;
    const rule = fields.title ?? "biome";
    cases.push({
      key: `biome::${file}:${line}:${rule}`,
      name: `${rule} – ${file ?? "?"}${line ? `:${line}` : ""}`,
      file,
      line,
      status: level === "notice" ? "skipped" : "failed",
      durationMs: null,
      message: decodeURIComponent(message.replaceAll("%0A", "\n")).split("\n")[0] ?? message,
      details: decodeURIComponent(message.replaceAll("%0A", "\n")),
      severity: level === "error" ? "közepes" : "alacsony",
    });
  }
  return cases;
}

export function parseTypecheck(output: string): TestCase[] {
  const cases: TestCase[] = [];
  const text = stripAnsi(output);
  const patterns = [
    /^(?:[^\s]+ typecheck: )?([^\s(][^(\n]*?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm,
    /^(?:[^\s]+ typecheck: )?([^\s:][^:\n]*?):(\d+):(\d+) - error (TS\d+): (.+)$/gm,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const [, file = "", line = "0", , code = "", message = ""] = match;
      const path = normalizePath(file.trim());
      cases.push({
        key: `tsc::${path}:${line}:${code}`,
        name: `${code} – ${path}:${line}`,
        file: path,
        line: Number(line),
        status: "failed",
        durationMs: null,
        message,
        details: match[0],
        severity: "közepes",
      });
    }
  }
  return cases;
}

export function parseRustDiagnostics(output: string): TestCase[] {
  const cases: TestCase[] = [];
  const text = stripAnsi(output).replaceAll("\r\n", "\n");
  for (const match of text.matchAll(
    /^(error|warning)(\[[^\]]+\])?: (.+)\n\s*--> ([^:\n]+):(\d+):(\d+)/gm,
  )) {
    const [whole, level, code = "", message = "", file = "", line = "0"] = match;
    if (message.startsWith("aborting due") || message.includes("generated")) continue;
    const path = normalizePath(file);
    cases.push({
      key: `rustc::${path}:${line}:${code}${message}`,
      name: `${level}${code}: ${message}`.slice(0, 200),
      file: path,
      line: Number(line),
      status: "failed",
      durationMs: null,
      message,
      details: whole,
      severity: level === "error" ? "közepes" : "alacsony",
    });
  }
  for (const match of text.matchAll(/^Diff in (.+?)(?: at line |:)(\d+):?$/gm)) {
    const path = normalizePath(match[1]);
    cases.push({
      key: `rustfmt::${path}:${match[2]}`,
      name: `rustfmt – ${path}:${match[2]}`,
      file: path,
      line: Number(match[2]),
      status: "failed",
      durationMs: null,
      message: "A fájl nincs rustfmt szerint formázva.",
      details: null,
      severity: "alacsony",
    });
  }
  return cases;
}

const AUDIT_SEVERITY: Record<string, Severity> = {
  critical: "blokkoló",
  high: "magas",
  moderate: "közepes",
  low: "alacsony",
};

export function parseAudit(output: string): TestCase[] {
  const start = output.indexOf("{");
  if (start < 0) return [];
  let data: unknown;
  try {
    data = JSON.parse(output.slice(start));
  } catch {
    return [];
  }
  const cases: TestCase[] = [];
  const visit = (pkg: string, entry: unknown) => {
    if (!entry || typeof entry !== "object") return;
    const advisory = entry as Record<string, unknown>;
    const title = typeof advisory.title === "string" ? advisory.title : null;
    if (!title) return;
    const severity = String(advisory.severity ?? "moderate");
    const id = String(advisory.id ?? advisory.url ?? title);
    cases.push({
      key: `audit::${pkg}::${id}`,
      name: `${pkg}: ${title}`,
      file: null,
      line: null,
      status: "failed",
      durationMs: null,
      message: `${severity} – sérülékeny verziók: ${String(advisory.vulnerable_versions ?? "?")}`,
      details: [advisory.url, advisory.overview ?? advisory.recommendation]
        .filter(Boolean)
        .join("\n"),
      severity: AUDIT_SEVERITY[severity] ?? "közepes",
    });
  };
  const root = data as Record<string, unknown>;
  const advisories = (root.advisories ?? root.vulnerabilities ?? root) as Record<string, unknown>;
  for (const [pkg, value] of Object.entries(advisories)) {
    if (Array.isArray(value)) for (const entry of value) visit(pkg, entry);
    else visit(pkg, value);
  }
  return cases;
}

export function parseLcov(text: string, base: string | null, threshold = 95): TestCase[] {
  const cases: TestCase[] = [];
  for (const record of text.split("end_of_record")) {
    const source = record.match(/^SF:(.+)$/m)?.[1]?.trim();
    if (!source) continue;
    const path = normalizePath(source) ?? source;
    if (/(^|\/)(test|tests|node_modules)\/|\.test\.|\.d\.ts$|generated\//.test(path)) continue;
    const lines = [...record.matchAll(/^DA:(\d+),(\d+)/gm)].map((match) => ({
      line: Number(match[1]),
      hits: Number(match[2]),
    }));
    if (lines.length === 0) continue;
    const missed = lines.filter((entry) => entry.hits === 0).map((entry) => entry.line);
    const percent = ((lines.length - missed.length) / lines.length) * 100;
    const ranges: string[] = [];
    for (const line of missed) {
      const last = ranges.at(-1);
      const end = last ? Number(last.split("–").at(-1)) : Number.NaN;
      if (last && line === end + 1) ranges[ranges.length - 1] = `${last.split("–")[0]}–${line}`;
      else ranges.push(String(line));
    }
    const file = base && !path.startsWith(base) ? `${base}/${path}` : path;
    cases.push({
      key: `coverage::${file}`,
      name: `${file}: ${percent.toFixed(1)}% sorlefedettség`,
      file,
      line: missed[0] ?? null,
      status: percent + 1e-9 >= threshold ? "passed" : "failed",
      durationMs: null,
      message:
        percent + 1e-9 >= threshold
          ? null
          : `${percent.toFixed(1)}% < ${threshold}%: ${missed.length} lefedetlen sor (${lines.length} végrehajtható sorból).`,
      details: missed.length ? `Lefedetlen sorok: ${ranges.join(", ")}` : null,
      ...(percent < threshold
        ? { severity: percent < 80 ? ("közepes" as const) : ("alacsony" as const) }
        : {}),
    });
  }
  return cases;
}
