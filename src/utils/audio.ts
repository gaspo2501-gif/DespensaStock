// Audio feedback synth for scan detection and error/success alerts

export function playScanSound(type: 'success' | 'found' | 'error' = 'success') {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success' || type === 'found') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'found' ? 880 : 1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }

    // Trigger haptic vibration on mobile devices
    if ('vibrate' in navigator) {
      if (type === 'error') {
        navigator.vibrate([100, 50, 100]);
      } else {
        navigator.vibrate(80);
      }
    }
  } catch (err) {
    console.debug('Audio playback prevented or unsupported:', err);
  }
}
