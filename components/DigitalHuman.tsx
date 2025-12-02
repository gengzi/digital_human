import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Scene } from './Scene';
import { AnimationControl, MorphTargetControl, BoneControl, Background } from '../types';
import { decode, decodeAudioData } from '../services/audioUtils';

// --- Internal TTS & Audio Service ---
class AudioService {
  private ai: GoogleGenAI;
  private outputAudioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime = 0;
  private onAudioLevelChange: (level: number) => void;
  private isAnalysisLoopRunning = false;
  
  constructor(apiKey: string, onAudioLevelChange: (level: number) => void) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onAudioLevelChange = onAudioLevelChange;
  }

  private async initializeAudioContext() {
    if (!this.outputAudioContext) {
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.analyzer = this.outputAudioContext.createAnalyser();
      this.analyzer.fftSize = 256;
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.analyzer);
      this.analyzer.connect(this.outputAudioContext.destination);
      if (!this.isAnalysisLoopRunning) {
        this.startAnalysisLoop();
      }
    }
    if (this.outputAudioContext.state === 'suspended') {
      await this.outputAudioContext.resume();
    }
  }

  async playAudio(base64Audio: string) {
    await this.initializeAudioContext();

    if (this.outputAudioContext!.currentTime > this.nextStartTime) {
      this.nextStartTime = this.outputAudioContext!.currentTime;
    }

    try {
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        this.outputAudioContext!,
        24000,
        1
      );
      
      const source = this.outputAudioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode!);
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
    } catch (e) {
      console.error("Error decoding audio data", e);
    }
  }

  async generateAndPlayTTS(text: string) {
    try {
      const ttsResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      
      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        await this.playAudio(audioData);
      }
    } catch (e) {
      console.warn("TTS generation failed.", e);
    }
  }

  private startAnalysisLoop() {
    this.isAnalysisLoopRunning = true;
    const loop = () => {
      if (this.analyzer && this.outputAudioContext?.state === 'running') {
        const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
        this.analyzer.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        this.onAudioLevelChange(Math.min(1, rms * 8));
      } else {
        this.onAudioLevelChange(0);
      }
      requestAnimationFrame(loop);
    };
    loop();
  }
}

// --- Component Props ---
interface DigitalHumanProps {
  apiKey: string;
  modelUrl?: string;
  background: Background;
  textToSpeak?: string;
  audioToPlay?: string; // base64 pcm audio
  className?: string;
  onReady?: (controls: { animations: AnimationControl[], morphs: MorphTargetControl[], bones: BoneControl[] }) => void;
  isDebuggingBones?: boolean;
}

// --- The Component ---
export const DigitalHuman: React.FC<DigitalHumanProps> = ({
  apiKey,
  modelUrl,
  background,
  textToSpeak,
  audioToPlay,
  className,
  onReady,
  isDebuggingBones = false
}) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioServiceRef = useRef<AudioService | null>(null);

  // Initialize the audio service once with the API key
  useEffect(() => {
    if (apiKey) {
      audioServiceRef.current = new AudioService(apiKey, setAudioLevel);
    }
  }, [apiKey]);

  // Handle Text-to-Speech requests
  useEffect(() => {
    if (textToSpeak && audioServiceRef.current) {
      audioServiceRef.current.generateAndPlayTTS(textToSpeak);
    }
  }, [textToSpeak]);
  
  // Handle direct audio playback requests
  useEffect(() => {
      if (audioToPlay && audioServiceRef.current) {
          audioServiceRef.current.playAudio(audioToPlay);
      }
  }, [audioToPlay]);

  const handleAvatarReady = useCallback((anims: AnimationControl[], morphs: MorphTargetControl[], bones: BoneControl[]) => {
      if (onReady) {
        onReady({ animations: anims, morphs, bones });
      }
  }, [onReady]);

  return (
    <div className={className || 'absolute inset-0 w-full h-full'}>
      <Scene 
        modelUrl={modelUrl || null} 
        background={background}
        audioLevel={audioLevel}
        onAvatarReady={handleAvatarReady}
        isDebuggingBones={isDebuggingBones}
      />
    </div>
  );
};
