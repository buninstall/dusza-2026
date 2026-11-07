import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Severity, TestCase } from "./parsers.ts";

export type ScanContext = { root: string; log: (line: string) => void; signal: AbortSignal };

const SLASH = "/";
const STAR = "*";
const MAX_TEXT_BYTES = 2_000_000;
const REGEX_PREFIX = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  "}",
  ";",
  "+",
  "-",
  "~",
  "^",
  "%",
  "<",
  ">",
]);

function finding(
  key: string,
  name: string,
  file: string | null,
  line: number | null,
  message: string,
  severity: Severity,
  details: string | null = null,
): TestCase {
  return { key, name, file, line, status: "failed", durationMs: null, message, details, severity };
}

function passed(key: string, name: string, message: string | null = null): TestCase {
  return {
    key,
    name,
    file: null,
    line: null,
    status: "passed",
    durationMs: null,
    message,
    details: null,
  };
}

async function trackedFiles(root: string): Promise<string[]> {
  const process = Bun.spawn(["git", "ls-files", "-z"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(process.stdout).text();
  await process.exited;
  return output.split("\u0000").filter((path) => path.length > 0);
}

function readText(root: string, path: string): string | null {
  const full = join(root, path);
  if (!existsSync(full)) return null;
  const size = statSync(full).size;
  if (size > MAX_TEXT_BYTES) return null;
  const buffer = readFileSync(full);
  if (buffer.includes(0)) return null;
  return buffer.toString("utf8");
}

export function codeComments(text: string, rust = false): number[] {
  const found: number[] = [];
  const braces: ("code" | "template")[] = [];
  let line = 1;
  let index = 0;
  let previous = "";
  const count = (from: number, to: number) => {
    for (let at = from; at < to; at += 1) if (text[at] === "\n") line += 1;
  };
  const skipQuoted = (quote: string) => {
    const from = index;
    index += 1;
    while (index < text.length && text[index] !== quote) {
      if (text[index] === "\\") index += 1;
      index += 1;
    }
    index += 1;
    count(from, index);
  };
  const skipTemplate = () => {
    const from = index;
    index += 1;
    while (index < text.length) {
      const char = text[index];
      if (char === "\\") index += 2;
      else if (char === "`") {
        index += 1;
        break;
      } else if (char === "$" && text[index + 1] === "{") {
        braces.push("template");
        index += 2;
        break;
      } else index += 1;
    }
    count(from, index);
  };
  while (index < text.length) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (char === "\n") {
      line += 1;
      index += 1;
      continue;
    }
    if (char === " " || char === "\t" || char === "\r") {
      index += 1;
      continue;
    }
    if (char === SLASH && (next === SLASH || next === STAR)) {
      found.push(line);
      const end =
        next === SLASH ? text.indexOf("\n", index) : text.indexOf(STAR + SLASH, index + 2);
      const stop = end < 0 ? text.length : end;
      count(index, stop);
      index = next === SLASH ? stop : stop + 2;
      continue;
    }
    if (
      rust &&
      char === "r" &&
      (next === '"' || (next === "#" && /^#+"/.test(text.slice(index + 1, index + 12))))
    ) {
      const hashes = text.slice(index + 1).match(/^#*/)?.[0] ?? "";
      const close = `"${hashes}`;
      const end = text.indexOf(close, index + 2 + hashes.length);
      const stop = end < 0 ? text.length : end + close.length;
      count(index, stop);
      index = stop;
      previous = "x";
      continue;
    }
    if (rust && char === "'") {
      const literal = text
        .slice(index)
        .match(/^'(\\(x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|.)|[^\\'\n])'/u);
      index += literal ? literal[0].length : 1;
      previous = "x";
      continue;
    }
    if (char === "'" || char === '"') {
      skipQuoted(char);
      previous = "x";
      continue;
    }
    if (!rust && char === "`") {
      skipTemplate();
      previous = "x";
      continue;
    }
    if (char === "{") braces.push("code");
    if (char === "}" && braces.pop() === "template") {
      index -= 1;
      skipTemplate();
      previous = "x";
      continue;
    }
    if (
      !rust &&
      char === SLASH &&
      (REGEX_PREFIX.has(previous) ||
        /\$\{\s*$/.test(text.slice(Math.max(0, index - 8), index)) ||
        /\b(return|typeof|case|of|in|yield|await)$/.test(
          text.slice(Math.max(0, index - 12), index).trimEnd(),
        ))
    ) {
      index += 1;
      let inClass = false;
      while (index < text.length && text[index] !== "\n" && (text[index] !== SLASH || inClass)) {
        if (text[index] === "\\") index += 1;
        else if (text[index] === "[") inClass = true;
        else if (text[index] === "]") inClass = false;
        index += 1;
      }
      index += 1;
      previous = "x";
      continue;
    }
    previous = /[A-Za-z0-9_$)\]]/.test(char) ? "x" : char;
    index += 1;
  }
  return found;
}

function hashComments(text: string, allowShebang: boolean): number[] {
  return text.split("\n").flatMap((content, index) => {
    const trimmed = content.trimStart();
    if (!trimmed.startsWith("#")) return [];
    if (allowShebang && index === 0 && trimmed.startsWith("#!")) return [];
    return [index + 1];
  });
}

function sqlComments(text: string): number[] {
  return text.split("\n").flatMap((content, index) => {
    const trimmed = content.trimStart();
    if (trimmed.startsWith("--> statement-breakpoint")) return [];
    return trimmed.startsWith("--") || trimmed.startsWith(SLASH + STAR) ? [index + 1] : [];
  });
}

function markupComments(text: string): number[] {
  const opener = "<" + "!--";
  return text
    .split("\n")
    .flatMap((content, index) => (content.includes(opener) ? [index + 1] : []));
}

const LOCKFILES = new Set([
  "bun.lock",
  "Cargo.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

export function commentLines(path: string, text: string): number[] {
  const name = path.split("/").at(-1) ?? path;
  if (LOCKFILES.has(name)) return [];
  if (/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(name)) return codeComments(text);
  if (/\.rs$/.test(name)) return codeComments(text, true);
  if (/\.(css|scss)$/.test(name)) return codeComments(text.replace(/url\([^)]*\)/g, "url()"), true);
  if (
    /\.(ya?ml|toml|sh|bash|py|ps1|conf|ini|env\.example|service|cfg)$/.test(name) ||
    /^(justfile|Justfile|Dockerfile|\.gitignore|\.gitattributes|\.dockerignore|\.env\.example|\.editorconfig)$/.test(
      name,
    )
  ) {
    return hashComments(text, true);
  }
  if (/\.sql$/.test(name)) return sqlComments(text);
  if (/\.(md|html|htm|svg|xml|vue)$/.test(name)) return markupComments(text);
  if (/\.jsonc?$/.test(name) && name.endsWith(".jsonc")) return codeComments(text);
  return [];
}

export async function scanComments(context: ScanContext): Promise<TestCase[]> {
  const files = await trackedFiles(context.root);
  const cases: TestCase[] = [];
  let checked = 0;
  for (const path of files) {
    if (context.signal.aborted) break;
    const text = readText(context.root, path);
    if (text === null) continue;
    checked += 1;
    const lines = commentLines(path, text);
    if (lines.length === 0) continue;
    const source = text.split("\n");
    for (const line of lines) {
      cases.push(
        finding(
          `comment::${path}:${line}`,
          `Komment: ${path}:${line}`,
          path,
          line,
          "A csapatszabály szerint a repóban sehol sem lehet komment (CLAUDE.md 1. pont).",
          "alacsony",
          (source[line - 1] ?? "").trim().slice(0, 400),
        ),
      );
    }
  }
  context.log(
    `${checked} verziókezelt szövegfájl átvizsgálva, ${cases.length} komment-jellegű sor.`,
  );
  if (cases.length === 0)
    cases.push(passed("comment::all", "Nincs komment a verziókezelt fájlokban", `${checked} fájl`));
  return cases;
}

type SecretRule = { id: string; title: string; pattern: RegExp; severity: Severity };

const SECRET_RULES: SecretRule[] = [
  {
    id: "private-key",
    title: "Privát kulcs",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
    severity: "blokkoló",
  },
  {
    id: "aws-key",
    title: "AWS hozzáférési kulcs",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    severity: "blokkoló",
  },
  {
    id: "github-token",
    title: "GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g,
    severity: "blokkoló",
  },
  {
    id: "slack-token",
    title: "Slack token",
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    severity: "blokkoló",
  },
  {
    id: "google-key",
    title: "Google API-kulcs",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    severity: "magas",
  },
  {
    id: "stripe-key",
    title: "Stripe titkos kulcs",
    pattern: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/g,
    severity: "blokkoló",
  },
  {
    id: "anthropic-key",
    title: "Anthropic/OpenAI API-kulcs",
    pattern: /\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}\b/g,
    severity: "blokkoló",
  },
  {
    id: "jwt",
    title: "JWT token",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: "magas",
  },
  {
    id: "url-credentials",
    title: "Jelszó egy kapcsolati URL-ben",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"`]+:([^\s@/'"`$]{3,})@[^\s'"`]+/gi,
    severity: "közepes",
  },
  {
    id: "assigned-secret",
    title: "Kódba írt jelszó vagy titok",
    pattern:
      /\b(?:password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|session[_-]?secret)\b["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/gi,
    severity: "magas",
  },
];

const SECRET_ALLOW: RegExp[] = [];

function entropy(text: string): number {
  const counts = new Map<string, number>();
  for (const char of text) counts.set(char, (counts.get(char) ?? 0) + 1);
  let total = 0;
  for (const value of counts.values()) {
    const p = value / text.length;
    total -= p * Math.log2(p);
  }
  return total;
}

function mask(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} karakter)`;
}

const PLACEHOLDER_WORDS =
  /^(minescript|password|passw(or)?d|pass|pwd|secret|changeme|example|sample|dummy|root|admin|user|test\w*|jelszo\w*|titok)$/i;

export function isPlaceholder(value: string): boolean {
  if (/^\*+$|^x+$|^\.+$/i.test(value)) return true;
  if (/^\$|\$\{|process\.env|^<.*>$|^\{.*\}$|%[A-Z_]+%/.test(value)) return true;
  if (/^(current|new)-password$/.test(value)) return true;
  if (/^[A-Z][A-Z0-9_]*$/.test(value)) return true;
  if (PLACEHOLDER_WORDS.test(value)) return true;
  return entropy(value) < 3;
}

function scanSecretsIn(path: string, text: string): TestCase[] {
  const cases: TestCase[] = [];
  const lineAt = (offset: number) => text.slice(0, offset).split("\n").length;
  const testLike = /(^|\/)(test|tests|e2e|conformance|fixtures?)\/|\.(test|spec)\.ts$/.test(path);
  for (const rule of SECRET_RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = match[1] ?? match[0];
      if (SECRET_ALLOW.some((allowed) => allowed.test(value))) continue;
      if (rule.id === "assigned-secret" || rule.id === "url-credentials") {
        if (isPlaceholder(value)) continue;
        if (testLike && entropy(value) < 4) continue;
      }
      const line = lineAt(match.index ?? 0);
      const severity: Severity =
        testLike && rule.severity !== "blokkoló" ? "alacsony" : rule.severity;
      cases.push(
        finding(
          `secret::${rule.id}::${path}:${line}`,
          `${rule.title}: ${path}:${line}`,
          path,
          line,
          `${rule.title} található a fájlban: ${mask(value)}${testLike ? " (tesztfájl, ellenőrizd, hogy csak tesztadat-e)" : ""}`,
          severity,
        ),
      );
    }
  }
  for (const match of text.matchAll(/["'`]([A-Za-z0-9+/=_-]{40,})["'`]/g)) {
    const value = match[1] ?? "";
    if (
      entropy(value) < 4.8 ||
      /^[a-f0-9]+$/i.test(value) ||
      SECRET_ALLOW.some((allowed) => allowed.test(value))
    )
      continue;
    const line = lineAt(match.index ?? 0);
    cases.push(
      finding(
        `secret::entropy::${path}:${line}`,
        `Nagy entrópiájú karakterlánc: ${path}:${line}`,
        path,
        line,
        `Titoknak látszó, véletlenszerű érték: ${mask(value)} (entrópia ${entropy(value).toFixed(2)} bit/karakter).`,
        testLike ? "alacsony" : "közepes",
      ),
    );
  }
  return cases;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export async function scanSecrets(context: ScanContext): Promise<TestCase[]> {
  const files = await trackedFiles(context.root);
  const cases: TestCase[] = [];
  for (const path of files) {
    if (context.signal.aborted) break;
    const name = path.split("/").at(-1) ?? "";
    if (/^\.env($|\.)/.test(name) && !name.endsWith(".example")) {
      cases.push(
        finding(
          `secret::envfile::${path}`,
          `Verziókezelt .env fájl: ${path}`,
          path,
          null,
          "Környezeti titkokat tartalmazó fájl van a verziókezelésben.",
          "blokkoló",
        ),
      );
    }
    if (/\.(pem|key|p12|pfx|jks)$|^id_(rsa|ed25519|ecdsa)$/.test(name)) {
      cases.push(
        finding(
          `secret::keyfile::${path}`,
          `Kulcsfájl a verziókezelésben: ${path}`,
          path,
          null,
          "Kulcsfájl van a verziókezelésben.",
          "blokkoló",
        ),
      );
    }
    if (LOCKFILES.has(name)) continue;
    const text = readText(context.root, path);
    if (text !== null) cases.push(...scanSecretsIn(path, text));
  }
  const dist = join(context.root, "apps", "web", "dist");
  const bundle = walk(dist);
  for (const full of bundle) {
    const path = relative(context.root, full).replaceAll("\\", "/");
    if (path.endsWith(".map")) {
      cases.push(
        finding(
          `bundle::sourcemap::${path}`,
          `Source map a kliens buildben: ${path}`,
          path,
          null,
          "Az éles buildben source map van, ami a teljes forráskódot kiadja.",
          "közepes",
        ),
      );
      continue;
    }
    if (!/\.(js|css|html|json)$/.test(path)) continue;
    const text = readText(context.root, path);
    if (text === null) continue;
    cases.push(...scanSecretsIn(path, text));
    if (/sourceMappingURL=/.test(text)) {
      cases.push(
        finding(
          `bundle::sourcemapref::${path}`,
          `sourceMappingURL hivatkozás: ${path}`,
          path,
          null,
          "A kliens csomag source mapre hivatkozik.",
          "alacsony",
        ),
      );
    }
  }
  context.log(`${files.length} verziókezelt fájl és ${bundle.length} buildfájl átvizsgálva.`);
  if (bundle.length === 0)
    context.log(
      "Az apps/web/dist nem létezik: a kliens csomag vizsgálatához előbb futtasd a buildet.",
    );
  if (cases.length === 0)
    cases.push(passed("secret::all", "Nem található titok", `${files.length} fájl`));
  return cases;
}

export async function scanHygiene(context: ScanContext): Promise<TestCase[]> {
  const files = await trackedFiles(context.root);
  const cases: TestCase[] = [];
  for (const path of files) {
    if (context.signal.aborted) break;
    const full = join(context.root, path);
    if (!existsSync(full)) {
      cases.push(
        finding(
          `hygiene::missing::${path}`,
          `Törölt, de verziókezelt fájl: ${path}`,
          path,
          null,
          "A fájl a gitben szerepel, a munkakönyvtárban nincs.",
          "alacsony",
        ),
      );
      continue;
    }
    const size = statSync(full).size;
    if (size > 5_000_000) {
      cases.push(
        finding(
          `hygiene::large::${path}`,
          `Nagy fájl: ${path}`,
          path,
          null,
          `${(size / 1e6).toFixed(1)} MB-os fájl a verziókezelésben.`,
          "alacsony",
        ),
      );
    }
    if (/\.local\./.test(path) || /(^|\/)(\.DS_Store|Thumbs\.db|npm-debug\.log)$/.test(path)) {
      cases.push(
        finding(
          `hygiene::local::${path}`,
          `Lokális fájl a verziókezelésben: ${path}`,
          path,
          null,
          "Gépi vagy lokális fájl került a repóba.",
          "alacsony",
        ),
      );
    }
    const text = readText(context.root, path);
    if (text === null) continue;
    text.split("\n").forEach((content, index) => {
      if (/^(<{7}|>{7}) |^={7}$/.test(content)) {
        cases.push(
          finding(
            `hygiene::conflict::${path}:${index + 1}`,
            `Ütközésjelző: ${path}:${index + 1}`,
            path,
            index + 1,
            "Feloldatlan merge-ütközés jelzője maradt a fájlban.",
            "blokkoló",
          ),
        );
      }
    });
    if (
      text.includes("\r\n") &&
      !/\.(bat|cmd|ps1)$/.test(path) &&
      !/^conformance\/.*(crlf|lone-cr)/i.test(path)
    ) {
      cases.push(
        finding(
          `hygiene::crlf::${path}`,
          `CRLF sorvég: ${path}`,
          path,
          null,
          "A fájl CRLF sorvégeket tartalmaz (a Biome és a diffek LF-et várnak).",
          "alacsony",
        ),
      );
    }
    if (
      /\.(ts|tsx|js)$/.test(path) &&
      !/(^|\/)(test|e2e|scripts|bench)\/|\.(test|spec|bench)\./.test(path)
    ) {
      text.split("\n").forEach((content, index) => {
        if (
          /\bdebugger\b|\bconsole\.log\(|\.only\(/.test(content) &&
          !/^\s*(\*|\/\/)/.test(content)
        ) {
          if (
            /apps\/server\/src\/index\.ts|scripts\//.test(path) &&
            content.includes("console.log")
          )
            return;
          cases.push(
            finding(
              `hygiene::debug::${path}:${index + 1}`,
              `Hibakereső maradvány: ${path}:${index + 1}`,
              path,
              index + 1,
              "debugger, console.log vagy .only maradt a termékkódban.",
              "alacsony",
              content.trim().slice(0, 300),
            ),
          );
        }
      });
    }
    if (/\.(test|spec)\.ts$/.test(path)) {
      text.split("\n").forEach((content, index) => {
        if (/\b(test|it|describe)\.(only|skip|todo)\(|\bxit\(|\bfit\(/.test(content)) {
          cases.push(
            finding(
              `hygiene::skip::${path}:${index + 1}`,
              `Kihagyott vagy kizárólagos teszt: ${path}:${index + 1}`,
              path,
              index + 1,
              "A teszt .only/.skip/.todo jelölést kapott, így a csomag nem fut teljesen.",
              "közepes",
              content.trim().slice(0, 300),
            ),
          );
        }
      });
    }
  }
  const status = Bun.spawn(["git", "status", "--porcelain"], { cwd: context.root, stdout: "pipe" });
  const dirty = (await new Response(status.stdout).text()).trim();
  context.log(dirty ? `Nem commitolt változások:\n${dirty}` : "A munkakönyvtár tiszta.");
  if (cases.length === 0)
    cases.push(passed("hygiene::all", "A repó higiéniája rendben", `${files.length} fájl`));
  return cases;
}

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])$/;

type Probe = {
  name: string;
  run: (base: URL, log: (line: string) => void) => Promise<string | null>;
  severity: Severity;
};

function leaksInternals(body: string): string | null {
  const patterns: [RegExp, string][] = [
    [/\n\s+at [^\n]+:\d+:\d+/, "stack trace"],
    [/[A-Z]:\\[^\s"']+\\/, "Windows útvonal"],
    [/\/(home|Users|var|opt)\/[^\s"']+\//, "belső útvonal"],
    [/node_modules/, "node_modules útvonal"],
    [/\b(SELECT|INSERT|UPDATE|DELETE)\b[^"]{0,80}\b(FROM|INTO|SET)\b/, "SQL utasítás"],
    [/ER_[A-Z_]+|SQLSTATE|mysql2?/i, "adatbázis-hibakód"],
  ];
  for (const [pattern, label] of patterns) if (pattern.test(body)) return label;
  return null;
}

async function fetchText(
  url: URL | string,
  init: RequestInit = {},
): Promise<{ response: Response; body: string }> {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    ...init,
  });
  return { response, body: await response.text() };
}

const PROTECTED = ["/api/maps", "/api/programs", "/api/runs", "/api/me", "/api/admin/users"];

const PROBES: Probe[] = [
  {
    name: "Az egészség-végpont elérhető",
    severity: "magas",
    run: async (base) => {
      const { response } = await fetchText(new URL("/api/health", base));
      return response.ok ? null : `A /api/health válasza ${response.status}.`;
    },
  },
  {
    name: "Biztonsági fejlécek a főoldalon és az API-n",
    severity: "közepes",
    run: async (base) => {
      const problems: string[] = [];
      for (const path of ["/", "/api/health"]) {
        const { response } = await fetchText(new URL(path, base));
        const header = (name: string) => response.headers.get(name);
        const csp = header("content-security-policy");
        if (!csp) problems.push(`${path}: hiányzik a Content-Security-Policy`);
        else {
          const script = csp.split(";").find((part) => part.trim().startsWith("script-src")) ?? csp;
          if (/'unsafe-eval'/.test(script))
            problems.push(`${path}: a CSP engedi az 'unsafe-eval'-t`);
          if (/'unsafe-inline'/.test(script) && !/nonce-|sha256-/.test(script))
            problems.push(`${path}: a CSP script-src engedi az 'unsafe-inline'-t`);
        }
        if (!header("x-frame-options") && !/frame-ancestors/.test(csp ?? ""))
          problems.push(`${path}: nincs kattintáseltérítés elleni védelem`);
        if (header("x-content-type-options") !== "nosniff")
          problems.push(`${path}: hiányzik az X-Content-Type-Options: nosniff`);
        if (!header("referrer-policy")) problems.push(`${path}: hiányzik a Referrer-Policy`);
        if (header("x-powered-by"))
          problems.push(
            `${path}: X-Powered-By fejléc árulja el a technológiát (${header("x-powered-by")})`,
          );
        if (/\d/.test(header("server") ?? ""))
          problems.push(`${path}: a Server fejléc verziót tartalmaz (${header("server")})`);
      }
      return problems.length ? problems.join("\n") : null;
    },
  },
  {
    name: "Bejelentkezés nélkül a védett végpontok elérhetetlenek",
    severity: "blokkoló",
    run: async (base) => {
      const open: string[] = [];
      for (const path of PROTECTED) {
        const { response, body } = await fetchText(new URL(path, base));
        if (response.status < 400 || response.status >= 500)
          open.push(`${path} → ${response.status} ${body.slice(0, 120)}`);
      }
      return open.length ? `Bejelentkezés nélkül is válaszol:\n${open.join("\n")}` : null;
    },
  },
  {
    name: "A CORS nem engedi az idegen originnek az olvasást",
    severity: "magas",
    run: async (base) => {
      const evil = "http://evil.invalid";
      const { response } = await fetchText(new URL("/api/health", base), {
        headers: { Origin: evil },
      });
      const allowed = response.headers.get("access-control-allow-origin");
      if (allowed === "*" || allowed === evil) return `Access-Control-Allow-Origin: ${allowed}`;
      const preflight = await fetchText(new URL("/api/maps", base), {
        method: "OPTIONS",
        headers: { Origin: evil, "Access-Control-Request-Method": "POST" },
      });
      const pre = preflight.response.headers.get("access-control-allow-origin");
      return pre === "*" || pre === evil
        ? `Az előzetes kérés engedi az idegen origint: ${pre}`
        : null;
    },
  },
  {
    name: "Idegen originről érkező állapotváltoztató kérés elutasítva (CSRF)",
    severity: "magas",
    run: async (base) => {
      const { response } = await fetchText(new URL("/api/auth/login", base), {
        method: "POST",
        headers: { Origin: "http://evil.invalid", "Content-Type": "application/json" },
        body: JSON.stringify({ username: "csrfproba", password: "nemjojelszo1" }),
      });
      return response.status === 403
        ? null
        : `Az idegen originről küldött POST válasza ${response.status}, 403 helyett.`;
    },
  },
  {
    name: "Hibás JSON és ismeretlen útvonal: nincs belső információ a válaszban",
    severity: "közepes",
    run: async (base) => {
      const problems: string[] = [];
      const origin = base.origin;
      const bad = await fetchText(new URL("/api/auth/login", base), {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: '{"username": ',
      });
      if (bad.response.status >= 500) problems.push(`Hibás JSON → ${bad.response.status}`);
      const leakBad = leaksInternals(bad.body);
      if (leakBad) problems.push(`Hibás JSON válasza ${leakBad}-t tartalmaz`);
      for (const body of [
        "[]",
        '"x"',
        "123",
        '{"username":{"$gt":""},"password":["a"]}',
        '{"__proto__":{"admin":true},"username":"a","password":"b"}',
      ]) {
        const typed = await fetchText(new URL("/api/auth/login", base), {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body,
        });
        if (typed.response.status >= 500)
          problems.push(`Váratlan típusú törzs (${body}) → ${typed.response.status}`);
        const leak = leaksInternals(typed.body);
        if (leak) problems.push(`A(z) ${body} törzsre adott válasz ${leak}-t tartalmaz`);
      }
      const wrongType = await fetchText(new URL("/api/auth/login", base), {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "text/plain" },
        body: '{"username":"a","password":"b"}',
      });
      if (wrongType.response.status >= 500)
        problems.push(`text/plain Content-Type → ${wrongType.response.status}`);
      const missing = await fetchText(new URL("/api/nincs-ilyen-vegpont", base));
      if (missing.response.status !== 404 && missing.response.status !== 401)
        problems.push(`Ismeretlen API-útvonal → ${missing.response.status}`);
      const leakMissing = leaksInternals(missing.body);
      if (leakMissing) problems.push(`A 404-es válasz ${leakMissing}-t tartalmaz`);
      return problems.length ? problems.join("\n") : null;
    },
  },
  {
    name: "Útvonal-bejárás a statikus kiszolgálásban",
    severity: "blokkoló",
    run: async (base) => {
      const attempts = [
        "/..%2f..%2fpackage.json",
        "/%2e%2e/%2e%2e/package.json",
        "/assets/..%2f..%2f..%2fpackage.json",
        "/assets/%2e%2e%2f%2e%2e%2f%2e%2e%2fpackage.json",
        "/..%5c..%5cpackage.json",
        "/%252e%252e/%252e%252e/package.json",
        "/.env",
        "/.git/config",
        "/apps/server/src/index.ts",
      ];
      const leaked: string[] = [];
      for (const path of attempts) {
        const response = await fetch(`${base.origin}${path}`, {
          redirect: "manual",
          signal: AbortSignal.timeout(15_000),
        });
        const body = await response.text();
        if (/"workspaces"|\[core\]|DATABASE_URL|import .* from/.test(body))
          leaked.push(`${path} → ${response.status}`);
      }
      return leaked.length ? `Szerveroldali fájl olvasható:\n${leaked.join("\n")}` : null;
    },
  },
  {
    name: "Nincs source map és nincs könyvtárlistázás",
    severity: "közepes",
    run: async (base) => {
      const problems: string[] = [];
      const { body } = await fetchText(new URL("/", base));
      const scripts = [...body.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
        (match) => match[1] ?? "",
      );
      for (const src of scripts) {
        const url = new URL(src, base);
        const script = await fetchText(url);
        if (/sourceMappingURL=/.test(script.body))
          problems.push(`${url.pathname} source mapre hivatkozik`);
        const map = await fetchText(new URL(`${url.pathname}.map`, base));
        if (map.response.ok && map.body.includes('"mappings"'))
          problems.push(`${url.pathname}.map letölthető`);
      }
      for (const path of ["/assets/", "/static/"]) {
        const listing = await fetchText(new URL(path, base));
        if (/Index of|<title>Directory/i.test(listing.body))
          problems.push(`${path} könyvtárlistát ad`);
      }
      return problems.length ? problems.join("\n") : null;
    },
  },
  {
    name: "Váratlan HTTP-metódusok",
    severity: "alacsony",
    run: async (base) => {
      const problems: string[] = [];
      for (const method of ["TRACE", "PUT", "DELETE", "PATCH"]) {
        const { response, body } = await fetchText(new URL("/api/health", base), {
          method,
          headers: { Origin: base.origin },
        });
        if (response.status >= 500) problems.push(`${method} /api/health → ${response.status}`);
        if (method === "TRACE" && response.ok && body.includes("TRACE"))
          problems.push("A TRACE visszatükrözi a kérést");
      }
      return problems.length ? problems.join("\n") : null;
    },
  },
  {
    name: "Bejelentkezési próbálkozások korlátozása (brute force)",
    severity: "magas",
    run: async (base) => {
      const username = `bf${Date.now().toString(36)}`;
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { response } = await fetchText(new URL("/api/auth/login", base), {
          method: "POST",
          headers: { Origin: base.origin, "Content-Type": "application/json" },
          body: JSON.stringify({ username, password: `rossz-jelszo-${attempt}` }),
        });
        statuses.push(response.status);
        if (response.status === 429) return null;
      }
      return `8 egymás utáni hibás bejelentkezés sem kapott 429-et: ${statuses.join(", ")}`;
    },
  },
  {
    name: "Túl nagy kéréstörzs: elutasítva, a szerver életben marad",
    severity: "magas",
    run: async (base) => {
      let status = "kapcsolat bontva";
      try {
        const { response } = await fetchText(new URL("/api/auth/login", base), {
          method: "POST",
          headers: { Origin: base.origin, "Content-Type": "application/json" },
          body: JSON.stringify({ username: "x", password: "y".repeat(5_000_000) }),
        });
        status = String(response.status);
        if (response.status >= 500) return `5 MB-os törzs → ${response.status}`;
        if (response.ok) return "5 MB-os törzset a szerver elfogadta";
      } catch {
        status = "kapcsolat bontva";
      }
      const health = await fetchText(new URL("/api/health", base));
      return health.response.ok
        ? null
        : `A nagy törzs (${status}) után a szerver nem egészséges: ${health.response.status}`;
    },
  },
  {
    name: "Felhasználónév-felsorolás: azonos hiba létező és nem létező névre",
    severity: "közepes",
    run: async (base) => {
      const ask = async (username: string) => {
        const { response, body } = await fetchText(new URL("/api/auth/login", base), {
          method: "POST",
          headers: { Origin: base.origin, "Content-Type": "application/json" },
          body: JSON.stringify({ username, password: "biztosan-rossz-jelszo-123" }),
        });
        return `${response.status} ${body}`;
      };
      const missing = await ask(`nincs${Date.now().toString(36)}`);
      const known = await ask("admin");
      if (missing.startsWith("429") || known.startsWith("429")) return null;
      return missing === known
        ? null
        : `Eltérő válasz létező (admin) és nem létező névre:\n${known}\n${missing}`;
    },
  },
];

export async function probeLive(context: ScanContext, baseUrl: string): Promise<TestCase[]> {
  const base = new URL(baseUrl);
  if (!LOOPBACK.test(base.hostname)) {
    return [
      finding(
        "live::target",
        "Célpont ellenőrzése",
        null,
        null,
        `Csak helyi (loopback) cím vizsgálható, ez nem az: ${base.hostname}`,
        "alacsony",
      ),
    ];
  }
  const cases: TestCase[] = [];
  for (const probe of PROBES) {
    if (context.signal.aborted) break;
    const started = performance.now();
    context.log(`▶ ${probe.name}`);
    try {
      const problem = await probe.run(base, context.log);
      const durationMs = Math.round(performance.now() - started);
      context.log(problem ? `  ✗ ${problem.replaceAll("\n", "\n    ")}` : "  ✓ rendben");
      cases.push(
        problem
          ? {
              ...finding(
                `live::${probe.name}`,
                probe.name,
                null,
                null,
                problem.split("\n")[0] ?? problem,
                probe.severity,
                problem,
              ),
              durationMs,
            }
          : { ...passed(`live::${probe.name}`, probe.name), durationMs },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.log(`  ✗ nem futtatható: ${message}`);
      cases.push(
        finding(
          `live::${probe.name}`,
          probe.name,
          null,
          null,
          `A vizsgálat nem futott le: ${message} (fut a szerver a(z) ${base.origin} címen?)`,
          probe.severity,
        ),
      );
    }
  }
  return cases;
}
