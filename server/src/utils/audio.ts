/**
 * G.711 mu-law decoding table
 */
const MULAW_DECODE_TABLE = new Int16Array(256);

// Initialize mu-law decode table
(() => {
  for (let i = 0; i < 256; i++) {
    const mulaw = ~i;
    const sign = (mulaw & 0x80) ? -1 : 1;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0F;

    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample = sign * (sample - 0x84);
    MULAW_DECODE_TABLE[i] = sample;
  }
})();

/**
 * Converts 8kHz mulaw audio (from Twilio) to 8kHz linear16 PCM.
 * @param mulawBuffer Buffer of mulaw audio data
 * @returns Buffer of linear16 PCM audio data (16-bit little-endian)
 */
export function mulawToLinear16(mulawBuffer: Buffer): Buffer {
  const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = MULAW_DECODE_TABLE[mulawBuffer[i]];
    pcmBuffer.writeInt16LE(sample, i * 2);
  }

  return pcmBuffer;
}

/**
 * Converts linear16 PCM to 8-bit mulaw
 * @param sample 16-bit PCM sample
 * @returns 8-bit mulaw byte
 */
function linearToMulawSample(sample: number): number {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;

  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > MULAW_MAX) sample = MULAW_MAX;

  sample = sample + MULAW_BIAS;
  let exponent = 7;
  let expMask;
  for (expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}

  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  const mulawByte = ~(sign | (exponent << 4) | mantissa);

  return mulawByte & 0xFF;
}

/**
 * Converts linear16 PCM (any sample rate) to 8kHz mulaw.
 * @param pcmBuffer Buffer of linear16 PCM audio data (16-bit little-endian)
 * @param sourceSampleRate Sample rate of the input PCM (e.g., 24000, 16000)
 * @returns Buffer of 8kHz mulaw audio data
 */
export function linear16ToMulaw(pcmBuffer: Buffer, sourceSampleRate: number = 8000): Buffer {
  const samples16bit = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);

  // Downsample if needed
  let downsampledSamples: Int16Array;
  if (sourceSampleRate !== 8000) {
    const ratio = sourceSampleRate / 8000;
    const targetLength = Math.floor(samples16bit.length / ratio);
    downsampledSamples = new Int16Array(targetLength);

    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = Math.floor(i * ratio);
      downsampledSamples[i] = samples16bit[sourceIndex];
    }
  } else {
    downsampledSamples = samples16bit;
  }

  // Convert to mulaw
  const mulaw = Buffer.alloc(downsampledSamples.length);
  for (let i = 0; i < downsampledSamples.length; i++) {
    mulaw[i] = linearToMulawSample(downsampledSamples[i]);
  }

  return mulaw;
}
