const VISIBLE = /[^\s\p{Cc}\p{Cf}\p{M}]/u;

export function hasVisibleText(text: string): boolean {
  return VISIBLE.test(text);
}
