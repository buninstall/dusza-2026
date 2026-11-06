use std::path::PathBuf;
use std::process::ExitCode;
use std::{env, fs};

use minescript_bench::{
    deep, golden, large_broken, large_valid, messy, recipes, runtime_cases, unicode,
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
    let Some(dir) = args.first() else {
        eprintln!("Használat: minescript-bench <kimeneti mappa> | golden <repó> <kimenet>");
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
