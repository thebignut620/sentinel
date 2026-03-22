/**
 * useSound — Web Audio API sound effects for Sentinel
 * All sounds are synthesized programmatically (no audio files needed).
 * Sound is disabled by default. Toggle via the 'sentinel_sound' localStorage key.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function play(buildFn) {
  if (localStorage.getItem('sentinel_sound') !== 'on') return;
  try {
    const ctx = getCtx();
    // Resume suspended context (required after user gesture policy)
    if (ctx.state === 'suspended') ctx.resume();
    buildFn(ctx);
  } catch {
    // Silently ignore — audio not supported or blocked
  }
}

// Gentle two-tone chime: ticket resolved / success
export function soundResolved() {
  play(ctx => {
    const now = ctx.currentTime;
    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.55);
    });
  });
}

// Soft click — kanban card drag / button tap
export function soundClick() {
  play(ctx => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.1);
  });
}

// Urgent buzz — critical/high priority notification
export function soundCritical() {
  play(ctx => {
    const now = ctx.currentTime;
    [0, 0.12, 0.24].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now + offset);
      gain.gain.setValueAtTime(0.1, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    });
  });
}

// Upward sweep — new message / notification
export function soundNotification() {
  play(ctx => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(660, now + 0.15);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.35);
  });
}

// Celebratory arpeggio — milestone / confetti
export function soundCelebration() {
  play(ctx => {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.5);
    });
  });
}

// Returns whether sound is currently enabled
export function isSoundEnabled() {
  return localStorage.getItem('sentinel_sound') === 'on';
}

// Toggle sound on/off, returns new state
export function toggleSound() {
  const next = isSoundEnabled() ? 'off' : 'on';
  localStorage.setItem('sentinel_sound', next);
  return next === 'on';
}
