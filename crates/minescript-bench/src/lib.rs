use std::fmt::Write as _;

mod golden;

pub use golden::golden;

pub struct Case {
    pub name: &'static str,
    pub source: String,
    pub map: String,
}

macro_rules! recipe {
    ($program:literal, $map:literal) => {
        Case {
            name: $program,
            source: include_str!(concat!("../../../docs/receptek/", $program, ".ms")).to_owned(),
            map: include_str!(concat!("../../../docs/receptek/palyak/", $map, ".txt")).to_owned(),
        }
    };
}

pub fn recipes() -> Vec<Case> {
    vec![
        recipe!("01-egyenes-folyoso", "01-egyenes-folyoso"),
        recipe!("01-egyenes-folyoso-ciklussal", "01-egyenes-folyoso"),
        recipe!("02-az-elso-kanyar", "02-az-elso-kanyar"),
        recipe!("03-kis-labirintus", "03-kis-labirintus"),
        recipe!("04-zsakutcak", "04-zsakutcak"),
        recipe!("05-kigyo", "05-kigyo"),
        recipe!("06-elerhetetlen-kincs", "06-elerhetetlen-kincs"),
        recipe!("07-aranymezo", "07-aranymezo"),
        recipe!("08-a-nagy-banya", "08-a-nagy-banya"),
    ]
}

pub fn big_mine() -> String {
    include_str!("../../../docs/receptek/palyak/08-a-nagy-banya.txt").to_owned()
}

pub fn open_field(gold: bool) -> String {
    let fill = if gold { '@' } else { '.' };
    let mut map = String::from("15 15\n");
    for row in 0..15 {
        for col in 0..15 {
            map.push(if row == 7 && col == 7 { '>' } else { fill });
        }
        map.push('\n');
    }
    map
}

pub fn runtime_cases() -> Vec<Case> {
    vec![
        Case {
            name: "limit-arith",
            source: "set i to 0\nset s to 0\nset odd to false\nwhile true\n    set i to i + 1\n    set s to s + i\n    set odd to not odd\n    if odd\n        print s\n    else\n        print odd\n"
                .to_owned(),
            map: open_field(false),
        },
        Case {
            name: "limit-walk",
            source: "set n to 0\nwhile true\n    set wall to isThere 1\n    if wall\n        turn by 1\n        set n to n + 1\n    else\n        step forward 1\n"
                .to_owned(),
            map: big_mine(),
        },
        Case {
            name: "limit-long-steps",
            source: "while true\n    step forward 7\n    turn by 2\n"
                .to_owned(),
            map: open_field(false),
        },
        Case {
            name: "harvest",
            source: "set count to 0\nwhile true\n    set gold to isThere 2\n    if gold\n        step forward 1\n        mine here\n        set count to count + 1\n    else\n        turn by 1\n    print count\n"
                .to_owned(),
            map: open_field(true),
        },
    ]
}

const STATEMENTS: [&str; 12] = [
    "step forward 3",
    "turn by 1",
    "mine here",
    "print {v}",
    "set {v} to {w} + 1",
    "set {v} to isThere 2",
    "set {v} to not {w}",
    "set {v} to {w} * 2",
    "set {v} to {w} < 10",
    "set {v} to {w} and true",
    "print true",
    "set {v} to 0",
];

fn variable(seed: usize) -> String {
    format!("v{}", seed % 37)
}

fn fill(template: &str, seed: usize) -> String {
    template
        .replace("{v}", &variable(seed))
        .replace("{w}", &variable(seed.wrapping_mul(7).wrapping_add(3)))
}

pub fn large_valid(lines: usize) -> String {
    let mut source = String::new();
    let mut depth = 0usize;
    let mut seed = 0usize;
    let mut emitted = 0usize;
    while emitted < lines {
        seed = seed.wrapping_mul(1_103_515_245).wrapping_add(12_345) % 2_147_483_648;
        let choice = (seed >> 8) % 16;
        let indent = "    ".repeat(depth);
        match choice {
            0 | 1 if depth < 6 => {
                let header = if choice == 0 { "if" } else { "while" };
                let _ = writeln!(source, "{indent}{header} {}", variable(seed));
                let _ = writeln!(source, "{indent}    {}", fill(STATEMENTS[seed % 12], seed));
                emitted += 2;
                depth += 1;
            }
            2 if depth > 0 => depth -= 1,
            _ => {
                let template = STATEMENTS
                    .get((seed >> 4) % 12)
                    .copied()
                    .unwrap_or("mine here");
                let _ = writeln!(source, "{indent}{}", fill(template, seed));
                emitted += 1;
            }
        }
    }
    source
}

const BROKEN: [&str; 12] = [
    "step forward  3",
    "Step forward 1",
    "set x to 1+2",
    "\tprint 1",
    "turn by -1",
    "set árany to 1",
    "print 1   ",
    "",
    "mine",
    "set y to 5 6",
    "set If to 1",
    "else",
];

pub fn large_broken(lines: usize) -> String {
    let mut source = String::new();
    for line in 0..lines {
        if line % 3 == 0 {
            let _ = writeln!(
                source,
                "{}",
                BROKEN.get(line / 3 % 12).copied().unwrap_or("")
            );
        } else {
            let _ = writeln!(
                source,
                "{}",
                fill(STATEMENTS.get(line % 12).copied().unwrap_or(""), line)
            );
        }
    }
    source
}

pub fn messy(lines: usize) -> String {
    let mut messy = String::new();
    for (number, line) in large_valid(lines).lines().enumerate() {
        let content = line.trim_start();
        let depth = (line.len() - content.len()) / 4;
        let indent = if number % 2 == 0 {
            "    ".repeat(depth)
        } else {
            "\t".repeat(depth)
        };
        let spaced = if number % 5 == 0 {
            content.replace(' ', "   ")
        } else {
            content.to_owned()
        };
        let _ = write!(messy, "{indent}{spaced}  \n\n");
    }
    messy
}

pub fn deep(depth: usize) -> String {
    let mut source = String::new();
    for level in 0..depth {
        let _ = writeln!(source, "{}while x", " ".repeat(level));
    }
    let _ = writeln!(source, "{}print 1", " ".repeat(depth));
    let mut prefixed = String::from("set x to false\n");
    prefixed.push_str(&source);
    prefixed
}

pub fn unicode(lines: usize) -> String {
    let mut source = String::new();
    for line in 0..lines {
        let _ = writeln!(source, "set ár{line} to {}", line % 100);
        let _ = writeln!(source, "print 😀{line}");
    }
    source
}
