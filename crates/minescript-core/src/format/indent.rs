use std::collections::BTreeMap;

use crate::source::split_lines;
use crate::syntax::ast::Program;
use crate::syntax::scanner::SPACE;

pub(super) fn reindent(clean: &str, program: &Program, indent_width: usize) -> String {
    let mut depths = BTreeMap::new();
    program.for_each_line(|node, depth| {
        depths.insert(node.line(), depth);
    });
    split_lines(clean).into_iter().zip(1u32..).fold(
        String::with_capacity(clean.len()),
        |mut text, (line, number)| {
            let depth = depths.get(&number).copied().unwrap_or_default();
            text.extend(std::iter::repeat_n(SPACE, depth * indent_width));
            text.push_str(line.trim_start_matches(SPACE));
            text.push('\n');
            text
        },
    )
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
