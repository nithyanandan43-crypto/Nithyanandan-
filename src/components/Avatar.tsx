import React from 'react';
import { motion } from 'motion/react';

interface FaceData {
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  jawOpen: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
}

interface AvatarProps {
  faceData: FaceData | null;
  isSpeaking?: boolean;
  volume?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ faceData, isSpeaking, volume = 0 }) => {
  // Default values if no face data is available
  const data = faceData || {
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    jawOpen: 0,
    mouthSmileLeft: 0,
    mouthSmileRight: 0,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
  };

  // Map face data to animations
  const headRotation = {
    rotateY: data.headYaw * 20, // Yaw
    rotateX: -data.headPitch * 20, // Pitch
    rotateZ: data.headRoll * 10, // Roll
  };

  // Eye scaling (1 is open, 0 is closed)
  const leftEyeScaleY = 1 - data.eyeBlinkLeft;
  const rightEyeScaleY = 1 - data.eyeBlinkRight;

  // Mouth scaling
  // If speaking, use volume to add some jitter/movement
  const speakingMouthOpen = isSpeaking ? (0.2 + volume * 0.8) : 0;
  const mouthOpen = Math.max(data.jawOpen, speakingMouthOpen);
  const mouthWidth = 40 + (data.mouthSmileLeft + data.mouthSmileRight) * 10;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-zinc-950 rounded-3xl border border-zinc-800 shadow-inner">
      {/* Background Glow */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute w-64 h-64 bg-blue-500 rounded-full blur-[80px]"
      />

      {/* Avatar Container */}
      <motion.div 
        style={headRotation}
        className="relative w-48 h-48 flex items-center justify-center"
      >
        {/* Head Shape - Stylized sleek AI */}
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          {/* Main Face Plate */}
          <path 
            d="M50,40 Q100,20 150,40 Q180,80 170,140 Q150,180 100,185 Q50,180 30,140 Q20,80 50,40"
            fill="#09090b"
            stroke="#1e293b"
            strokeWidth="2"
          />
          
          {/* Inner Glow/Circuitry lines */}
          <motion.path 
            d="M60,50 Q100,35 140,50 M40,100 Q100,90 160,100 M60,150 Q100,165 140,150"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.5"
            strokeOpacity="0.3"
            animate={{ strokeOpacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Eyes */}
          <g transform="translate(65, 85)">
            <motion.ellipse 
              cx="0" cy="0" rx="12" ry="12"
              fill="#3b82f6"
              style={{ scaleY: leftEyeScaleY }}
              className="drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
            />
            <motion.ellipse 
              cx="0" cy="0" rx="4" ry="4"
              fill="white"
              style={{ scaleY: leftEyeScaleY }}
            />
          </g>

          <g transform="translate(135, 85)">
            <motion.ellipse 
              cx="0" cy="0" rx="12" ry="12"
              fill="#3b82f6"
              style={{ scaleY: rightEyeScaleY }}
              className="drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
            />
            <motion.ellipse 
              cx="0" cy="0" rx="4" ry="4"
              fill="white"
              style={{ scaleY: rightEyeScaleY }}
            />
          </g>

          {/* Mouth */}
          <g transform="translate(100, 145)">
            <motion.path 
              d={`M-${mouthWidth/2},0 Q0,${mouthOpen * 40} ${mouthWidth/2},0`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeLinecap="round"
              className="drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]"
            />
          </g>

          {/* Tech Accents */}
          <motion.circle 
            cx="100" cy="30" r="2" fill="#3b82f6"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </svg>
      </motion.div>

      {/* Status Indicators */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${faceData ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
          {faceData ? 'Sync Active' : 'Waiting for Vision'}
        </span>
      </div>
    </div>
  );
};
