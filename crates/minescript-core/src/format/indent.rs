use crate::source::lines;
use crate::syntax::ast::Program;
use crate::syntax::scanner::SPACE;

const INDENT_CHUNK: &str = "                                                                ";

pub(super) fn reindent(clean: &str, program: &Program, indent_width: usize) -> String {
    let mut depths: Vec<usize> = Vec::new();
    program.for_each_line(|node, depth| {
        let Ok(line) = usize::try_from(node.line()) else {
            return;
        };
        if depths.len() <= line {
            depths.resize(line + 1, 0);
        }
        if let Some(slot) = depths.get_mut(line) {
            *slot = depth;
        }
    });
    let mut text = String::with_capacity(clean.len() + clean.len() / 4);
    for (number, line) in (1usize..).zip(lines(clean)) {
        let depth = depths.get(number).copied().unwrap_or_default();
        let mut remaining = depth * indent_width;
        while remaining > 0 {
            let chunk = remaining.min(INDENT_CHUNK.len());
            text.push_str(INDENT_CHUNK.get(..chunk).unwrap_or_default());
            remaining -= chunk;
        }
        text.push_str(line.trim_start_matches(SPACE));
        text.push('\n');
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::parse;

    #[test]
    fn lines_get_depth_times_width_spaces() {
        let clean = "while a\n  if b\n     mine here\n  else\n   print 1\n";
        let program = parse(clean).program.unwrap();
        assert_eq!(
            reindent(clean, &program, 3),
            "while a\n   if b\n      mine here\n   else\n      print 1\n"
        );
    }
}
