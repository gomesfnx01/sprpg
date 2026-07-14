/* ============================================================
   sound.js — efeitos sonoros e ambiente, sintetizados via Web Audio API.

   Não depende de nenhum arquivo de áudio (nem pasta, nem manifest) —
   os sons são gerados por código, então funcionam exatamente igual no
   Live Server e no GitHub Pages, sem nenhuma etapa extra de build.
   ============================================================ */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'rpgProgressao_soundMuted';

  let ctx = null;
  let masterGain = null;
  let ambientNodes = null;
  let muted = localStorage.getItem(STORAGE_KEY) === '1';

  function ensureContext() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 1;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function isMuted() { return muted; }

  function setMuted(value) {
    muted = !!value;
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    }
  }

  function toggleMuted() {
    setMuted(!muted);
    return muted;
  }

  // ---------- Helper de síntese de um único "bip" ----------
  function tone(freq, startTime, duration, opts) {
    opts = opts || {};
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(freq, startTime);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, startTime + duration);
    const peak = opts.gain != null ? opts.gain : 0.12;
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(peak, startTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  }

  function noiseBurst(startTime, duration, peak) {
    const size = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    src.connect(g);
    g.connect(masterGain);
    src.start(startTime);
  }

  // ---------- Efeitos ----------
  function playClick() {
    if (!ensureContext()) return;
    tone(720, ctx.currentTime, 0.05, { type: 'square', gain: 0.07 });
  }

  function playToggleOn() {
    if (!ensureContext()) return;
    const t = ctx.currentTime;
    tone(520, t, 0.05, { type: 'square', gain: 0.09 });
    tone(820, t + 0.05, 0.09, { type: 'square', gain: 0.09 });
  }

  function playToggleOff() {
    if (!ensureContext()) return;
    tone(400, ctx.currentTime, 0.08, { type: 'square', gain: 0.08 });
  }

  function playLevelUp() {
    if (!ensureContext()) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // dó-mi-sol-dó (uma oitava acima)
    notes.forEach((f, i) => tone(f, t + i * 0.09, 0.24, { type: 'triangle', gain: 0.14 }));
  }

  function playChestShake() {
    if (!ensureContext()) return;
    noiseBurst(ctx.currentTime, 0.14, 0.06);
  }

  const CHEST_NOTES = {
    comuns: [523.25, 659.25],
    raras: [523.25, 659.25, 783.99],
    epicas: [493.88, 622.25, 739.99, 987.77],
    lendarias: [523.25, 659.25, 783.99, 1046.5, 1318.5]
  };
  const CHEST_WAVE = {
    comuns: 'square',
    raras: 'triangle',
    epicas: 'triangle',
    lendarias: 'sawtooth'
  };
  function playChestReveal(rarity) {
    if (!ensureContext()) return;
    const t = ctx.currentTime;
    const notes = CHEST_NOTES[rarity] || CHEST_NOTES.comuns;
    const type = CHEST_WAVE[rarity] || 'square';
    const gainBase = rarity === 'lendarias' ? 0.18 : 0.14;
    notes.forEach((f, i) => tone(f, t + i * 0.1, 0.32, { type: type, gain: gainBase }));
    if (rarity === 'lendarias') {
      // brilho extra no topo pra reforçar a raridade máxima
      tone(1567.98, t + notes.length * 0.1 + 0.05, 0.4, { type: 'sine', gain: 0.12 });
    }
  }

  // ---------- Ambiente (drone suave e contínuo, sem arquivo de música) ----------
  const SPARKLE_NOTES = [880, 987.77, 1174.66, 1318.51, 1567.98]; // pentatônica maior — sempre soa alegre

  function scheduleSparkle() {
    if (!ambientNodes) return;
    const delay = 3500 + Math.random() * 4500;
    ambientNodes.sparkleTimer = setTimeout(() => {
      if (!ambientNodes || !ctx) return;
      const t = ctx.currentTime;
      const freq = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)];
      tone(freq, t, 1.1, { type: 'sine', gain: 0.05 });
      scheduleSparkle();
    }, delay);
  }

  function startAmbient() {
    if (!ensureContext() || ambientNodes || muted) return;
    const now = ctx.currentTime;
    const root = 220; // A3 — registro mais claro e leve (menos "porão sombrio")
    // Acorde MAIOR de verdade (raiz, terça maior, quinta) — soa aberto e alegre,
    // em vez do raiz+quinta "vazio" (sem terça) que lembrava algo mais soturno.
    const intervals = [1, Math.pow(2, 4 / 12), Math.pow(2, 7 / 12)];

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(masterGain);
    master.gain.linearRampToValueAtTime(0.026, now + 3);

    const oscs = intervals.map((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; // mais quente/redondo que sine puro
      osc.frequency.value = root * mult;
      osc.detune.value = (i - 1) * 4;
      const g = ctx.createGain();
      g.gain.value = 1 / intervals.length;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      return osc;
    });

    // LFO leve modulando o volume, pra soar "respirando" em vez de estático
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.009;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start(now);

    ambientNodes = { oscs: oscs, master: master, lfo: lfo, sparkleTimer: null };
    scheduleSparkle(); // brilhos agudos ocasionais, tipo tema de vila de RPG
  }

  function stopAmbient() {
    if (!ambientNodes || !ctx) return;
    const now = ctx.currentTime;
    const nodes = ambientNodes;
    if (nodes.sparkleTimer) clearTimeout(nodes.sparkleTimer);
    nodes.master.gain.setTargetAtTime(0, now, 0.3);
    setTimeout(() => {
      nodes.oscs.forEach((o) => { try { o.stop(); } catch (e) { /* já parado */ } });
      try { nodes.lfo.stop(); } catch (e) { /* já parado */ }
    }, 1200);
    ambientNodes = null;
  }

  global.Sound = {
    ensureContext, isMuted, setMuted, toggleMuted,
    playClick, playToggleOn, playToggleOff, playLevelUp,
    playChestShake, playChestReveal, startAmbient, stopAmbient
  };
})(window);
