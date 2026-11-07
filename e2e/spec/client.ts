type Reply = { status: number; headers: Headers; body: string; json: unknown };

export class Client {
  private cookies = new Map<string, string>();
  readonly setCookies: string[] = [];

  constructor(private readonly base: URL) {}

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  async send(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Reply> {
    const cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
    const response = await fetch(new URL(path, this.base), {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Origin: this.base.origin,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    });
    for (const header of response.headers.getSetCookie()) {
      this.setCookies.push(header);
      const [pair = ""] = header.split(";");
      const [name = "", ...rest] = pair.split("=");
      const value = rest.join("=");
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(header) || value === "")
        this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
    const text = await response.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, headers: response.headers, body: text, json };
  }
}
