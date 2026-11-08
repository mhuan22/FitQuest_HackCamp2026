const sampleWidth = 32;
const sampleHeight = 24;
const sampleIntervalMs = 250;

export function createShadowLift() {
  const sample = document.createElement('canvas');
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const frame = document.createElement('canvas');
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  const frameContext = frame.getContext('2d', { willReadFrequently: true });
  const histogram = new Uint16Array(256);
  const curve = new Uint8Array(256);
  let lastSample = -Infinity;
  let gamma = 1;

  return (video: HTMLVideoElement, time: number) => {
    if (!sampleContext || !frameContext || !video.videoWidth || !video.videoHeight) return video;

    if (time - lastSample >= sampleIntervalMs) {
      sampleContext.drawImage(video, 0, 0, sampleWidth, sampleHeight);
      const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
      histogram.fill(0);
      for (let i = 0; i < pixels.length; i += 4) {
        const luminance = Math.round(0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]);
        histogram[luminance]++;
      }

      // Use the 60th percentile so a few bright patches do not hide an otherwise dark scene.
      const cutoff = sampleWidth * sampleHeight * 0.6;
      let luminance = 0;
      let total = histogram[0];
      while (total < cutoff) total += histogram[++luminance];
      const darkness = Math.max(0, Math.min(1, (95 - luminance) / 50));
      const targetGamma = 1 - darkness * 0.28;
      gamma = Number.isFinite(lastSample) ? gamma + (targetGamma - gamma) * 0.3 : targetGamma;
      lastSample = time;
      for (let i = 0; i < curve.length; i++) {
        curve[i] = Math.round(255 * (i / 255) ** gamma);
      }
    }

    if (gamma > 0.99) return video;
    const { videoWidth: width, videoHeight: height } = video;
    if (frame.width !== width || frame.height !== height) {
      frame.width = width;
      frame.height = height;
    }
    frameContext.drawImage(video, 0, 0);
    const image = frameContext.getImageData(0, 0, width, height);
    const pixels = image.data;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = curve[pixels[i]];
      pixels[i + 1] = curve[pixels[i + 1]];
      pixels[i + 2] = curve[pixels[i + 2]];
    }
    frameContext.putImageData(image, 0, 0);
    return frame;
  };
}
