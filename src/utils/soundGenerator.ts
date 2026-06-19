/**
 * Sound Generator Utility
 * Generates professional notification sounds using Web Audio API
 */

export type SoundType = 'notification' | 'order' | 'success' | 'warning' | 'error';

interface SoundOptions {
  volume?: number;
  duration?: number;
  type?: SoundType;
}

/**
 * Generate and play a notification sound
 */
export async function playGeneratedSound(options: SoundOptions = {}): Promise<void> {
  const {
    volume = 0.8,
    duration = 0.6,
    type = 'notification'
  } = options;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const now = audioContext.currentTime;

    switch (type) {
      case 'order':
        await generateOrderSound(audioContext, now, volume, duration);
        break;
      case 'success':
        await generateSuccessSound(audioContext, now, volume, duration);
        break;
      case 'warning':
        await generateWarningSound(audioContext, now, volume, duration);
        break;
      case 'error':
        await generateErrorSound(audioContext, now, volume, duration);
        break;
      case 'notification':
      default:
        await generateNotificationSound(audioContext, now, volume, duration);
        break;
    }
  } catch (error) {
    console.error('Error generating sound:', error);
    throw error;
  }
}

/**
 * Generate professional notification sound (gentle bell-like)
 */
function generateNotificationSound(
  ctx: AudioContext,
  startTime: number,
  volume: number,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    // Create multiple oscillators for rich sound
    const frequencies = [800, 1000, 1200];
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const oscGain = ctx.createGain();

      oscillator.connect(oscGain);
      oscGain.connect(gainNode);

      oscillator.type = 'sine';
      oscillator.frequency.value = freq;

      // Staggered start for bell effect
      const delay = index * 0.05;
      const noteVolume = volume / frequencies.length * (1 - index * 0.2);

      oscGain.gain.setValueAtTime(0, startTime + delay);
      oscGain.gain.linearRampToValueAtTime(noteVolume, startTime + delay + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + delay + duration);

      oscillator.start(startTime + delay);
      oscillator.stop(startTime + delay + duration);
    });

    setTimeout(() => resolve(), duration * 1000 + 100);
  });
}

/**
 * Generate order notification sound (urgent and attention-grabbing)
 */
function generateOrderSound(
  ctx: AudioContext,
  startTime: number,
  volume: number,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    // Triple beep pattern with increasing urgency
    const beeps = [
      { freq: 880, start: 0, duration: 0.15 },
      { freq: 1100, start: 0.2, duration: 0.15 },
      { freq: 1320, start: 0.4, duration: 0.3 }
    ];

    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = volume;

    beeps.forEach(beep => {
      const oscillator = ctx.createOscillator();
      const beepGain = ctx.createGain();

      oscillator.connect(beepGain);
      beepGain.connect(gainNode);

      oscillator.type = 'square';
      oscillator.frequency.value = beep.freq;

      const beepStart = startTime + beep.start;
      const beepEnd = beepStart + beep.duration;

      beepGain.gain.setValueAtTime(0, beepStart);
      beepGain.gain.linearRampToValueAtTime(1, beepStart + 0.01);
      beepGain.gain.linearRampToValueAtTime(0.7, beepEnd - 0.05);
      beepGain.gain.exponentialRampToValueAtTime(0.01, beepEnd);

      oscillator.start(beepStart);
      oscillator.stop(beepEnd);
    });

    setTimeout(() => resolve(), 800);
  });
}

/**
 * Generate success sound (pleasant ascending notes)
 */
function generateSuccessSound(
  ctx: AudioContext,
  startTime: number,
  volume: number,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord)
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = volume;

    notes.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const noteGain = ctx.createGain();

      oscillator.connect(noteGain);
      noteGain.connect(gainNode);

      oscillator.type = 'sine';
      oscillator.frequency.value = freq;

      const noteStart = startTime + index * 0.1;
      const noteDuration = 0.2;

      noteGain.gain.setValueAtTime(0, noteStart);
      noteGain.gain.linearRampToValueAtTime(0.8, noteStart + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.01, noteStart + noteDuration);

      oscillator.start(noteStart);
      oscillator.stop(noteStart + noteDuration);
    });

    setTimeout(() => resolve(), 500);
  });
}

/**
 * Generate warning sound (attention-grabbing but not alarming)
 */
function generateWarningSound(
  ctx: AudioContext,
  startTime: number,
  volume: number,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = volume;

    // Two-tone alternating beep
    const frequencies = [600, 800];

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const beepGain = ctx.createGain();

      oscillator.connect(beepGain);
      beepGain.connect(gainNode);

      oscillator.type = 'triangle';
      oscillator.frequency.value = freq;

      const beepStart = startTime + index * 0.25;
      const beepDuration = 0.2;

      beepGain.gain.setValueAtTime(0, beepStart);
      beepGain.gain.linearRampToValueAtTime(0.8, beepStart + 0.01);
      beepGain.gain.exponentialRampToValueAtTime(0.01, beepStart + beepDuration);

      oscillator.start(beepStart);
      oscillator.stop(beepStart + beepDuration);
    });

    setTimeout(() => resolve(), 600);
  });
}

/**
 * Generate error sound (descending alarm)
 */
function generateErrorSound(
  ctx: AudioContext,
  startTime: number,
  volume: number,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = volume;

    const oscillator = ctx.createOscillator();
    oscillator.connect(gainNode);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(400, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, startTime + 0.4);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.8, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.4);

    setTimeout(() => resolve(), 500);
  });
}

/**
 * Create a WAV file blob from generated audio
 */
export async function generateSoundBlob(type: SoundType = 'notification'): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const duration = type === 'order' ? 0.8 : 0.6;
  const sampleRate = audioContext.sampleRate;
  const numChannels = 1;
  const numFrames = Math.ceil(duration * sampleRate);

  // Create offline context for rendering
  const offlineContext = new OfflineAudioContext(numChannels, numFrames, sampleRate);

  const now = offlineContext.currentTime;

  // Generate the sound in offline context
  switch (type) {
    case 'order':
      await generateOrderSound(offlineContext, now, 0.8, duration);
      break;
    case 'success':
      await generateSuccessSound(offlineContext, now, 0.8, duration);
      break;
    case 'warning':
      await generateWarningSound(offlineContext, now, 0.8, duration);
      break;
    case 'error':
      await generateErrorSound(offlineContext, now, 0.8, duration);
      break;
    case 'notification':
    default:
      await generateNotificationSound(offlineContext, now, 0.8, duration);
      break;
  }

  // Render the audio
  const renderedBuffer = await offlineContext.startRendering();

  // Convert to WAV blob
  const wavBlob = audioBufferToWav(renderedBuffer);

  return wavBlob;
}

/**
 * Convert AudioBuffer to WAV blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const data = interleave(buffer);
  const dataLength = data.length * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio data
  floatTo16BitPCM(view, 44, data);

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function interleave(buffer: AudioBuffer): Float32Array {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels;
  const result = new Float32Array(length);

  let offset = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      result[offset++] = buffer.getChannelData(channel)[i];
    }
  }

  return result;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array): void {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}
