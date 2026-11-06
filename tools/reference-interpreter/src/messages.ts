import type { DiagCode, RuntimeErrorCode } from "@minescript/engine";

export const DIAGNOSTIC_MESSAGES: Partial<Record<DiagCode, string>> = {
  SYN_TAB: "Tab nem használható, csak szóköz.",
  SYN_EMPTY_LINE: "Üres sor nem lehet a programban.",
  SYN_DOUBLE_SPACE: "A tokenek között pontosan egy szóköz állhat.",
  SYN_TRAILING_SPACE: "A sor végén nem lehet szóköz.",
  SYN_LONE_CR: "Magányos kocsivissza (\\r) karakter a sorban.",
  SYN_UNKNOWN_COMMAND: "Ismeretlen utasítás.",
  SYN_UNEXPECTED_TOKEN: "Ezen a helyen más token várható.",
  SYN_MISSING_TOKEN: "Az utasítás nem teljes, hiányzik egy token.",
  SYN_EXTRA_TOKEN: "Az utasítás után fölösleges token áll.",
  SYN_INVALID_TOKEN: "Érvénytelen token.",
  SYN_INVALID_IDENT: "Az azonosító csak angol betűt és számjegyet tartalmazhat.",
  SYN_RESERVED_IDENT: "Kulcsszó nem lehet azonosító.",
  SYN_NUMBER_RANGE: "A számliterál 0 és 100 közötti lehet.",
  SYN_TOPLEVEL_INDENT: "A legfelső szintű sor nem lehet behúzva.",
  SYN_UNEXPECTED_INDENT: "Váratlan behúzás blokkfejléc nélkül.",
  SYN_INCONSISTENT_INDENT: "A blokkon belül a behúzásnak egységesnek kell lennie.",
  SYN_DEDENT_MISMATCH: "A visszahúzás nem egy nyitott szintre érkezik.",
  SYN_ELSE_WITHOUT_IF: "Az else előtt nincs hozzá tartozó if.",
  MAP_EMPTY: "A térképfájl üres.",
  MAP_HEADER: "A fejléc két, egy szóközzel elválasztott szám legyen.",
  MAP_DIM_RANGE: "A térkép mindkét mérete 1 és 15 közötti.",
  MAP_ROW_COUNT: "A sorok száma nem egyezik a fejléccel.",
  MAP_ROW_LENGTH: "A sor hossza nem egyezik a fejléccel.",
  MAP_BAD_SYMBOL: "Ismeretlen jel a térképen.",
  MAP_NO_ROBOT: "A térképen nincs robot.",
  MAP_MULTIPLE_ROBOTS: "A térképen több robot van.",
  MAP_NO_GOLD: "A térképen nincs arany.",
  MAP_UNREACHABLE_GOLD: "Ez az arany a robot kezdőmezőjéről nem érhető el.",
};

export const RUNTIME_MESSAGES: Record<RuntimeErrorCode, string> = {
  E_TYPE_MISMATCH: "A változó típusa nem változhat meg.",
  E_UNINITIALIZED: "Értékadás előtt olvasott változó.",
  E_NON_BOOL_CONDITION: "A feltétel nem logikai érték.",
  E_BAD_OPERAND: "A művelet operandusának típusa nem megfelelő.",
  E_BEDROCK_HIT: "A robot falba ütközne vagy lelépne a térképről.",
  E_NO_GOLD: "Ezen a mezőn nincs bányászható arany.",
  E_BAD_ARG: "Érvénytelen paraméter.",
  E_INT_OVERFLOW: "Az egész érték túllépi a megengedett tartományt.",
  INSTRUCTION_COUNT_LIMIT_EXCEEDED: "A program túllépte az 1000 feldolgozott sort.",
};

export function diagnosticMessage(code: DiagCode): string {
  return DIAGNOSTIC_MESSAGES[code] ?? code;
}
