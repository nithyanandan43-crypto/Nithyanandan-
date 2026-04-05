import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private sampleRate: number = 24000;
  private onVolumeChange?: (volume: number) => void;

  constructor(sampleRate: number = 24000, onVolumeChange?: (volume: number) => void) {
    this.sampleRate = sampleRate;
    this.onVolumeChange = onVolumeChange;
  }

  async start() {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.nextStartTime = this.audioContext.currentTime;
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  addChunk(base64Data: string) {
    if (!this.audioContext) return;

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const pcmData = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(pcmData.length);
    
    let sum = 0;
    for (let i = 0; i < pcmData.length; i++) {
      const val = pcmData[i] / 32768.0;
      float32Data[i] = val;
      sum += val * val;
    }
    
    const rms = Math.sqrt(sum / pcmData.length);
    this.onVolumeChange?.(rms);

    const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
    
    // Reset volume after the chunk finishes
    setTimeout(() => {
      if (this.audioContext && this.audioContext.currentTime >= startTime + audioBuffer.duration) {
        this.onVolumeChange?.(0);
      }
    }, audioBuffer.duration * 1000);
  }
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioData: (base64Data: string) => void;
  private onVolumeChange?: (volume: number) => void;

  constructor(onAudioData: (base64Data: string) => void, onVolumeChange?: (volume: number) => void) {
    this.onAudioData = onAudioData;
    this.onVolumeChange = onVolumeChange;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.stream);
    
    // Using ScriptProcessorNode for simplicity in this environment, 
    // though AudioWorklet is generally preferred.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume (RMS)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolumeChange?.(rms);

      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
      }
      
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
      this.onAudioData(base64Data);
    };
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}
