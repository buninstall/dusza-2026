use super::DiagCode;

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
