const VOWELS = "aáeéiíoóöőuúüű";

function articleForNumber(value: number): "a" | "az" {
  const digits = String(Math.abs(Math.trunc(value)));
  const startsWithVowel =
    digits.startsWith("5") || (digits.startsWith("1") && digits.length % 3 === 1);
  return startsWithVowel ? "az" : "a";
}

export function article(text: string | number): "a" | "az" {
  if (typeof text === "number") {
    return articleForNumber(text);
  }
  const trimmed = text.trimStart();
  const leadingNumber = /^\d+/.exec(trimmed);
  if (leadingNumber) {
    return articleForNumber(Number(leadingNumber[0]));
  }
  const first = trimmed.charAt(0).toLocaleLowerCase("hu");
  return first !== "" && VOWELS.includes(first) ? "az" : "a";
}

export function capitalArticle(text: string | number): "A" | "Az" {
  return article(text) === "az" ? "Az" : "A";
}
