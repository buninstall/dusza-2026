use std::collections::BTreeSet;

use super::compile::{Calc, Code, Instr, Op, Operand, compile};
use super::error::{RuntimeError, RuntimeErrorCode};
use super::eval;
use super::robot::RobotState;
use super::trace::{Assignment, Event, MAX_STEPS, Outcome, RunResult};
use super::value::Value;
use crate::map::{Cell, Map, Pos};
use crate::syntax::ast::{BinOp, Program};

type Evaluated<T> = Result<T, RuntimeErrorCode>;

const GRID_LIMIT: usize = 1 << 16;

pub(super) fn execute(program: &Program, map: &Map) -> RunResult {
    let code = compile(program);
    let mut machine = Machine::new(map, &code);
    let outcome = match machine.run(&code.instrs) {
        Ok(()) => Outcome::Ok,
        Err(error) => Outcome::from(error),
    };
    machine.finish(outcome)
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
    rows: usize,
    cols: usize,
    grid: Vec<bool>,
    elsewhere: BTreeSet<Pos>,
    order: Vec<Pos>,
}

impl Discovery {
    fn starting_at(map: &Map, start: Pos) -> Self {
        let cells = map
            .rows
            .checked_mul(map.cols)
            .filter(|cells| *cells <= GRID_LIMIT)
            .unwrap_or(0);
        let mut discovery = Self {
            rows: map.rows,
            cols: map.cols,
            grid: vec![false; cells],
            elsewhere: BTreeSet::new(),
            order: Vec::new(),
        };
        discovery.reveal(start);
        discovery
    }

    fn reveal(&mut self, cell: Pos) -> bool {
        let slot = (cell.row < self.rows && cell.col < self.cols)
            .then(|| cell.row * self.cols + cell.col)
            .and_then(|index| self.grid.get_mut(index));
        let is_new = match slot {
            Some(seen) => !std::mem::replace(seen, true),
            None => self.elsewhere.insert(cell),
        };
        if is_new {
            self.order.push(cell);
        }
        is_new
    }
}

struct Machine<'p> {
    world: Map,
    robot: RobotState,
    names: &'p [&'p str],
    variables: Vec<Option<Value>>,
    discovery: Discovery,
    gold: u32,
    steps: u32,
    console: Vec<String>,
    events: Vec<Event>,
}

impl<'p> Machine<'p> {
    fn new(map: &Map, code: &'p Code<'p>) -> Self {
        let robot = RobotState::start_of(map);
        Self {
            world: map.clone(),
            robot,
            names: &code.names,
            variables: vec![None; code.names.len()],
            discovery: Discovery::starting_at(map, robot.pos),
            gold: 0,
            steps: 0,
            console: Vec::new(),
            events: Vec::with_capacity(usize::try_from(MAX_STEPS).unwrap_or(0)),
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

    fn run(&mut self, code: &[Instr]) -> Result<(), RuntimeError> {
        let mut pc = 0;
        while let Some(instr) = code.get(pc) {
            let line = instr.line;
            pc = match instr.op {
                Op::Jump(target) => target,
                Op::Branch { cond, otherwise } => {
                    if self.process(line, |machine, _| machine.condition(cond))? {
                        pc + 1
                    } else {
                        otherwise
                    }
                }
                Op::Loop { cond, exit } => {
                    if self.process(line, |machine, _| machine.condition(cond))? {
                        pc + 1
                    } else {
                        exit
                    }
                }
                Op::Else => {
                    self.process(line, |_, _| Ok(()))?;
                    pc + 1
                }
                Op::Step(count) => {
                    self.process(line, |machine, effects| machine.step(count, effects))?;
                    pc + 1
                }
                Op::Turn(quarters) => {
                    self.process(line, |machine, _| machine.turn(quarters))?;
                    pc + 1
                }
                Op::Mine => {
                    self.process(line, Self::mine)?;
                    pc + 1
                }
                Op::Print(value) => {
                    self.process(line, |machine, effects| machine.print(value, effects))?;
                    pc + 1
                }
                Op::Set(slot, calc) => {
                    self.process(line, |machine, effects| machine.assign(slot, calc, effects))?;
                    pc + 1
                }
            };
        }
        Ok(())
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

    fn read(&self, operand: Operand) -> Evaluated<Value> {
        match operand {
            Operand::Int(value) => Ok(Value::Int(value)),
            Operand::Bool(value) => Ok(Value::Bool(value)),
            Operand::Var(slot) => self
                .variables
                .get(slot)
                .copied()
                .flatten()
                .ok_or(RuntimeErrorCode::EUninitialized),
        }
    }

    fn count_argument(&self, operand: Operand) -> Evaluated<u64> {
        self.read(operand)?
            .as_int()
            .and_then(|count| u64::try_from(count).ok())
            .ok_or(RuntimeErrorCode::EBadArg)
    }

    fn condition(&self, cond: Operand) -> Evaluated<bool> {
        self.read(cond)?
            .as_bool()
            .ok_or(RuntimeErrorCode::ENonBoolCondition)
    }

    fn step(&mut self, count: Operand, effects: &mut LineEffects) -> Evaluated<()> {
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

    fn turn(&mut self, quarters: Operand) -> Evaluated<()> {
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

    fn print(&mut self, value: Operand, effects: &mut LineEffects) -> Evaluated<()> {
        let text = self.read(value)?.to_string();
        self.console.push(text.clone());
        effects.print = Some(text);
        Ok(())
    }

    fn assign(&mut self, slot: usize, calc: Calc, effects: &mut LineEffects) -> Evaluated<()> {
        let value = self.evaluate(calc, effects)?;
        let Some(variable) = self.variables.get_mut(slot) else {
            return Err(RuntimeErrorCode::EUninitialized);
        };
        if variable.is_some_and(|current| current.value_type() != value.value_type()) {
            return Err(RuntimeErrorCode::ETypeMismatch);
        }
        *variable = Some(value);
        effects.assigned = Some(Assignment {
            name: self.names.get(slot).copied().unwrap_or_default().to_owned(),
            value,
        });
        Ok(())
    }

    fn evaluate(&mut self, calc: Calc, effects: &mut LineEffects) -> Evaluated<Value> {
        match calc {
            Calc::Simple(value) => self.read(value),
            Calc::IsThere(arg) => self.probe(arg, effects),
            Calc::Not(operand) => eval::negate(self.read(operand)?),
            Calc::Binary(op, lhs, rhs) => self.binary(op, lhs, rhs),
        }
    }

    fn binary(&self, op: BinOp, lhs: Operand, rhs: Operand) -> Evaluated<Value> {
        let left = self.read(lhs)?;
        eval::check_left(op, left)?;
        let right = self.read(rhs)?;
        eval::check_right(op, left, right)?;
        eval::apply(op, left, right)
    }

    fn probe(&mut self, arg: Operand, effects: &mut LineEffects) -> Evaluated<Value> {
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
