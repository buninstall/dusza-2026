use crate::syntax::ast::BinOp;

pub struct CommandDoc {
    pub keyword: &'static str,
    pub label: &'static str,
    pub detail: &'static str,
    pub snippet: &'static str,
    pub documentation: &'static str,
}

pub const COMMAND_DOCS: [CommandDoc; 8] = [
    CommandDoc {
        keyword: "step",
        label: "step forward",
        detail: "step forward n",
        snippet: "step forward ${n}",
        documentation: "A robot n mezőt lép előre a jelenlegi irányában, közben minden érintett mezőt felfedez. Ha falba ütközne vagy lelépne a térképről, E_BEDROCK_HIT hiba keletkezik.",
    },
    CommandDoc {
        keyword: "turn",
        label: "turn by",
        detail: "turn by n",
        snippet: "turn by ${n}",
        documentation: "A robot n negyedfordulatot fordul balra, az óramutató járásával ellentétesen. 0 esetén az irány nem változik.",
    },
    CommandDoc {
        keyword: "mine",
        label: "mine here",
        detail: "mine here",
        snippet: "mine here",
        documentation: "Kibányássza az aranyrögöt a robot mezőjén. Ha ott nincs (vagy már nincs) arany, E_NO_GOLD hiba keletkezik.",
    },
    CommandDoc {
        keyword: "print",
        label: "print",
        detail: "print x",
        snippet: "print ${x}",
        documentation: "Kiírja egy egész vagy logikai érték értékét a konzolra.",
    },
    CommandDoc {
        keyword: "set",
        label: "set",
        detail: "set név to érték",
        snippet: "set ${név} to ${érték}",
        documentation: "Értéket ad egy változónak. Az első értékadás létrehozza a változót és véglegesen rögzíti a típusát.",
    },
    CommandDoc {
        keyword: "if",
        label: "if",
        detail: "if feltétel",
        snippet: "if ${feltétel}\n    ${}",
        documentation: "Feltételes elágazás: a mélyebbre húzott blokk csak akkor fut, ha a logikai feltétel igaz.",
    },
    CommandDoc {
        keyword: "else",
        label: "else",
        detail: "else",
        snippet: "else\n    ${}",
        documentation: "Az if hamis ága. Az if-fel azonos behúzáson áll, közvetlenül az if blokkja után.",
    },
    CommandDoc {
        keyword: "while",
        label: "while",
        detail: "while feltétel",
        snippet: "while ${feltétel}\n    ${}",
        documentation: "Ciklus: a mélyebbre húzott blokk addig ismétlődik, amíg a logikai feltétel igaz. A while sora minden feltétel-kiértékeléskor egy lépésnek számít.",
    },
];

pub const VARIABLE_DETAIL: &str = "változó";
pub const BOOL_DETAIL: &str = "logikai érték";
pub const PROBE_DETAIL: &str = "isThere kód";
pub const ISTHERE_SNIPPET: &str = "isThere ${w}";
pub const NOT_SNIPPET: &str = "not ${x}";

pub const PROBE_CODES: [(&str, &str); 3] = [
    ("0", "üres kamra"),
    ("1", "fal (vagy a térkép széle)"),
    ("2", "aranyrög"),
];

pub fn operator_doc(op: BinOp) -> &'static str {
    match op {
        BinOp::Add => "összeadás (egészek)",
        BinOp::Sub => "kivonás (egészek)",
        BinOp::Mul => "szorzás (egészek)",
        BinOp::Eq => "egyenlő (azonos típusú operandusok)",
        BinOp::Ne => "nem egyenlő (azonos típusú operandusok)",
        BinOp::Lt => "kisebb (egészek)",
        BinOp::Le => "kisebb vagy egyenlő (egészek)",
        BinOp::Gt => "nagyobb (egészek)",
        BinOp::Ge => "nagyobb vagy egyenlő (egészek)",
        BinOp::And => "logikai és",
        BinOp::Or => "logikai vagy",
    }
}

pub fn keyword_doc(keyword: &str) -> Option<&'static str> {
    if let Some(command) = COMMAND_DOCS.iter().find(|doc| doc.keyword == keyword) {
        return Some(command.documentation);
    }
    match keyword {
        "forward" => Some("A step forward utasítás része: step forward n."),
        "by" => Some("A turn by utasítás része: turn by n."),
        "here" => Some("A mine here utasítás része."),
        "to" => Some("A set utasítás része: set név to érték."),
        "isThere" => Some(
            "isThere w: igaz, ha a robot előtti mezőn a w-nek megfelelő objektum van (0 = üres kamra, 1 = fal, 2 = aranyrög). A térképen kívüli mező falnak számít.",
        ),
        "not" => Some("Logikai tagadás: not x igaz, ha x hamis."),
        "and" => Some("Logikai és: mindkét operandusnak logikainak kell lennie."),
        "or" => Some(
            "Logikai vagy: mindkét operandusnak logikainak kell lennie, és mindkettő kiértékelődik.",
        ),
        "true" => Some("Logikai igaz érték."),
        "false" => Some("Logikai hamis érték."),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::keywords::{COMMANDS, KEYWORDS};

    #[test]
    fn every_keyword_has_documentation() {
        for keyword in KEYWORDS {
            assert!(keyword_doc(keyword).is_some(), "{keyword}");
        }
    }

    #[test]
    fn every_command_has_a_completion() {
        for command in COMMANDS {
            assert!(
                COMMAND_DOCS.iter().any(|doc| doc.keyword == command),
                "{command}"
            );
        }
    }
}
