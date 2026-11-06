use std::hint::black_box;
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Instant;
use std::{env, fs};

use minescript_bench::{
    deep, golden, large_broken, large_valid, messy, recipes, runtime_cases, unicode,
};
use minescript_core::{
    FormatOptions, analyze, complete, format, hover, lint, parse, run_with_map_text,
};

fn main() -> ExitCode {
    let args: Vec<PathBuf> = env::args_os().skip(1).map(PathBuf::from).collect();
    if let [command, repo, out] = args.as_slice()
        && command.as_os_str() == "golden"
    {
        return match fs::write(out, golden(repo)) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("{}: {error}", out.display());
                ExitCode::FAILURE
            }
        };
    }
    if let [command, operation, source, rest @ ..] = args.as_slice()
        && command.as_os_str() == "profile"
    {
        let map = rest.first().and_then(|path| fs::read_to_string(path).ok());
        let iterations = rest
            .get(1)
            .and_then(|count| count.to_str()?.parse().ok())
            .unwrap_or(2_000);
        return match fs::read_to_string(source) {
            Ok(text) => profile(
                &operation.to_string_lossy(),
                &text,
                map.as_deref(),
                iterations,
            ),
            Err(error) => {
                eprintln!("{}: {error}", source.display());
                ExitCode::FAILURE
            }
        };
    }
    let Some(dir) = args.first() else {
        eprintln!(
            "Használat: minescript-bench <kimeneti mappa> | golden <repó> <kimenet> | profile <művelet> <forrás> [térkép] [ismétlés]"
        );
        return ExitCode::FAILURE;
    };
    let mut files: Vec<(String, String)> = Vec::new();
    for case in recipes().into_iter().chain(runtime_cases()) {
        files.push((format!("run/{}.ms", case.name), case.source));
        files.push((format!("run/{}.txt", case.name), case.map));
    }
    for (name, source) in [
        ("spec-loop", recipes().swap_remove(1).source),
        ("valid-2k", large_valid(2_000)),
        ("valid-20k", large_valid(20_000)),
        ("broken-2k", large_broken(2_000)),
        ("messy-2k", messy(2_000)),
        ("deep-1k", deep(1_000)),
        ("unicode-2k", unicode(1_000)),
    ] {
        files.push((format!("source/{name}.ms"), source));
    }
    for (path, contents) in files {
        let target = dir.join(path);
        let written = target
            .parent()
            .map_or(Ok(()), fs::create_dir_all)
            .and_then(|()| fs::write(&target, contents));
        if let Err(error) = written {
            eprintln!("{}: {error}", target.display());
            return ExitCode::FAILURE;
        }
    }
    ExitCode::SUCCESS
}

fn profile(operation: &str, source: &str, map: Option<&str>, iterations: usize) -> ExitCode {
    let options = FormatOptions::default();
    let map_text = map.unwrap_or("1 1\n>\n");
    let started = Instant::now();
    let mut checksum = 0usize;
    for _ in 0..iterations {
        checksum = checksum.wrapping_add(match operation {
            "parse" => parse(black_box(source)).diagnostics.len(),
            "lint" => parse(source)
                .program
                .map_or(0, |program| lint(&program, source).len()),
            "analyze" => analyze(black_box(source)).tokens.len(),
            "format" => format(black_box(source), &options).text.len(),
            "complete" => complete(source, u32::try_from(source.len() / 2).unwrap_or(0)).len(),
            "hover" => {
                usize::from(hover(source, u32::try_from(source.len() / 2).unwrap_or(0)).is_some())
            }
            "run" => run_with_map_text(black_box(source), map_text)
                .map_or(0, |result| result.events.len()),
            "run-json" => run_with_map_text(source, map_text)
                .ok()
                .and_then(|result| serde_json::to_string(&result).ok())
                .map_or(0, |json| json.len()),
            _ => {
                eprintln!("Ismeretlen művelet: {operation}");
                return ExitCode::FAILURE;
            }
        });
    }
    let per_iteration = started.elapsed() / u32::try_from(iterations.max(1)).unwrap_or(1);
    println!("{operation}: {per_iteration:?} / ismétlés (ellenőrzőösszeg {checksum})");
    ExitCode::SUCCESS
}
