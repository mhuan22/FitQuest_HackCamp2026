import { useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { exercises, jointVisible } from './repCounter';

const wasm = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const model = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const layer = { position: 'absolute', width: '100%', height: '100%', inset: 0, objectFit: 'contain', transform: 'scaleX(-1)' };

export function useCameraAccess() {
  return { request: async () => true };
}

export default function PoseCamera({ exercise, onFrame, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let disposed = false;
    let stream, landmarker, animation;
    let lastTime = -Infinity;
    let lastVideoTime = -1;

    function stop() {
      disposed = true;
      cancelAnimationFrame(animation);
      stream?.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      landmarker?.close();
    }

    function fail(message) {
      if (disposed) return;
      stop();
      onError(message);
    }

    function detect(time) {
      if (disposed) return;
      if (video.readyState >= 2 && time - lastTime >= 65 && video.currentTime !== lastVideoTime) {
        lastTime = time;
        lastVideoTime = video.currentTime;
        try {
          const points = landmarker.detectForVideo(video, time).landmarks[0] ?? [];
          const { videoWidth: width, videoHeight: height } = video;
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          drawPose(ctx, points, width, height, exercises[exercise].sides);
          onFrame(points, width, height, time);
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
        fail(error.name === 'NotAllowedError'
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
        animation = requestAnimationFrame(detect);
      } catch {
        fail('The pose model could not load. Check your internet connection and try again.');
      }
    }

    start();
    return () => {
      if (!disposed) stop();
    };
  }, [exercise, onFrame, onError]);

  return (
    <>
      <video ref={videoRef} muted playsInline style={layer} />
      <canvas ref={canvasRef} aria-hidden="true" style={{ ...layer, pointerEvents: 'none' }} />
    </>
  );
}

function drawPose(ctx, points, width, height, sides) {
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
