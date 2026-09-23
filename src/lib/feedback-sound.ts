import { isSoundEnabled } from "./arcade-sound";

let sharedContext: AudioContext | null = null;
let idleCloseTimer: number | undefined;

function closeContext(audio: AudioContext) {
  if (sharedContext === audio) sharedContext = null;
  try {
    void audio.close().catch(() => undefined);
  } catch {
    // A browser may have already reclaimed the audio device.
  }
}

function tone(
  audio: AudioContext,
  output: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
  endFrequency = frequency,
) {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== frequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration * 0.7);
  }
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function woodStamp(audio: AudioContext, output: AudioNode, start: number) {
  // A brief, reproducible noise impulse adds the grain of a wooden stamp;
  // two falling resonances give the impact a warm body instead of a UI beep.
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.065), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 0x61c88647;
  for (let index = 0; index < samples.length; index += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    samples[index] = ((seed >>> 0) / 0x80000000 - 1) * Math.exp((-5 * index) / samples.length);
  }

  const impact = audio.createBufferSource();
  const woodFilter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  impact.buffer = buffer;
  woodFilter.type = "bandpass";
  woodFilter.frequency.setValueAtTime(1150, start);
  woodFilter.Q.setValueAtTime(0.8, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(0.18, start + 0.002);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
  impact.connect(woodFilter);
  woodFilter.connect(envelope);
  envelope.connect(output);
  impact.onended = () => {
    impact.disconnect();
    woodFilter.disconnect();
    envelope.disconnect();
  };
  impact.start(start);
  impact.stop(start + 0.07);
  tone(audio, output, 230, start, 0.105, 0.34, "triangle", 125);
  tone(audio, output, 780, start + 0.002, 0.065, 0.1, "sine", 570);
}

/** A wooden stamp followed by a light D-major pentatonic chime; no audio assets. */
export function playCorrectAnswerSound() {
  if (typeof window === "undefined" || !isSoundEnabled()) return;
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  let audio: AudioContext | null = null;
  try {
    if (sharedContext && sharedContext.state !== "running") {
      if (idleCloseTimer !== undefined) window.clearTimeout(idleCloseTimer);
      idleCloseTimer = undefined;
      closeContext(sharedContext);
    }
    audio = sharedContext ?? new AudioContextClass();
    // Do not queue surprise sounds or ask for microphone/audio permissions.
    // Autoplay-blocked contexts stay silent until a later allowed interaction.
    if (audio.state !== "running") {
      closeContext(audio);
      return;
    }
    sharedContext = audio;
    if (idleCloseTimer !== undefined) window.clearTimeout(idleCloseTimer);

    const start = audio.currentTime + 0.005;
    const output = audio.createGain();
    output.gain.setValueAtTime(0.18, start);
    output.connect(audio.destination);
    woodStamp(audio, output, start);

    // D, F#, A, B are all in the D-major pentatonic scale. Soft octave partials
    // add a little glass to the sine tones without a sharp, metallic top end.
    const notes = [587.33, 739.99, 880, 987.77];
    notes.forEach((frequency, index) => {
      const at = start + 0.065 + index * 0.08;
      const volume = 0.2 - index * 0.025;
      tone(audio!, output, frequency, at, 0.43, volume);
      tone(audio!, output, frequency * 2, at, 0.24, volume * 0.13);
    });

    // Reuse one device during bursts of correct answers, but release each
    // voice and then the idle device. Rapid answers cannot exhaust contexts.
    window.setTimeout(() => output.disconnect(), 900);
    const current = audio;
    idleCloseTimer = window.setTimeout(() => {
      idleCloseTimer = undefined;
      closeContext(current);
    }, 1250);
  } catch {
    if (audio) closeContext(audio);
    // Audio is optional: visual feedback and the game continue normally.
  }
}
