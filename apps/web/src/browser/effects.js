export function createEffects(onNotice = () => {}, onAudioStateChange = () => {}) {
  // The phone test at 50% volume still felt quiet. Keep each signal below the
  // Web Audio clipping boundary while roughly doubling the previous levels.
  const soundLevel = { tempo: 0.8, countdown: 0.9, rest: 1 };
  let context = null;
  let interval = null;
  let generation = 0;
  let wakeLock = null;
  let wakeWanted = false;
  let wakePending = false;
  const oscillators = new Set();
  const alarmOscillators = new Set();
  let alarmInterval = null;

  function stopRestAlarm() {
    clearInterval(alarmInterval);
    alarmInterval = null;
    for (const oscillator of alarmOscillators) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
    }
    alarmOscillators.clear();
  }

  function stopTempo() {
    generation += 1;
    clearInterval(interval);
    interval = null;
    for (const oscillator of oscillators) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
    }
    oscillators.clear();
  }

  function beepAt(at, frequency, duration, level, group = oscillators) {
    if (!context || context.state !== 'running' || document.hidden) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.01);
    gain.gain.setValueAtTime(level, at + duration - 0.04);
    gain.gain.linearRampToValueAtTime(0, at + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => { group.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    group.add(oscillator);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.01);
  }

  return {
    async activateAudio() {
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) { onNotice('이 브라우저는 안내음을 지원하지 않습니다. 화면 안내로 진행할 수 있습니다.'); return; }
        if (!context || context.state === 'closed') {
          stopTempo();
          stopRestAlarm();
          context = new Audio();
        }
        context.onstatechange = onAudioStateChange;
        if (context.state !== 'running') await context.resume();
        if (context.state !== 'running') onNotice('안내음을 켜려면 사운드 버튼을 다시 눌러 주세요.');
      } catch {
        onNotice('안내음을 활성화하지 못했습니다. 사운드 버튼으로 다시 시도할 수 있습니다.');
      }
    },
    get audioRunning() { return context?.state === 'running'; },
    startTempo(phases) {
      stopTempo();
      if (!context || context.state !== 'running' || !phases.length || document.hidden) return;
      const token = generation;
      const cycleSeconds = phases.reduce((a, b) => a + b, 0);
      const offsets = phases.map((_, i) => phases.slice(0, i).reduce((a, b) => a + b, 0));
      const base = context.currentTime + 0.04;
      let lastScheduled = -1;
      function schedule() {
        if (token !== generation || document.hidden || context.state !== 'running') return;
        const now = context.currentTime;
        const cycle = Math.max(0, Math.floor((now - base) / cycleSeconds));
        for (let c = cycle; c <= cycle + 1; c++) {
          for (let p = 0; p < offsets.length; p++) {
            const at = base + c * cycleSeconds + offsets[p];
            const key = c * offsets.length + p;
            // Missed phases are skipped after background throttling; never play a burst.
            if (key > lastScheduled && at >= now && at < now + 0.16) {
              beepAt(at, p === offsets.length - 1 ? 880 : 520, 0.16, soundLevel.tempo);
              lastScheduled = key;
            }
          }
        }
      }
      schedule();
      interval = setInterval(schedule, 50);
    },
    stopTempo,
    startRestAlarm() {
      if (alarmInterval !== null || !context || context.state !== 'running' || document.hidden) return;
      stopTempo();
      let nextAt = context.currentTime + 0.01;
      function schedule() {
        if (document.hidden || context.state !== 'running') return;
        const now = context.currentTime;
        if (nextAt > now + 0.16) return;
        const at = Math.max(nextAt, now + 0.01);
        beepAt(at, 1040, 0.25, soundLevel.rest, alarmOscillators);
        beepAt(at + 0.37, 1040, 0.25, soundLevel.rest, alarmOscillators);
        nextAt = at + 1.2;
      }
      schedule();
      alarmInterval = setInterval(schedule, 50);
    },
    stopRestAlarm,
    beep(kind = 'countdown') {
      if (!context) return;
      const at = context.currentTime + 0.01;
      if (kind === 'rest') {
        beepAt(at, 1040, 0.25, soundLevel.rest);
        beepAt(at + 0.37, 1040, 0.25, soundLevel.rest);
      } else beepAt(at, 760, 0.18, soundLevel.countdown);
    },
    vibrate() {
      if (!document.hidden && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([100, 50, 100]); } catch { /* Optional device effect. */ }
      }
    },
    async setWakeLock(wanted) {
      wakeWanted = wanted;
      if (!wanted || document.hidden) {
        if (wakeLock) { const old = wakeLock; wakeLock = null; try { await old.release(); } catch { /* Optional API. */ } }
        return;
      }
      if (wakeLock || wakePending || !navigator.wakeLock) return;
      wakePending = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (!wakeWanted || document.hidden) { await lock.release(); return; }
        wakeLock = lock;
        lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
      } catch { /* Lack of permission or support does not interrupt a workout. */ }
      finally { wakePending = false; }
    },
    stop() { stopTempo(); stopRestAlarm(); void this.setWakeLock(false); }
  };
}
