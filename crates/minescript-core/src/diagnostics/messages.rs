use super::DiagCode;
use crate::syntax::keywords::{Command, Keyword};

pub fn message(code: DiagCode) -> &'static str {
    match code {
        DiagCode::SynTab => "Tabulátor nem használható, a behúzás csak szóközből állhat.",
        DiagCode::SynEmptyLine => "Üres sor nem szerepelhet a programban.",
        DiagCode::SynDoubleSpace => "A tokenek között pontosan egy szóköz állhat.",
        DiagCode::SynTrailingSpace => "A sor végén nem állhat szóköz.",
        DiagCode::SynLoneCr => "Magányos kocsivissza (\\r) karakter a sorban.",
        DiagCode::SynUnknownCommand => "Ismeretlen utasítás.",
        DiagCode::SynUnexpectedToken => "Ezen a helyen ez a token nem állhat.",
        DiagCode::SynMissingToken => "Hiányzó token: az utasítás nem teljes.",
        DiagCode::SynExtraToken => "Fölösleges token az utasítás végén.",
        DiagCode::SynInvalidToken => "Érvénytelen token.",
        DiagCode::SynInvalidIdent => {
            "Érvénytelen azonosító: csak betűvel kezdődhet, és csak betűt vagy számjegyet tartalmazhat."
        }
        DiagCode::SynReservedIdent => "Kulcsszó nem lehet változónév.",
        DiagCode::SynNumberRange => "A számliterál értéke 0 és 100 között lehet.",
        DiagCode::SynToplevelIndent => "A legfelső szintű utasítás nem lehet behúzva.",
        DiagCode::SynUnexpectedIndent => {
            "Váratlan behúzás: csak if, else vagy while után kezdődhet blokk."
        }
        DiagCode::SynInconsistentIndent => "A blokkon belül a behúzásnak egységesnek kell lennie.",
        DiagCode::SynDedentMismatch => "A visszahúzás nem egyezik egyetlen nyitott szinttel sem.",
        DiagCode::SynElseWithoutIf => {
            "Az else előtt ugyanazon a szinten egy if blokknak kell állnia."
        }
        DiagCode::SynNotImplemented => "A szintaktikai elemző még nem készült el.",
        DiagCode::LintUnusedVar => "A változó értékét a program sehol nem olvassa.",
        DiagCode::LintMaybeUninit => "A változó ezen a ponton lehet, hogy még nem kapott értéket.",
        DiagCode::LintNonBoolLiteralCondition => {
            "A feltétel egy számliterál, ez futáskor E_NON_BOOL_CONDITION hibát okoz."
        }
        DiagCode::LintTypeChange => "A változó itt más típusú értéket kapna, mint korábban.",
        DiagCode::LintIsthereRange => "Az isThere paramétere csak 0, 1 vagy 2 lehet.",
        DiagCode::LintEmptyBlock => "Üres blokk.",
        DiagCode::LintCaseCollision => "Két változónév csak kis- és nagybetűben tér el.",
        DiagCode::LintLeadingZero => "Vezető nulla a számliterálban.",
        DiagCode::LintMergeSteps => "Az egymást követő step forward utasítások összevonhatók.",
        DiagCode::LintMergeTurns => "Az egymást követő turn by utasítások összevonhatók.",
        DiagCode::LintTurnMod4 => "A turn by értéke 4-gyel osztva ugyanazt az irányt adja.",
        DiagCode::LintNoop => "Az utasításnak nincs hatása.",
        DiagCode::MapEmpty => "A térképfájl üres.",
        DiagCode::MapHeader => {
            "Az első sornak a térkép méretét kell tartalmaznia: két egész szám, pontosan egy szóközzel elválasztva (például „3 15”)."
        }
        DiagCode::MapDimRange => "A térkép mindkét méretének 1 és 15 között kell lennie.",
        DiagCode::MapRowCount => "A térkép sorainak száma nem egyezik a fejlécben megadottal.",
        DiagCode::MapRowLength => "A sor hossza nem egyezik a fejlécben megadott oszlopszámmal.",
        DiagCode::MapBadSymbol => "Ismeretlen jel a térképen.",
        DiagCode::MapNoRobot => "A térképen nincs robot.",
        DiagCode::MapMultipleRobots => "A térképen pontosan egy robot lehet.",
        DiagCode::MapNoGold => "A térképen nincs arany.",
        DiagCode::MapUnreachableGold => "Ez az arany a robot kezdőhelyéről nem érhető el.",
    }
}

pub fn help(code: DiagCode) -> Option<&'static str> {
    match code {
        DiagCode::SynTab => Some("Cseréld a tabulátort szóközökre."),
        DiagCode::SynEmptyLine => Some("Töröld az üres sort."),
        DiagCode::SynDoubleSpace => Some("Hagyj pontosan egy szóközt a tokenek között."),
        DiagCode::SynTrailingSpace => Some("Töröld a sor végi szóközt."),
        DiagCode::SynLoneCr => Some("Mentsd a fájlt LF vagy CRLF sorvégekkel."),
        DiagCode::SynUnknownCommand => Some(
            "Az utasítás ezek egyike lehet: step, turn, mine, print, set, if, else, while. A kulcsszavak kis- és nagybetűérzékenyek.",
        ),
        DiagCode::SynInvalidToken => Some(
            "A tokeneket egy szóköz választja el (például „1 + 2”). Negatív szám helyett írd: „0 - 5”.",
        ),
        DiagCode::SynReservedIdent => Some(
            "Válassz másik nevet; a kulcsszavak semmilyen kis- és nagybetűs alakban nem lehetnek változónevek.",
        ),
        DiagCode::SynNumberRange => {
            Some("Nagyobb értéket számolással állíthatsz elő, például „set x to 100 * 2”.")
        }
        DiagCode::SynToplevelIndent => Some("Töröld a sor eleji szóközöket."),
        DiagCode::SynInconsistentIndent | DiagCode::SynDedentMismatch => {
            Some("Igazítsd a sort valamelyik nyitott blokk behúzásához.")
        }
        DiagCode::MapHeader => Some("Példa: „3 15”, utána pontosan 3 sor, soronként 15 jellel."),
        DiagCode::MapBadSymbol => Some("Megengedett jelek: . @ # > < ^ v"),
        DiagCode::MapNoRobot => Some("Helyezz el egy robotot: > kelet, < nyugat, ^ észak, v dél."),
        DiagCode::MapNoGold => Some("A térkép menthető, de nincs mit kibányászni."),
        DiagCode::LintIsthereRange => Some("0 = üres kamra, 1 = fal, 2 = aranyrög."),
        DiagCode::LintTurnMod4 => Some("Négy negyedfordulat egy teljes kör, használd a maradékot."),
        DiagCode::SynUnexpectedToken
        | DiagCode::SynMissingToken
        | DiagCode::SynExtraToken
        | DiagCode::SynInvalidIdent
        | DiagCode::SynUnexpectedIndent
        | DiagCode::SynElseWithoutIf
        | DiagCode::SynNotImplemented
        | DiagCode::LintUnusedVar
        | DiagCode::LintMaybeUninit
        | DiagCode::LintNonBoolLiteralCondition
        | DiagCode::LintTypeChange
        | DiagCode::LintEmptyBlock
        | DiagCode::LintCaseCollision
        | DiagCode::LintLeadingZero
        | DiagCode::LintMergeSteps
        | DiagCode::LintMergeTurns
        | DiagCode::LintNoop
        | DiagCode::MapEmpty
        | DiagCode::MapDimRange
        | DiagCode::MapRowCount
        | DiagCode::MapRowLength
        | DiagCode::MapMultipleRobots
        | DiagCode::MapUnreachableGold => None,
    }
}

pub fn dim_range(rows: &str, cols: &str) -> String {
    format!("A térkép mérete {rows}×{cols}, de mindkét méretnek 1 és 15 között kell lennie.")
}

pub fn row_count(expected: usize, actual: usize) -> String {
    format!("A fejléc szerint {expected} sornak kell következnie, de {actual} sor van.")
}

pub fn row_length(expected: usize, actual: usize) -> String {
    format!("Ez a sor {actual} jelből áll, de a fejléc szerint {expected} kell.")
}

pub fn bad_symbol(symbol: char) -> String {
    format!("Ismeretlen jel: „{}”.", symbol.escape_debug())
}

const VOWELS: &str = "aeiouáéíóöőúüű";

pub const EXPECTED_VALUE: &str = "egy egyszerű érték (szám, true, false vagy változónév)";
pub const EXPECTED_TARGET: &str = "egy változónév";
pub const EXPECTED_OPERATOR: &str = "egy művelet (+ - * = <> < <= > >= and or)";
pub const EXPECTED_EXPRESSION: &str = "egy egyszerű érték, az isThere vagy a not";
pub const EXPECTED_COMMAND: &str = "egy utasítás";

pub const FIX_REPLACE_CARRIAGE_RETURN: &str = "A \\r cseréje sortörésre";
pub const FIX_REPLACE_TABS: &str = "Tabulátorok cseréje szóközökre";
pub const FIX_DELETE_LINE: &str = "Sor törlése";
pub const FIX_DELETE_LINES: &str = "Sorok törlése";
pub const FIX_DELETE_SPACES: &str = "Fölösleges szóközök törlése";
pub const FIX_DELETE_TRAILING: &str = "Sor végi szóközök törlése";
pub const FIX_DELETE_EXTRA_TOKENS: &str = "Fölösleges tokenek törlése";
pub const FIX_REMOVE_INDENT: &str = "Sor eleji szóközök törlése";

pub const TYPE_INT: &str = "egész";
pub const TYPE_BOOL: &str = "logikai";

pub const EMPTY_IF_BLOCK: &str = "Az if blokkja üres.";
pub const EMPTY_ELSE_BLOCK: &str = "Az else blokkja üres.";
pub const EMPTY_WHILE_BLOCK: &str =
    "A while blokkja üres: ha a feltétel igaz, a ciklus a lépéskorlátig ismétlődik.";
pub const NOOP_STEP: &str = "A step forward 0 nem mozdítja el a robotot.";

pub fn article(word: &str) -> &'static str {
    let starts_with_vowel = word
        .chars()
        .next()
        .is_some_and(|first| first.to_lowercase().any(|lower| VOWELS.contains(lower)));
    if starts_with_vowel { "az" } else { "a" }
}

fn capitalized_article(word: &str) -> &'static str {
    if article(word) == "az" { "Az" } else { "A" }
}

pub fn expected_keyword(keyword: &str) -> String {
    format!("{} „{keyword}” kulcsszó", article(keyword))
}

pub fn unknown_command(found: &str) -> String {
    format!("Ismeretlen utasítás: „{found}”.")
}

pub fn did_you_mean(keyword: &str) -> String {
    format!("Talán erre gondoltál: „{keyword}”? A kulcsszavak kis- és nagybetűérzékenyek.")
}

pub fn unexpected_token(found: &str, expected: &str) -> String {
    format!("Itt {expected} állhat, de „{found}” áll.")
}

pub fn missing_token(expected: &str) -> String {
    format!("A sor véget ér, pedig még {expected} kellene.")
}

pub fn extra_token(found: &str) -> String {
    format!("Az utasítás már teljes, ez fölösleges: „{found}”.")
}

pub fn header_operation(command: Command, operator: &str) -> String {
    format!(
        "{} után csak egyetlen érték állhat, a(z) „{operator}” művelet nem szerepelhet a feltételben.",
        header_article(command)
    )
}

pub fn header_operation_help(command: Command, name: &str, operation: &str) -> String {
    match command {
        Command::While => format!(
            "Számold ki előbb set utasítással, a feltételbe a változót írd, és a ciklustörzs végén is számold ki újra, például: set {name} to {operation}, majd while {name}, a törzs utolsó soraként pedig újra set {name} to {operation}."
        ),
        _ => format!(
            "Számold ki előbb set utasítással, és a feltételbe a változót írd, például: set {name} to {operation}, majd if {name}."
        ),
    }
}

pub fn fix_header_operation(command: Command) -> &'static str {
    match command {
        Command::While => "Feltétel kiszámítása set-tel a ciklus előtt és a törzs végén",
        _ => "Feltétel kiszámítása set-tel az if előtt",
    }
}

fn header_article(command: Command) -> &'static str {
    match command {
        Command::While => "A while",
        _ => "Az if",
    }
}

pub fn command_form(command: Command) -> String {
    let form = match command {
        Command::Step => "step forward n",
        Command::Turn => "turn by n",
        Command::Mine => "mine here",
        Command::Print => "print x",
        Command::Set => "set név to érték",
        Command::If => "if feltétel",
        Command::Else => "else",
        Command::While => "while feltétel",
    };
    format!("Az utasítás alakja: {form}")
}

pub fn needs_assignment(keyword: Keyword) -> Option<String> {
    let example = match keyword {
        Keyword::IsThere => "set van to isThere 2",
        Keyword::Not => "set nincs to not van",
        _ => return None,
    };
    let name = keyword.as_str();
    Some(format!(
        "{} {name} csak set utasításban állhat; tedd előbb az eredményét egy változóba, például: {example}",
        capitalized_article(name)
    ))
}

pub fn reserved_ident(found: &str, keyword: &str) -> String {
    format!(
        "„{found}” nem lehet változónév, mert {} „{keyword}” kulcsszó más írásmódja.",
        article(keyword)
    )
}

pub fn invalid_token(found: &str) -> String {
    format!("Érvénytelen token: „{found}”.")
}

pub fn invalid_ident(found: &str) -> String {
    format!(
        "Érvénytelen azonosító: „{found}”. A változónév az angol ábécé betűjével kezdődik, és csak betűt vagy számjegyet tartalmazhat."
    )
}

pub fn number_range(found: &str) -> String {
    format!("A számliterál értéke 0 és 100 között lehet, de „{found}” ennél nagyobb.")
}

pub fn double_space(count: usize) -> String {
    format!("A tokenek között pontosan egy szóköz állhat, itt {count} áll.")
}

pub fn replace_with(text: &str) -> String {
    format!("Csere erre: „{text}”")
}

pub fn reindent_to(width: usize) -> String {
    format!("Behúzás igazítása: {width} szóköz")
}

pub fn toplevel_indent(width: usize) -> String {
    format!("A legfelső szintű utasítás nem lehet behúzva, itt {width} szóköz áll.")
}

pub fn unexpected_indent(width: usize) -> String {
    format!(
        "Váratlan behúzás ({width} szóköz): az előző sor nem if, else vagy while, ezért itt nem kezdődhet blokk."
    )
}

pub fn inconsistent_indent(expected: usize, actual: usize) -> String {
    format!("A blokk sorai {expected} szóközzel vannak behúzva, ez a sor {actual} szóközzel.")
}

pub fn dedent_mismatch(actual: usize, open_levels: &[usize]) -> String {
    let levels = open_levels
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "Ez a behúzás ({actual} szóköz) egyik nyitott szinthez sem illeszkedik; a nyitott szintek: {levels} szóköz."
    )
}

pub fn unused_var(name: &str) -> String {
    format!(
        "{} „{name}” változó értékét a program sehol nem olvassa.",
        capitalized_article(name)
    )
}

pub fn maybe_uninit(name: &str) -> String {
    format!(
        "Lehet, hogy {} „{name}” változó ezen a ponton még nem kapott értéket.",
        article(name)
    )
}

pub fn never_assigned(name: &str) -> String {
    format!(
        "{} „{name}” változónak a program sehol nem ad értéket, ezért az olvasása E_UNINITIALIZED hibát okoz.",
        capitalized_article(name)
    )
}

pub fn non_bool_literal_condition(value: i64) -> String {
    format!("A feltétel egy számliterál ({value}), ez futáskor E_NON_BOOL_CONDITION hibát okoz.")
}

pub fn type_change(name: &str, new_type: &str, fixed_type: &str, fixed_line: u32) -> String {
    format!(
        "{} „{name}” változó itt {new_type} értéket kapna, de a típusa már {fixed_type} ({fixed_line}. sor); ez futáskor E_TYPE_MISMATCH hibát okoz.",
        capitalized_article(name)
    )
}

pub fn isthere_range(found: &str) -> String {
    format!(
        "Az isThere paramétere csak 0, 1 vagy 2 lehet, itt {found} áll; ez futáskor E_BAD_ARG hibát okoz."
    )
}

pub fn case_collision(name: &str, other: &str) -> String {
    format!(
        "{} „{name}” és {} „{other}” változónév csak kis- és nagybetűben tér el.",
        capitalized_article(name),
        article(other)
    )
}

pub fn leading_zero(found: &str, value: i64) -> String {
    format!("Vezető nulla a számliterálban: „{found}” értéke {value}.")
}

pub fn merge_steps(count: usize, total: i64) -> String {
    format!("{count} egymást követő step forward utasítás összevonható: step forward {total}.")
}

pub fn merge_turns(count: usize, total: i64) -> String {
    if total == 0 {
        format!(
            "{count} egymást követő turn by utasítás együtt teljes kört tesz meg, mindegyik törölhető."
        )
    } else {
        format!("{count} egymást követő turn by utasítás összevonható: turn by {total}.")
    }
}

pub fn merged_into(text: &str) -> String {
    format!("Összevonás: {text}")
}

pub fn turn_mod4(value: i64, reduced: i64) -> String {
    format!("A turn by {value} ugyanazt az irányt adja, mint a turn by {reduced}.")
}

pub fn noop_turn(value: i64) -> String {
    format!("A turn by {value} nem változtat a robot irányán.")
}

pub fn noop_set(name: &str) -> String {
    format!(
        "A set {name} to {name} nem változtat {} „{name}” értékén.",
        article(name)
    )
}

pub fn variable_hover(name: &str, value_type: Option<&str>, first_line: Option<u32>) -> String {
    let kind = value_type.map_or_else(|| "változó".to_owned(), |name| format!("{name} változó"));
    match first_line {
        Some(line) => format!("„{name}” – {kind}. Első értékadás: {line}. sor."),
        None => format!("„{name}” – {kind}. A program sehol nem ad neki értéket."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn article_follows_the_first_sound() {
        assert_eq!(article("arany"), "az");
        assert_eq!(article("Ír"), "az");
        assert_eq!(article("count"), "a");
        assert_eq!(article(""), "a");
        assert_eq!(capitalized_article("x"), "A");
        assert_eq!(capitalized_article("isThere"), "Az");
    }

    #[test]
    fn formatted_messages_mention_their_subjects() {
        assert_eq!(expected_keyword("forward"), "a „forward” kulcsszó");
        assert!(unknown_command("Step").contains("„Step”"));
        assert!(did_you_mean("step").contains("„step”"));
        assert!(unexpected_token("back", "x").contains("„back”"));
        assert!(missing_token(EXPECTED_VALUE).contains(EXPECTED_VALUE));
        assert!(extra_token("2").contains("„2”"));
        assert!(command_form(Command::Mine).ends_with("mine here"));
        assert!(
            needs_assignment(Keyword::IsThere).is_some_and(|help| help.starts_with("Az isThere"))
        );
        assert!(needs_assignment(Keyword::Not).is_some_and(|help| help.contains("not van")));
        assert_eq!(needs_assignment(Keyword::Step), None);
        assert!(reserved_ident("If", "if").contains("az „if”"));
        assert!(invalid_token("1+2").contains("„1+2”"));
        assert!(invalid_ident("a_b").contains("„a_b”"));
        assert!(number_range("101").contains("„101”"));
        assert!(double_space(3).contains('3'));
        assert!(replace_with("step").contains("„step”"));
        assert!(reindent_to(4).contains('4'));
        assert!(toplevel_indent(2).contains('2'));
        assert!(unexpected_indent(4).contains('4'));
        assert!(inconsistent_indent(4, 6).contains('6'));
        assert!(dedent_mismatch(2, &[0, 4]).contains("0, 4"));
    }

    #[test]
    fn lint_messages_mention_names_and_values() {
        assert!(unused_var("arany").starts_with("Az „arany”"));
        assert!(maybe_uninit("x").contains("a „x”"));
        assert!(never_assigned("x").contains("E_UNINITIALIZED"));
        assert!(non_bool_literal_condition(5).contains('5'));
        assert!(type_change("x", TYPE_BOOL, TYPE_INT, 2).contains("2. sor"));
        assert!(isthere_range("3").contains('3'));
        assert!(case_collision("Arany", "arany").contains("az „arany”"));
        assert!(leading_zero("007", 7).contains("értéke 7"));
        assert!(merge_steps(2, 5).contains("step forward 5"));
        assert!(merge_turns(2, 3).contains("turn by 3"));
        assert!(merge_turns(2, 0).contains("teljes kört"));
        assert!(merged_into("turn by 1").contains("turn by 1"));
        assert!(turn_mod4(5, 1).contains("turn by 1"));
        assert!(noop_turn(4).contains("turn by 4"));
        assert!(noop_set("a").contains("set a to a"));
    }

    #[test]
    fn variable_hover_describes_type_and_first_line() {
        assert_eq!(
            variable_hover("arany", Some(TYPE_BOOL), Some(1)),
            "„arany” – logikai változó. Első értékadás: 1. sor."
        );
        assert_eq!(
            variable_hover("x", None, None),
            "„x” – változó. A program sehol nem ad neki értéket."
        );
    }
}
