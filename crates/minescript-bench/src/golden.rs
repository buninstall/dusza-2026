use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use minescript_core::{
    FormatOptions, analyze, complete, format, hover, map_info, parse, parse_map, run_with_map_text,
};

use crate::{deep, large_broken, large_valid, messy, open_field, recipes, runtime_cases, unicode};

const FRAGMENTS: [&str; 44] = [
    "step", "forward", "turn", "by", "mine", "here", "print", "set", "to", "if", "else", "while",
    "isThere", "not", "and", "or", "true", "false", "Step", "TRUE", "x", "count", "0", "1", "2",
    "007", "100", "101", "-5", "1+2", "+", "<=", "a_b", "árany", "😀", "\u{feff}", "#", "(", " ",
    "  ", "\n", "\n    ", "\t", "\r",
];

struct Lcg(u64);

impl Lcg {
    fn next(&mut self, bound: usize) -> usize {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        usize::try_from(self.0 >> 33).unwrap_or(0) % bound.max(1)
    }
}

fn mutate(source: &str, rng: &mut Lcg) -> String {
    let mut text: Vec<char> = source.chars().collect();
    for _ in 0..=rng.next(4) {
        let at = rng.next(text.len() + 1);
        match rng.next(3) {
            0 if at < text.len() => {
                text.remove(at);
            }
            1 => {
                let fragment = FRAGMENTS
                    .get(rng.next(FRAGMENTS.len()))
                    .copied()
                    .unwrap_or("");
                for (offset, ch) in fragment.chars().enumerate() {
                    text.insert(at + offset, ch);
                }
            }
            _ => {
                let fragment = FRAGMENTS
                    .get(rng.next(FRAGMENTS.len()))
                    .copied()
                    .unwrap_or("");
                let mut piece: String = text.drain(at..).collect();
                piece.insert_str(0, fragment);
                text.extend(piece.chars());
            }
        }
    }
    text.into_iter().collect()
}

fn programs_in(dir: &Path, found: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut entries: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .collect();
    entries.sort();
    for path in entries {
        if path.is_dir() {
            programs_in(&path, found);
        } else if path.extension().is_some_and(|ext| ext == "ms") {
            found.push(path);
        }
    }
}

fn json<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|error| format!("\"{error}\""))
}

fn record(out: &mut String, source: &str, maps: &[String]) {
    let _ = writeln!(out, "{}", json(&parse(source)));
    let _ = writeln!(out, "{}", json(&analyze(source)));
    for width in [1, 4, 0, 17] {
        let _ = writeln!(
            out,
            "{}",
            json(&format(
                source,
                &FormatOptions {
                    indent_width: width
                }
            ))
        );
    }
    let length = u32::try_from(source.encode_utf16().count()).unwrap_or(0);
    for offset in [
        0,
        1,
        length / 3,
        length / 2,
        length.saturating_sub(1),
        length,
        length + 5,
    ] {
        let _ = writeln!(out, "{}", json(&complete(source, offset)));
        let _ = writeln!(out, "{}", json(&hover(source, offset)));
    }
    for map in maps {
        let _ = writeln!(out, "{}", json(&run_with_map_text(source, map)));
    }
}

pub fn golden(repo: &Path) -> String {
    let mut sources: Vec<String> = Vec::new();
    let mut maps: Vec<String> = vec![open_field(false), open_field(true)];
    for case in recipes().into_iter().chain(runtime_cases()) {
        sources.push(case.source);
        maps.push(case.map);
    }
    sources.extend([
        large_valid(400),
        large_broken(400),
        messy(300),
        deep(150),
        unicode(100),
    ]);
    let mut paths = Vec::new();
    for dir in [
        "conformance",
        "docs/receptek",
        "crates/minescript-cli/tests/fixtures",
    ] {
        programs_in(&repo.join(dir), &mut paths);
    }
    for path in &paths {
        if let Ok(text) = fs::read_to_string(path) {
            sources.push(text);
        }
        if let Ok(text) = fs::read_to_string(path.with_file_name("map.txt")) {
            maps.push(text);
        }
    }
    let mut map_files = Vec::new();
    for dir in [
        "conformance/maps",
        "docs/receptek/hibas-terkepek",
        "docs/receptek/palyak",
    ] {
        let mut stack = vec![repo.join(dir)];
        while let Some(next) = stack.pop() {
            let Ok(entries) = fs::read_dir(&next) else {
                continue;
            };
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                } else if path.extension().is_some_and(|ext| ext == "txt") {
                    map_files.push(path);
                }
            }
        }
    }
    map_files.sort();
    for path in map_files {
        if let Ok(text) = fs::read_to_string(path) {
            maps.push(text);
        }
    }
    maps.dedup();
    let mut rng = Lcg(2026);
    let originals = sources.clone();
    for round in 0..6000 {
        let base = originals
            .get(round % originals.len())
            .map_or("", String::as_str);
        let short: String = if base.len() > 600 {
            base.lines().take(25).collect::<Vec<_>>().join("\n")
        } else {
            base.to_owned()
        };
        sources.push(mutate(&short, &mut rng));
    }
    let valid_maps: Vec<String> = maps
        .iter()
        .filter(|map| parse_map(map).map.is_some())
        .take(12)
        .cloned()
        .collect();
    let mut out = String::new();
    for map in &maps {
        let parsed = parse_map(map);
        let _ = writeln!(out, "{}", json(&parsed));
        if let Some(map) = parsed.map {
            let _ = writeln!(out, "{}", json(&map_info(&map)));
        }
    }
    for (position, source) in sources.iter().enumerate() {
        let chosen: Vec<String> = if position < originals.len() {
            valid_maps.clone()
        } else {
            valid_maps
                .get(position % valid_maps.len().max(1))
                .cloned()
                .into_iter()
                .collect()
        };
        record(&mut out, source, &chosen);
    }
    out
}
