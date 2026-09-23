import { afterEach, describe, expect, test } from "bun:test";
import { playCorrectAnswerSound } from "../../src/lib/feedback-sound";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let timers = new Map<number, () => void>();

class FakeAudioParam {
  values: number[] = [];
  setValueAtTime(value: number) {
    this.values.push(value);
  }
  exponentialRampToValueAtTime(value: number) {
    this.values.push(value);
  }
}

class FakeNode {
  gain = new FakeAudioParam();
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
  type = "sine";
  buffer: unknown;
  onended: (() => void) | null = null;
  started: number | undefined;
  stopped: number | undefined;
  disconnected = false;
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
  start(time: number) {
    this.started = time;
  }
  stop(time: number) {
    this.stopped = time;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static initialState = "running";
  state = FakeAudioContext.initialState;
  currentTime = 1;
  sampleRate = 48000;
  destination = new FakeNode();
  nodes: FakeNode[] = [];
  closed = false;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    return this.node();
  }
  createOscillator() {
    return this.node();
  }
  createBufferSource() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  close() {
    this.closed = true;
    this.state = "closed";
    return Promise.resolve();
  }
  private node() {
    const node = new FakeNode();
    this.nodes.push(node);
    return node;
  }
}

function browser({ muted = false, supported = true, legacy = false } = {}) {
  let nextTimer = 0;
  timers = new Map();
  FakeAudioContext.instances = [];
  FakeAudioContext.initialState = "running";
  const fakeWindow = {
    AudioContext: supported && !legacy ? FakeAudioContext : undefined,
    webkitAudioContext: supported && legacy ? FakeAudioContext : undefined,
    setTimeout(callback: () => void) {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => (muted ? "off" : "on") },
  });
  return fakeWindow;
}

function finishTimers() {
  for (const callback of timers.values()) callback();
  timers.clear();
}

afterEach(() => {
  finishTimers();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

describe("correct-answer sound", () => {
  test("server rendering and browsers without Web Audio are silent", () => {
    Reflect.deleteProperty(globalThis, "window");
    expect(() => playCorrectAnswerSound()).not.toThrow();
    browser({ supported: false });
    expect(() => playCorrectAnswerSound()).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test("the saved mute preference prevents device creation", () => {
    browser({ muted: true });
    playCorrectAnswerSound();
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(timers.size).toBe(0);
  });

  test("autoplay-blocked contexts close without scheduling deferred sounds", () => {
    browser();
    FakeAudioContext.initialState = "suspended";
    playCorrectAnswerSound();
    const audio = FakeAudioContext.instances[0];
    expect(audio.closed).toBe(true);
    expect(audio.nodes).toHaveLength(0);
    expect(timers.size).toBe(0);
  });

  test("device errors do not escape into gameplay", () => {
    const host = browser();
    host.AudioContext = class extends FakeAudioContext {
      constructor() {
        super();
        throw new Error("Audio device unavailable");
      }
    };
    expect(() => playCorrectAnswerSound()).not.toThrow();
  });

  test("legacy Safari constructor plays bounded voices and releases the device", () => {
    browser({ legacy: true });
    playCorrectAnswerSound();
    const audio = FakeAudioContext.instances[0];
    const voices = audio.nodes.filter((node) => node.started !== undefined);
    expect(voices.length).toBeGreaterThan(1);
    for (const voice of voices) {
      expect(voice.stopped).toBeGreaterThan(voice.started!);
      expect(voice.stopped! - audio.currentTime).toBeLessThan(1);
      voice.onended?.();
      expect(voice.disconnected).toBe(true);
    }
    finishTimers();
    expect(audio.closed).toBe(true);
    expect(audio.nodes.every((node) => node.disconnected)).toBe(true);
  });

  test("bursts reuse one context and a later sound can reopen the idle device", () => {
    browser();
    for (let index = 0; index < 12; index += 1) playCorrectAnswerSound();
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].closed).toBe(false);
    finishTimers();
    expect(FakeAudioContext.instances[0].closed).toBe(true);
    playCorrectAnswerSound();
    expect(FakeAudioContext.instances).toHaveLength(2);
  });

  test("an interrupted device is released before a new attempt", () => {
    browser();
    playCorrectAnswerSound();
    const interrupted = FakeAudioContext.instances[0];
    interrupted.state = "suspended";
    playCorrectAnswerSound();
    expect(interrupted.closed).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(2);
    expect(FakeAudioContext.instances[1].closed).toBe(false);
  });
});
