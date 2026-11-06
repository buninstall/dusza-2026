use std::collections::{BTreeMap, BTreeSet};

use super::error::{RuntimeError, RuntimeErrorCode};
use super::eval;
use super::robot::RobotState;
use super::trace::{Assignment, Event, MAX_STEPS, Outcome, RunResult};
use super::value::Value;
use crate::map::{Cell, Map, Pos};
use crate::syntax::ast::{BinOp, ElseBranch, Expr, Ident, Program, Simple, Stmt, StmtKind};

type Evaluated<T> = Result<T, RuntimeErrorCode>;

pub(super) fn execute(program: &Program, map: &Map) -> RunResult {
    let mut machine = Machine::new(map);
    let outcome = match machine.run(&program.body) {
        Ok(()) => Outcome::Ok,
        Err(error) => Outcome::from(error),
    };
    machine.finish(outcome)
}

enum Next<'p> {
    Continue,
    Enter(&'p [Stmt]),
    Repeat(&'p [Stmt]),
}

#[derive(Default)]
struct LineEffects {
    path: Vec<Pos>,
    discovered: Vec<Pos>,
    mined: Option<Pos>,
    print: Option<String>,
    assigned: Option<Assignment>,
}

struct Discovery {
    seen: BTreeSet<Pos>,
    order: Vec<Pos>,
}

impl Discovery {
    fn starting_at(start: Pos) -> Self {
        Self {
            seen: BTreeSet::from([start]),
            order: vec![start],
        }
    }

    fn reveal(&mut self, cell: Pos) -> bool {
        let is_new = self.seen.insert(cell);
        if is_new {
            self.order.push(cell);
        }
        is_new
    }
}

struct Machine<'p> {
    world: Map,
    robot: RobotState,
    variables: BTreeMap<&'p str, Value>,
    discovery: Discovery,
    gold: u32,
    steps: u32,
    console: Vec<String>,
    events: Vec<Event>,
}

impl<'p> Machine<'p> {
    fn new(map: &Map) -> Self {
        let robot = RobotState::start_of(map);
        Self {
            world: map.clone(),
            robot,
            variables: BTreeMap::new(),
            discovery: Discovery::starting_at(robot.pos),
            gold: 0,
            steps: 0,
            console: Vec::new(),
            events: Vec::new(),
        }
    }

    fn finish(self, outcome: Outcome) -> RunResult {
        RunResult {
            outcome,
            events: self.events,
            gold: self.gold,
            steps: self.steps,
            console: self.console,
            final_robot: self.robot,
            discovered: self.discovery.order,
        }
    }

    fn run(&mut self, body: &'p [Stmt]) -> Result<(), RuntimeError> {
        let mut pending: Vec<&'p [Stmt]> = vec![body];
        while let Some(remaining) = pending.last_mut() {
            let current: &'p [Stmt] = remaining;
            let Some((stmt, rest)) = current.split_first() else {
                pending.pop();
                continue;
            };
            match self.statement(stmt)? {
                Next::Continue => *remaining = rest,
                Next::Enter(block) => {
                    *remaining = rest;
                    pending.push(block);
                }
                Next::Repeat(block) => pending.push(block),
            }
        }
        Ok(())
    }

    fn statement(&mut self, stmt: &'p Stmt) -> Result<Next<'p>, RuntimeError> {
        let line = stmt.line;
        match &stmt.kind {
            StmtKind::Step { count } => {
                self.simple_line(line, |machine, effects| machine.step(count, effects))
            }
            StmtKind::Turn { quarters } => {
                self.simple_line(line, |machine, _| machine.turn(quarters))
            }
            StmtKind::Mine => self.simple_line(line, Self::mine),
            StmtKind::Print { value } => {
                self.simple_line(line, |machine, effects| machine.print(value, effects))
            }
            StmtKind::Set { name, value } => self.simple_line(line, |machine, effects| {
                machine.assign(name, value, effects)
            }),
            StmtKind::If {
                cond,
                then_body,
                else_branch,
            } => self.branch(line, cond, then_body, else_branch.as_ref()),
            StmtKind::While { cond, body } => self.repeat(line, cond, body),
        }
    }

    fn simple_line(
        &mut self,
        line: u32,
        action: impl FnOnce(&mut Self, &mut LineEffects) -> Evaluated<()>,
    ) -> Result<Next<'p>, RuntimeError> {
        self.process(line, action).map(|()| Next::Continue)
    }

    fn branch(
        &mut self,
        line: u32,
        cond: &Simple,
        then_body: &'p [Stmt],
        else_branch: Option<&'p ElseBranch>,
    ) -> Result<Next<'p>, RuntimeError> {
        if self.process(line, |machine, _| machine.condition(cond))? {
            return Ok(Next::Enter(then_body));
        }
        match else_branch {
            Some(branch) => {
                self.process(branch.line, |_, _| Ok(()))?;
                Ok(Next::Enter(&branch.body))
            }
            None => Ok(Next::Continue),
        }
    }

    fn repeat(
        &mut self,
        line: u32,
        cond: &Simple,
        body: &'p [Stmt],
    ) -> Result<Next<'p>, RuntimeError> {
        let holds = self.process(line, |machine, _| machine.condition(cond))?;
        Ok(if holds {
            Next::Repeat(body)
        } else {
            Next::Continue
        })
    }

    fn process<T>(
        &mut self,
        line: u32,
        action: impl FnOnce(&mut Self, &mut LineEffects) -> Evaluated<T>,
    ) -> Result<T, RuntimeError> {
        if self.steps >= MAX_STEPS {
            return Err(RuntimeError::new(
                RuntimeErrorCode::InstructionCountLimitExceeded,
                line,
            ));
        }
        self.steps += 1;
        let mut effects = LineEffects::default();
        let result = action(self, &mut effects);
        self.record(line, effects);
        result.map_err(|code| RuntimeError::new(code, line))
    }

    fn record(&mut self, line: u32, effects: LineEffects) {
        self.events.push(Event {
            index: self.steps.saturating_sub(1),
            line,
            robot: self.robot,
            path: effects.path,
            discovered: effects.discovered,
            mined: effects.mined,
            gold: self.gold,
            steps: self.steps,
            print: effects.print,
            assigned: effects.assigned,
        });
    }

    fn reveal(&mut self, cell: Pos, effects: &mut LineEffects) {
        if self.discovery.reveal(cell) {
            effects.discovered.push(cell);
        }
    }

    fn read(&self, simple: &Simple) -> Evaluated<Value> {
        match simple {
            Simple::Int { value, .. } => Ok(Value::Int(*value)),
            Simple::Bool { value, .. } => Ok(Value::Bool(*value)),
            Simple::Ident { name, .. } => self
                .variables
                .get(name.as_str())
                .copied()
                .ok_or(RuntimeErrorCode::EUninitialized),
        }
    }

    fn count_argument(&self, simple: &Simple) -> Evaluated<u64> {
        self.read(simple)?
            .as_int()
            .and_then(|count| u64::try_from(count).ok())
            .ok_or(RuntimeErrorCode::EBadArg)
    }

    fn condition(&self, cond: &Simple) -> Evaluated<bool> {
        self.read(cond)?
            .as_bool()
            .ok_or(RuntimeErrorCode::ENonBoolCondition)
    }

    fn step(&mut self, count: &Simple, effects: &mut LineEffects) -> Evaluated<()> {
        let distance = self.count_argument(count)?;
        let walk = self.robot.step_forward(&self.world, distance);
        self.robot = walk.state;
        for &cell in &walk.path {
            self.reveal(cell, effects);
        }
        effects.path = walk.path;
        if walk.blocked {
            Err(RuntimeErrorCode::EBedrockHit)
        } else {
            Ok(())
        }
    }

    fn turn(&mut self, quarters: &Simple) -> Evaluated<()> {
        let quarters = self.count_argument(quarters)?;
        self.robot = self.robot.turned_left(quarters);
        Ok(())
    }

    fn mine(&mut self, effects: &mut LineEffects) -> Evaluated<()> {
        let here = self.robot.pos;
        if self.world.get(here) != Some(Cell::Gold) {
            return Err(RuntimeErrorCode::ENoGold);
        }
        self.world.set(here, Cell::Empty);
        self.gold = self.gold.saturating_add(1);
        effects.mined = Some(here);
        Ok(())
    }

    fn print(&mut self, value: &Simple, effects: &mut LineEffects) -> Evaluated<()> {
        let text = self.read(value)?.to_string();
        self.console.push(text.clone());
        effects.print = Some(text);
        Ok(())
    }

    fn assign(&mut self, name: &'p Ident, expr: &Expr, effects: &mut LineEffects) -> Evaluated<()> {
        let value = self.evaluate(expr, effects)?;
        let fixed_type = self
            .variables
            .get(name.name.as_str())
            .map(|current| current.value_type());
        if fixed_type.is_some_and(|fixed| fixed != value.value_type()) {
            return Err(RuntimeErrorCode::ETypeMismatch);
        }
        self.variables.insert(name.name.as_str(), value);
        effects.assigned = Some(Assignment {
            name: name.name.clone(),
            value,
        });
        Ok(())
    }

    fn evaluate(&mut self, expr: &Expr, effects: &mut LineEffects) -> Evaluated<Value> {
        match expr {
            Expr::Simple { value } => self.read(value),
            Expr::IsThere { arg } => self.probe(arg, effects),
            Expr::Not { operand } => eval::negate(self.read(operand)?),
            Expr::Binary { op, lhs, rhs } => self.binary(*op, lhs, rhs),
        }
    }

    fn binary(&self, op: BinOp, lhs: &Simple, rhs: &Simple) -> Evaluated<Value> {
        let left = self.read(lhs)?;
        eval::check_left(op, left)?;
        let right = self.read(rhs)?;
        eval::check_right(op, left, right)?;
        eval::apply(op, left, right)
    }

    fn probe(&mut self, arg: &Simple, effects: &mut LineEffects) -> Evaluated<Value> {
        let wanted = self
            .read(arg)?
            .as_int()
            .and_then(Cell::from_probe_code)
            .ok_or(RuntimeErrorCode::EBadArg)?;
        let seen = match self.world.forward_of(self.robot.pos, self.robot.dir) {
            Some(ahead) => {
                self.reveal(ahead, effects);
                self.world.get(ahead).unwrap_or(Cell::Wall)
            }
            None => Cell::Wall,
        };
        Ok(Value::Bool(seen == wanted))
    }
}
