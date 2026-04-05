import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// MediaPipe logs informational messages to console.info/log during initialization and first inference.
// We suppress these globally to avoid confusing users who might see them as errors.
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;
const originalDebug = console.debug;

const filterLogs = (original: any) => (...args: any[]) => {
  const msg = args[0];
  if (typeof msg === 'string' && (
    msg.includes('XNNPACK') || 
    msg.includes('TfLite') || 
    msg.includes('MediaPipe') || 
    msg.includes('delegate') ||
    msg.includes('TensorFlow') ||
    msg.includes('WASM')
  )) {
    // Suppress all noise from these libraries
    return;
  }
  if (original) original(...args);
};

console.log = filterLogs(originalLog);
console.info = filterLogs(originalInfo);
console.warn = filterLogs(originalWarn);
console.error = filterLogs(originalError);
console.debug = filterLogs(originalDebug);

export const useFaceLandmarker = (videoElement: HTMLVideoElement | null) => {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [faceData, setFaceData] = useState<any>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const initFaceLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        setFaceLandmarker(landmarker);
      } catch (err) {
        console.error("Face Landmarker initialization failed:", err);
      }
    };

    initFaceLandmarker();
  }, []);

  useEffect(() => {
    if (!faceLandmarker || !videoElement) return;

    const predict = () => {
      if (videoElement.readyState >= 2) {
        const startTimeMs = performance.now();
        const results = faceLandmarker.detectForVideo(videoElement, startTimeMs);
        processResults(results);
      }
      requestRef.current = requestAnimationFrame(predict);
    };

    const processResults = (results: FaceLandmarkerResult) => {
      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const blendshapes = results.faceBlendshapes[0].categories;
        const data: any = {};
        
        // Map blendshapes to our face data
        blendshapes.forEach((category) => {
          data[category.categoryName] = category.score;
        });

        // Add basic head rotation estimation from landmarks if needed
        // For now, let's just use the blendshapes for expressions
        // And we can estimate rotation from specific landmarks
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          // Simple estimation of head rotation
          // Yaw: distance between nose and ears
          // Pitch: distance between nose and forehead/chin
          // Roll: angle of eyes
          
          // Nose tip: 1, Left eye: 33, Right eye: 263
          const nose = landmarks[1];
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];
          
          data.headYaw = (nose.x - (leftEye.x + rightEye.x) / 2) * 2;
          data.headPitch = (nose.y - (leftEye.y + rightEye.y) / 2) * 2;
          data.headRoll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
        }

        setFaceData(data);
      } else {
        setFaceData(null);
      }
    };

    requestRef.current = requestAnimationFrame(predict);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [faceLandmarker, videoElement]);

  return faceData;
};
