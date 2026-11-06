use crate::names::NameMap;
use crate::syntax::ast::{LineNode, Program, Simple, StmtKind};

const WORD_BITS: usize = 64;

pub(super) struct Names<'p> {
    ids: NameMap<&'p str, usize>,
    spellings: Vec<&'p str>,
}

impl<'p> Names<'p> {
    pub fn of(program: &'p Program) -> Self {
        let mut names = Self {
            ids: NameMap::default(),
            spellings: Vec::new(),
        };
        program.for_each_line(|node, _| {
            let LineNode::Statement(stmt) = node else {
                return;
            };
            if let StmtKind::Set { name, .. } = &stmt.kind {
                names.intern(&name.name);
            }
            for operand in stmt.kind.operands() {
                if let Simple::Ident { name, .. } = operand {
                    names.intern(name);
                }
            }
        });
        names
    }

    fn intern(&mut self, name: &'p str) -> usize {
        let next = self.spellings.len();
        let id = *self.ids.entry(name).or_insert(next);
        if id == next {
            self.spellings.push(name);
        }
        id
    }

    pub fn id(&self, name: &str) -> Option<usize> {
        self.ids.get(name).copied()
    }

    pub fn len(&self) -> usize {
        self.spellings.len()
    }

    pub fn spellings(&self) -> &[&'p str] {
        &self.spellings
    }

    pub fn set(&self) -> NameSet {
        NameSet(vec![0; self.len().div_ceil(WORD_BITS)])
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct NameSet(Vec<u64>);

impl NameSet {
    fn slot(id: usize) -> (usize, u64) {
        (id / WORD_BITS, 1 << (id % WORD_BITS))
    }

    pub fn insert(&mut self, id: usize) -> bool {
        let (word, bit) = Self::slot(id);
        match self.0.get_mut(word) {
            Some(bits) if *bits & bit == 0 => {
                *bits |= bit;
                true
            }
            _ => false,
        }
    }

    pub fn contains(&self, id: usize) -> bool {
        let (word, bit) = Self::slot(id);
        self.0.get(word).is_some_and(|bits| bits & bit != 0)
    }

    pub fn intersect(&mut self, other: &Self) {
        for (bits, others) in self.0.iter_mut().zip(&other.0) {
            *bits &= others;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::parse;

    #[test]
    fn names_get_dense_ids_in_program_order() {
        let program = parse("set b to a\nprint b\nset c to b + a\n")
            .program
            .unwrap();
        let names = Names::of(&program);
        assert_eq!(names.spellings(), ["b", "a", "c"]);
        assert_eq!(names.id("a"), Some(1));
        assert_eq!(names.id("zz"), None);
    }

    #[test]
    fn name_sets_insert_once_and_intersect() {
        let mut left = NameSet(vec![0; 2]);
        let mut right = left.clone();
        assert!(left.insert(3) && left.insert(70) && !left.insert(3));
        assert!(right.insert(70));
        left.intersect(&right);
        assert!(!left.contains(3) && left.contains(70) && !left.contains(500));
        assert!(!left.insert(500));
    }
}
