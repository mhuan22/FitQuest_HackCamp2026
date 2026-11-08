import { Linking } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { PoseCameraView } from 'expo-mediapipe-pose';

export function useCameraAccess() {
  const [permission, request] = useCameraPermissions();
  return {
    request: async () => {
      if (!permission?.canAskAgain && permission?.status === 'denied') {
        await Linking.openSettings();
        return false;
      }
      return (await request()).granted;
    },
  };
}

export default function PoseCamera({ exercise, onFrame, onError, onReset }) {
  return (
    <PoseCameraView
      style={{ flex: 1 }}
      cameraFacing="front"
      frameLimit={15}
      callbackFps={15}
      skeleton={{
        bodyParts: exercise === 'curl' ? ['leftArm', 'rightArm'] : ['leftLeg', 'rightLeg'],
        color: '#bbfa75',
      }}
      onCameraConfigured={onReset}
      onLandmark={({ landmarks, additionalData }) =>
        onFrame(landmarks, additionalData.width, additionalData.height, additionalData.receivedAtMs)
      }
      onInferenceError={({ code }) => onError('Camera error (' + code + '). Try starting again.')}
    />
  );
}
