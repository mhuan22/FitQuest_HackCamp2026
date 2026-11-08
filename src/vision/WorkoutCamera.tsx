import { useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { exercises, createRepCounter, jointVisible, staleMs } from './repCounter';
import { createEnduranceTracker } from './enduranceTracker';
import { createShadowLift } from './shadowLift';

const wasm = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const model = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const fullBody = PoseLandmarker.POSE_CONNECTIONS.map(({ start, end }) => [start, end]);
export type ExerciseId = keyof typeof exercises;

type Props = {
  exercise: ExerciseId;
  onReady: () => void;
  onProgress: (amount: number) => void;
  onFeedback: (message: string) => void;
  onError: (message: string) => void;
};

export default function WorkoutCamera({ exercise, onReady, onProgress, onFeedback, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const option = exercises[exercise];
    const sides = 'sides' in option ? option.sides : fullBody;
    const tracker = exercise === 'run' ? createEnduranceTracker() : createRepCounter(exercise);
    const enhanceFrame = new URLSearchParams(window.location.search).get('shadowLift') === 'off'
      ? undefined
      : createShadowLift();
    let disposed = false;
    let stream: MediaStream | undefined;
    let landmarker: PoseLandmarker | undefined;
    let animation = 0;
    let staleTimer: ReturnType<typeof setTimeout> | undefined;
    let lastTime = -Infinity;
    let lastVideoTime = -1;
    let durationMs = 0;

    function stop() {
      disposed = true;
      cancelAnimationFrame(animation);
      clearTimeout(staleTimer);
      stream?.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      landmarker?.close();
    }

    function fail(message: string) {
      if (disposed) return;
      stop();
      onError(message);
    }

    function detect(time: number) {
      if (disposed || !landmarker) return;
      if (video.readyState >= 2 && time - lastTime >= 65 && video.currentTime !== lastVideoTime) {
        lastTime = time;
        lastVideoTime = video.currentTime;
        try {
          const input = enhanceFrame?.(video, time) ?? video;
          const points = landmarker.detectForVideo(input, time).landmarks[0] ?? [];
          const { videoWidth: width, videoHeight: height } = video;
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          drawPose(ctx, points, width, height, sides);
          const result = tracker.update(points, width, height, time);
          const phase = result.phase;
          const message = phase === 'framing' ? option.frame : (option as Record<string, unknown>)[phase];
          onFeedback('counted' in result && result.counted ? 'Rep counted!' : String(message ?? option.frame));
          if ('durationMs' in result && result.durationMs > durationMs) {
            onProgress(result.durationMs - durationMs);
            durationMs = result.durationMs;
          } else if ('counted' in result && result.counted) {
            onProgress(1);
          }
          clearTimeout(staleTimer);
          staleTimer = setTimeout(() => {
            tracker.loseTracking();
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            onFeedback(option.frame);
          }, staleMs);
        } catch {
          fail('Pose tracking stopped. Try starting the camera again.');
          return;
        }
      }
      animation = requestAnimationFrame(detect);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        fail('Camera access requires localhost or an HTTPS address.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        });
        if (disposed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        stream.getVideoTracks().forEach(track =>
          track.addEventListener('ended', () => fail('The camera disconnected. Try starting it again.'))
        );
        video.srcObject = stream;
        await video.play();
      } catch (error) {
        fail(error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow it in your browser and try again.'
          : 'Could not open the camera. Check that it is connected and available.');
        return;
      }

      try {
        if (disposed) return;
        const files = await FilesetResolver.forVisionTasks(wasm);
        if (disposed) return;
        landmarker = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: model },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (disposed) {
          landmarker.close();
          return;
        }
        onReady();
        animation = requestAnimationFrame(detect);
      } catch {
        fail('The pose model could not load. Check your internet connection and try again.');
      }
    }

    start();
    return () => {
      if (!disposed) stop();
    };
  }, [exercise, onReady, onProgress, onFeedback, onError]);

  return (
    <>
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} aria-hidden="true" />
    </>
  );
}

function drawPose(
  ctx: CanvasRenderingContext2D | null,
  points: NormalizedLandmark[],
  width: number,
  height: number,
  sides: number[][],
) {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 4;
  ctx.strokeStyle = ctx.fillStyle = '#bbfa75';

  for (const indices of sides) {
    const joints = indices.map(index => points[index]);
    if (!joints.every(jointVisible)) continue;
    const [first, ...rest] = joints;
    ctx.beginPath();
    ctx.moveTo(first.x * width, first.y * height);
    rest.forEach(point => ctx.lineTo(point.x * width, point.y * height));
    ctx.stroke();

    for (const point of joints) {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
