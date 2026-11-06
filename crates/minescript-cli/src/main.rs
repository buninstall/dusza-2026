mod render;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use minescript_core::diagnostics::has_errors;
use minescript_core::{FormatOptions, Outcome, RunResult};

use crate::render::{Rendered, print_diagnostics};

const EXIT_OK: u8 = 0;
const EXIT_DIAGNOSTICS: u8 = 1;
const EXIT_USAGE: u8 = 2;

#[derive(Parser)]
#[command(name = "minescript", version, about = "MineScript parancssori eszköz")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    #[command(about = "Szintaktikai ellenőrzés")]
    Check { file: PathBuf },
    #[command(about = "Program formázása")]
    Fmt {
        file: PathBuf,
        #[arg(
            long,
            conflicts_with = "check",
            help = "A formázott szöveget visszaírja a fájlba"
        )]
        write: bool,
        #[arg(long, help = "Csak ellenőrzi, hogy a fájl formázott-e")]
        check: bool,
    },
    #[command(about = "Szintaktikai ellenőrzés és figyelmeztetések")]
    Lint { file: PathBuf },
    #[command(about = "Program futtatása egy térképen")]
    Run {
        #[arg(long, help = "A térképfájl útvonala")]
        map: PathBuf,
        program: PathBuf,
        #[arg(long, help = "Az eredményt JSON-ként írja ki")]
        json: bool,
        #[arg(long, help = "Minden feldolgozott sort kiír")]
        trace: bool,
    },
    #[command(about = "A szintaxisfa JSON-ként")]
    Ast { file: PathBuf },
    #[command(name = "map-check", about = "Térképfájl ellenőrzése")]
    MapCheck { file: PathBuf },
}

struct CliError(String);

type CliResult = Result<u8, CliError>;

fn read(path: &Path) -> Result<String, CliError> {
    fs::read_to_string(path).map_err(|error| {
        CliError(format!(
            "Nem olvasható a fájl ({}): {error}",
            path.display()
        ))
    })
}

fn status(failed: bool) -> u8 {
    if failed { EXIT_DIAGNOSTICS } else { EXIT_OK }
}

fn check(file: &Path) -> CliResult {
    let source = read(file)?;
    let parsed = minescript_core::parse(&source);
    print_diagnostics(&Rendered::new(file, &source), &parsed.diagnostics);
    if !has_errors(&parsed.diagnostics) {
        println!("Szintaktikailag helyes program.");
    }
    Ok(status(has_errors(&parsed.diagnostics)))
}

fn lint(file: &Path) -> CliResult {
    let source = read(file)?;
    let analysis = minescript_core::analyze(&source);
    print_diagnostics(&Rendered::new(file, &source), &analysis.diagnostics);
    Ok(status(!analysis.diagnostics.is_empty()))
}

fn fmt(file: &Path, write: bool, check_only: bool) -> CliResult {
    let source = read(file)?;
    let result = minescript_core::format(&source, &FormatOptions::default());
    if has_errors(&result.diagnostics) {
        print_diagnostics(&Rendered::new(file, &source), &result.diagnostics);
        return Ok(EXIT_DIAGNOSTICS);
    }
    if check_only {
        if result.changed {
            println!("A fájl nincs formázva: {}", file.display());
        }
        return Ok(status(result.changed));
    }
    if write {
        fs::write(file, &result.text).map_err(|error| {
            CliError(format!("Nem írható a fájl ({}): {error}", file.display()))
        })?;
        return Ok(EXIT_OK);
    }
    print!("{}", result.text);
    Ok(EXIT_OK)
}

fn to_json<T: serde::Serialize>(value: &T) -> Result<String, CliError> {
    serde_json::to_string_pretty(value)
        .map_err(|error| CliError(format!("A JSON-kimenet nem készíthető el: {error}")))
}

fn print_run_summary(result: &RunResult, trace: bool) {
    if trace {
        for event in &result.events {
            println!(
                "#{:>4}  {}. sor  ({}, {})  arany: {}",
                event.steps,
                event.line,
                event.robot.pos.row + 1,
                event.robot.pos.col + 1,
                event.gold
            );
        }
    }
    for line in &result.console {
        println!("{line}");
    }
    println!(
        "Arany: {}, feldolgozott sorok: {}, robot: {}. sor, {}. oszlop",
        result.gold,
        result.steps,
        result.final_robot.pos.row + 1,
        result.final_robot.pos.col + 1
    );
}

fn run(map_path: &Path, program_path: &Path, json: bool, trace: bool) -> CliResult {
    let map_text = read(map_path)?;
    let source = read(program_path)?;
    let parsed_map = minescript_core::parse_map(&map_text);
    let Some(map) = parsed_map.map else {
        print_diagnostics(&Rendered::new(map_path, &map_text), &parsed_map.diagnostics);
        return Ok(EXIT_DIAGNOSTICS);
    };
    let result = minescript_core::run(&source, &map);
    if json {
        println!("{}", to_json(&result)?);
    }
    match &result.outcome {
        Outcome::Ok => {
            if !json {
                print_run_summary(&result, trace);
            }
            Ok(EXIT_OK)
        }
        Outcome::RuntimeError {
            code,
            line,
            message,
        } => {
            if !json {
                print_run_summary(&result, trace);
                eprintln!(
                    "Futásidejű hiba: {} a(z) {line}. sorban: {message}",
                    code.as_str()
                );
            }
            Ok(EXIT_DIAGNOSTICS)
        }
        Outcome::SyntaxError { diagnostics } => {
            if !json {
                print_diagnostics(&Rendered::new(program_path, &source), diagnostics);
            }
            Ok(EXIT_DIAGNOSTICS)
        }
    }
}

fn ast(file: &Path) -> CliResult {
    let source = read(file)?;
    let parsed = minescript_core::parse(&source);
    println!("{}", to_json(&parsed)?);
    Ok(status(has_errors(&parsed.diagnostics)))
}

fn map_check(file: &Path) -> CliResult {
    let text = read(file)?;
    let parsed = minescript_core::parse_map(&text);
    print_diagnostics(&Rendered::new(file, &text), &parsed.diagnostics);
    let Some(map) = parsed.map else {
        return Ok(EXIT_DIAGNOSTICS);
    };
    let info = minescript_core::map_info(&map);
    println!(
        "Érvényes térkép: {}×{}, arany: {} (elérhető: {})",
        map.rows, map.cols, info.gold_total, info.reachable_gold
    );
    Ok(EXIT_OK)
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let result = match &cli.command {
        Command::Check { file } => check(file),
        Command::Fmt { file, write, check } => fmt(file, *write, *check),
        Command::Lint { file } => lint(file),
        Command::Run {
            map,
            program,
            json,
            trace,
        } => run(map, program, *json, *trace),
        Command::Ast { file } => ast(file),
        Command::MapCheck { file } => map_check(file),
    };
    match result {
        Ok(code) => ExitCode::from(code),
        Err(CliError(message)) => {
            eprintln!("Hiba: {message}");
            ExitCode::from(EXIT_USAGE)
        }
    }
}
