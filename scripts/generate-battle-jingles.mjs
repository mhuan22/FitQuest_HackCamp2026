// Original chiptune result cues. Run with: node scripts/generate-battle-jingles.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../public/audio/', import.meta.url);
const sampleRate = 44100;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

function render(notes, duration) {
  const samples = new Float64Array(Math.ceil(duration * sampleRate));
  for (const [start, length, midi, gain] of notes) {
    const hz = frequency(midi);
    for (let i = 0; i < length * sampleRate; i++) {
      const index = Math.round(start * sampleRate) + i;
      if (index >= samples.length) break;
      const t = i / sampleRate;
      const envelope = Math.min(1, t / .008) * Math.min(1, (length - t) / .09) * Math.exp(-t * 1.3);
      // Band-limited harmonics keep the retro tone bright without square-wave aliasing.
      const phase = 2 * Math.PI * hz * t;
      samples[index] += gain * envelope * (Math.sin(phase) + .22 * Math.sin(3 * phase) + .08 * Math.sin(5 * phase));
    }
  }
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => wav.writeInt16LE(Math.round(value / peak * .72 * 32767), 44 + i * 2));
  return wav;
}

const cues = [
  { name: 'victory', duration: 2.1, description: 'Original ascending C-major victory fanfare', notes: [
    [0, .15, 72, .7], [.16, .15, 76, .7], [.32, .15, 79, .7], [.48, .35, 84, .7],
    [.86, .16, 79, .65], [1.05, .95, 84, .7],
    [.48, .35, 60, .18], [.48, .35, 64, .18], [.48, .35, 67, .18],
    [1.05, .95, 60, .2], [1.05, .95, 64, .2], [1.05, .95, 67, .2],
  ] },
  { name: 'defeat', duration: 1.9, description: 'Original descending C-minor defeat cue', notes: [
    [0, .28, 67, .65], [.3, .28, 63, .65], [.6, .28, 60, .65], [.9, .9, 48, .7],
    [.9, .9, 51, .2], [.9, .9, 55, .2],
  ] },
];
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
for (const cue of cues) {
  const file = `effects/${cue.name}.wav`;
  const wav = render(cue.notes, cue.duration);
  writeFileSync(new URL(file, root), wav);
  const index = manifest.findIndex(entry => entry.file === file);
  if (index < 0) throw new Error(`Missing manifest entry: ${file}`);
  manifest[index] = { file, source: 'scripts/generate-battle-jingles.mjs', author: 'FitQuest',
    description: cue.description, duration: cue.duration, gain: 1,
    sha256: createHash('sha256').update(wav).digest('hex') };
  console.log(`${cue.name}: ${cue.duration}s, mono PCM WAV, peak 0.72`);
}
writeFileSync(new URL('manifest.json', root), JSON.stringify(manifest, null, 2) + '\n');
