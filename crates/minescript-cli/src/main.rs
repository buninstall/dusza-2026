mod render;

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::error::{ContextKind, ContextValue, ErrorKind};
use clap::{ArgAction, CommandFactory, FromArgMatches, Parser, Subcommand};
use minescript_core::diagnostics::has_errors;
use minescript_core::{Dir, FormatOptions, Outcome, RunResult, Severity};

use crate::render::{Rendered, print_diagnostics, print_runtime_error};

const EXIT_OK: u8 = 0;
const EXIT_DIAGNOSTICS: u8 = 1;
const EXIT_USAGE: u8 = 2;

const HELP_TEMPLATE: &str = "{about-with-newline}\nHasználat: {usage}\n\n{all-args}{after-help}";
const OPTIONS_HEADING: &str = "Kapcsolók";
const ARGUMENTS_HEADING: &str = "Argumentumok";
const AFTER_HELP: &str = "Kilépési kódok:
  0  rendben
  1  a program vagy a térkép hibás (szintaktikai, futásidejű vagy térképhiba)
  2  hibás parancssor vagy olvashatatlan fájl

Példák:
  minescript check program.ms
  minescript run --map terkep.txt program.ms
  minescript run --map terkep.txt program.ms --trace
  minescript fmt --write program.ms
  minescript map-check terkep.txt";

#[derive(Parser)]
#[command(
    name = "minescript",
    version,
    about = "MineScript parancssori eszköz: a kincskereső robot programjainak ellenőrzése, formázása és futtatása",
    after_help = AFTER_HELP,
    disable_help_flag = true,
    disable_version_flag = true,
    disable_help_subcommand = true,
    subcommand_help_heading = "Parancsok",
    subcommand_value_name = "PARANCS"
)]
struct Cli {
    #[arg(short = 'V', long, action = ArgAction::Version, help = "A verziószám kiírása")]
    version: Option<bool>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    #[command(about = "Szintaktikai ellenőrzés")]
    Check {
        #[arg(value_name = "PROGRAM", help = "A programfájl útvonala")]
        file: PathBuf,
    },
    #[command(about = "Program formázása")]
    Fmt {
        #[arg(value_name = "PROGRAM", help = "A programfájl útvonala")]
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
    Lint {
        #[arg(value_name = "PROGRAM", help = "A programfájl útvonala")]
        file: PathBuf,
    },
    #[command(about = "Program futtatása egy térképen")]
    Run {
        #[arg(long, value_name = "TÉRKÉP", help = "A térképfájl útvonala")]
        map: PathBuf,
        #[arg(value_name = "PROGRAM", help = "A programfájl útvonala")]
        program: PathBuf,
        #[arg(long, help = "Az eredményt JSON-ként írja ki")]
        json: bool,
        #[arg(long, help = "Minden feldolgozott sort kiír")]
        trace: bool,
    },
    #[command(about = "A szintaxisfa JSON-ként")]
    Ast {
        #[arg(value_name = "PROGRAM", help = "A programfájl útvonala")]
        file: PathBuf,
    },
    #[command(name = "map-check", about = "Térképfájl ellenőrzése")]
    MapCheck {
        #[arg(value_name = "TÉRKÉP", help = "A térképfájl útvonala")]
        file: PathBuf,
    },
}

fn help_flag() -> clap::Arg {
    clap::Arg::new("help")
        .short('h')
        .long("help")
        .action(ArgAction::Help)
        .help("A súgó megjelenítése")
}

fn usage_of(name: &str) -> String {
    let operands = match name {
        "run" => "[KAPCSOLÓK] --map <TÉRKÉP> <PROGRAM>",
        "fmt" => "[KAPCSOLÓK] <PROGRAM>",
        "map-check" => "<TÉRKÉP>",
        "minescript" => "<PARANCS>",
        _ => "<PROGRAM>",
    };
    if name == "minescript" {
        format!("minescript {operands}")
    } else {
        format!("minescript {name} {operands}")
    }
}

fn localized(command: clap::Command) -> clap::Command {
    let usage = usage_of(command.get_name());
    command
        .override_usage(usage)
        .help_template(HELP_TEMPLATE)
        .disable_help_flag(true)
        .arg(help_flag())
        .mut_args(|arg| {
            let heading = if arg.is_positional() {
                ARGUMENTS_HEADING
            } else {
                OPTIONS_HEADING
            };
            arg.help_heading(heading)
        })
}

fn cli_command() -> clap::Command {
    localized(Cli::command()).mut_subcommands(localized)
}

fn context_text(error: &clap::Error, kind: ContextKind) -> String {
    match error.get(kind) {
        Some(ContextValue::String(text)) => text.clone(),
        Some(ContextValue::Strings(texts)) => texts.join(", "),
        _ => String::new(),
    }
}

fn usage_problem(error: &clap::Error) -> String {
    match error.kind() {
        ErrorKind::InvalidSubcommand => format!(
            "ismeretlen parancs: „{}”",
            context_text(error, ContextKind::InvalidSubcommand)
        ),
        ErrorKind::UnknownArgument => format!(
            "ismeretlen kapcsoló vagy fölösleges argumentum: „{}”",
            context_text(error, ContextKind::InvalidArg)
        ),
        ErrorKind::MissingRequiredArgument => format!(
            "hiányzó kötelező argumentum: {}",
            context_text(error, ContextKind::InvalidArg)
        ),
        ErrorKind::ArgumentConflict => format!(
            "ezek a kapcsolók nem használhatók együtt: {}, {}",
            context_text(error, ContextKind::InvalidArg),
            context_text(error, ContextKind::PriorArg)
        ),
        ErrorKind::MissingSubcommand => "hiányzik a parancs".to_owned(),
        _ => "hibás parancssori argumentumok".to_owned(),
    }
}

fn parse_cli() -> Result<Cli, ExitCode> {
    let matches = cli_command()
        .try_get_matches()
        .map_err(|error| match error.kind() {
            ErrorKind::DisplayHelp | ErrorKind::DisplayVersion => {
                print!("{error}");
                ExitCode::from(EXIT_OK)
            }
            ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand => {
                eprint!("{error}");
                ExitCode::from(EXIT_USAGE)
            }
            _ => {
                eprintln!("Hiba: {}.", usage_problem(&error));
                eprintln!("Súgó: minescript --help");
                ExitCode::from(EXIT_USAGE)
            }
        })?;
    Cli::from_arg_matches(&matches).map_err(|error| {
        eprintln!("Hiba: {}.", usage_problem(&error));
        ExitCode::from(EXIT_USAGE)
    })
}

fn direction(dir: Dir) -> &'static str {
    match dir {
        Dir::North => "észak",
        Dir::East => "kelet",
        Dir::South => "dél",
        Dir::West => "nyugat",
    }
}

struct CliError(String);

type CliResult = Result<u8, CliError>;

fn describe_io_error(error: &io::Error) -> String {
    match error.kind() {
        io::ErrorKind::NotFound => "a fájl nem létezik".to_owned(),
        io::ErrorKind::PermissionDenied => "nincs jogosultság a fájl olvasásához".to_owned(),
        io::ErrorKind::InvalidData => "a fájl nem érvényes UTF-8 szöveg".to_owned(),
        io::ErrorKind::IsADirectory => "ez egy mappa, nem fájl".to_owned(),
        _ => error.to_string(),
    }
}

fn read(path: &Path) -> Result<String, CliError> {
    fs::read_to_string(path).map_err(|error| {
        CliError(format!(
            "Nem olvasható a fájl ({}): {}",
            path.display(),
            describe_io_error(&error)
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
    let reportable = analysis
        .diagnostics
        .iter()
        .any(|diagnostic| matches!(diagnostic.severity, Severity::Error | Severity::Warning));
    Ok(status(reportable))
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
                "#{:>4}  {}. sor  ({}, {})  arany: {}  irány: {}",
                event.steps,
                event.line,
                event.robot.pos.row + 1,
                event.robot.pos.col + 1,
                event.gold,
                direction(event.robot.dir)
            );
        }
    }
    for line in &result.console {
        println!("{line}");
    }
    println!(
        "Arany: {}, feldolgozott sorok: {}, robot: {}. sor, {}. oszlop, {} felé néz",
        result.gold,
        result.steps,
        result.final_robot.pos.row + 1,
        result.final_robot.pos.col + 1,
        direction(result.final_robot.dir)
    );
}

fn run(map_path: &Path, program_path: &Path, json: bool, trace: bool) -> CliResult {
    let map_text = read(map_path)?;
    let source = read(program_path)?;
    let parsed_map = minescript_core::parse_map(&map_text);
    let Some(map) = parsed_map.map else {
        if json {
            println!("{}", to_json(&parsed_map)?);
        } else {
            print_diagnostics(&Rendered::new(map_path, &map_text), &parsed_map.diagnostics);
        }
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
                print_runtime_error(
                    &Rendered::new(program_path, &source),
                    code.as_str(),
                    *line,
                    message,
                );
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
    let cli = match parse_cli() {
        Ok(cli) => cli,
        Err(code) => return code,
    };
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
