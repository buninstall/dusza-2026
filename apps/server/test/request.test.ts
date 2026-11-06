import { describe, expect, test } from "bun:test";
import { behindProxy, forwardedClient } from "../src/lib/request.ts";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/login", { headers });
}

const direct = { requestIP: () => ({ address: "127.0.0.1" }) };

describe("kliens címe proxy mögött", () => {
  test("az X-Forwarded-For utolsó, a proxy által hozzáfűzött elemét veszi", () => {
    expect(forwardedClient(requestWith({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(
      forwardedClient(requestWith({ "x-forwarded-for": "6.6.6.6, 198.51.100.4 , 203.0.113.9 " })),
    ).toBe("203.0.113.9");
  });

  test("hiányzó vagy üres fejlécnél nincs továbbított cím", () => {
    expect(forwardedClient(requestWith({}))).toBeNull();
    expect(forwardedClient(requestWith({ "x-forwarded-for": "" }))).toBeNull();
    expect(forwardedClient(requestWith({ "x-forwarded-for": "1.2.3.4, " }))).toBeNull();
  });

  test("a behindProxy a továbbított címet adja, különben a közvetlen kapcsolatét", () => {
    const proxied = behindProxy(direct);
    expect(proxied.requestIP?.(requestWith({ "x-forwarded-for": "203.0.113.7" }))).toEqual({
      address: "203.0.113.7",
    });
    expect(proxied.requestIP?.(requestWith({}))).toEqual({ address: "127.0.0.1" });
    expect(behindProxy({}).requestIP?.(requestWith({}))).toBeNull();
  });
});
