import { readStorage, writeStorage } from "../lib/storage.ts";

export type Cue = "step" | "turn" | "scan" | "mine" | "print" | "finish" | "error" | "star";

export const SOUND_KEY = "minescript.sound";

const MASTER_GAIN = 0.05;
const MIN_GAP_MS = 45;
const NOTE_GAP_S = 0.07;

type Tone = { freq: number; to?: number; at: number; length: number; wave: OscillatorType };

const SCORE: Record<Cue, readonly Tone[]> = {
  step: [{ freq: 196, at: 0, length: 0.04, wave: "square" }],
  turn: [{ freq: 330, to: 247, at: 0, length: 0.05, wave: "square" }],
  scan: [{ freq: 880, at: 0, length: 0.03, wave: "triangle" }],
  mine: [
    { freq: 988, at: 0, length: 0.06, wave: "square" },
    { freq: 1319, at: NOTE_GAP_S, length: 0.12, wave: "square" },
  ],
  print: [{ freq: 523, at: 0, length: 0.04, wave: "triangle" }],
  finish: [523, 659, 784, 1047].map((freq, index) => ({
    freq,
    at: index * NOTE_GAP_S,
    length: 0.09,
    wave: "square" as const,
  })),
  error: [
    { freq: 196, to: 98, at: 0, length: 0.2, wave: "sawtooth" },
    { freq: 147, to: 73, at: 0.05, length: 0.2, wave: "square" },
  ],
  star: [
    { freq: 1319, at: 0, length: 0.08, wave: "triangle" },
    { freq: 1760, at: NOTE_GAP_S, length: 0.16, wave: "triangle" },
  ],
};

const listeners = new Set<() => void>();
let context: AudioContext | null = null;
let lastCueAt = 0;

export function isSoundOn(): boolean {
  return readStorage(SOUND_KEY) !== "off";
}

export function setSoundOn(isOn: boolean): void {
  writeStorage(SOUND_KEY, isOn ? "on" : "off");
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function audio(): AudioContext | null {
  if (context) {
    return context;
  }
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") {
    return null;
  }
  try {
    context = new window.AudioContext();
  } catch {
    context = null;
  }
  return context;
}

export function unlockAudio(): void {
  const ctx = isSoundOn() ? audio() : null;
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }
}

function schedule(ctx: AudioContext, tone: Tone): void {
  const start = ctx.currentTime + tone.at;
  const end = start + tone.length;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = tone.wave;
  oscillator.frequency.setValueAtTime(tone.freq, start);
  if (tone.to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
  }
  gain.gain.setValueAtTime(MASTER_GAIN, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end);
}

export function playCue(cue: Cue, now = Date.now()): void {
  if (!isSoundOn()) {
    return;
  }
  const isLoud = cue === "finish" || cue === "error" || cue === "star";
  if (!isLoud && now - lastCueAt < MIN_GAP_MS) {
    return;
  }
  const ctx = audio();
  if (ctx?.state !== "running") {
    return;
  }
  lastCueAt = now;
  for (const tone of SCORE[cue]) {
    schedule(ctx, tone);
  }
}
