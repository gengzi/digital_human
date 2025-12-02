import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from './audioUtils';
import { ConnectionState, Message } from '../types';

// Constants for Audio
const LIVE_API_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const TEXT_MODEL = 'gemini-2.5-flash';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

export class GeminiService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private audioStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private outputNode: GainNode | null = null;
  private analyzer: AnalyserNode | null = null; // For lip sync visualization
  private nextStartTime = 0;
  private currentSession: Promise<any> | null = null;
  
  // Callbacks
  private onStateChange: (state: ConnectionState) => void;
  private onMessage: (msg: Message) => void;
  private onAudioData: (volume: number) => void; // Callback for driving lip sync

  constructor(
    onStateChange: (state: ConnectionState) => void,
    onMessage: (msg: Message) => void,
    onAudioData: (volume: number) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    this.onStateChange = onStateChange;
    this.onMessage = onMessage;
    this.onAudioData = onAudioData;
  }

  // Helper to initialize audio context if needed and play audio data
  private async playAudioData(base64Audio: string) {
    if (!this.outputAudioContext) {
         this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
         
         // Setup Analyzer chain for Lip Sync
         this.analyzer = this.outputAudioContext.createAnalyser();
         this.analyzer.fftSize = 256;
         this.outputNode = this.outputAudioContext.createGain();
         
         this.outputNode.connect(this.analyzer);
         this.analyzer.connect(this.outputAudioContext.destination);
         
         this.startAnalysisLoop();
    }
    
    if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
    }

    // Reset nextStartTime if playback has fallen behind (e.g. silence for a while)
    if (this.outputAudioContext.currentTime > this.nextStartTime) {
        this.nextStartTime = this.outputAudioContext.currentTime;
    }

    try {
        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            this.outputAudioContext,
            24000,
            1
        );
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode!); 
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
    } catch (e) {
        console.error("Error decoding audio data", e);
    }
  }

  // --- Text Chat Capability with TTS ---
  async sendMessage(text: string, history: Message[]): Promise<string> {
    try {
      // 1. Get Text Response
      const response = await this.ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [
          ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text }] }
        ],
      });
      const responseText = response.text || "我不太确定如何回应。";

      // 2. Generate Audio (TTS) for the response and wait for it to complete
      await this.generateTTS(responseText);

      return responseText;
    } catch (error) {
      console.error("Text chat error:", error);
      throw error;
    }
  }

  private async generateTTS(text: string) {
      try {
          const ttsResponse = await this.ai.models.generateContent({
            model: TTS_MODEL,
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
            },
          });
          
          const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audioData) {
              await this.playAudioData(audioData);
          }
      } catch (e) {
          console.warn("TTS generation failed. Avatar will not speak.", e);
      }
  }

  // --- Live Voice Capability ---
  async connect() {
    this.onStateChange(ConnectionState.CONNECTING);

    try {
      // Initialize output context immediately to handle playback
      if (!this.outputAudioContext) {
          this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          this.analyzer = this.outputAudioContext.createAnalyser();
          this.analyzer.fftSize = 256;
          this.outputNode = this.outputAudioContext.createGain();
          this.outputNode.connect(this.analyzer);
          this.analyzer.connect(this.outputAudioContext.destination);
          this.startAnalysisLoop();
      }

      // 2. Get User Media
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 3. Connect to Live API
      this.currentSession = this.ai.live.connect({
        model: LIVE_API_MODEL,
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleLiveMessage.bind(this),
          onclose: () => this.onStateChange(ConnectionState.DISCONNECTED),
          onerror: (e) => {
            console.error(e);
            this.onStateChange(ConnectionState.ERROR);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: "你是一个乐于助人且富有表现力的3D数字形象。请用简洁和对话的方式回答。",
          // FX: inputAudioTranscription does not accept a text model. It should be an empty object.
          inputAudioTranscription: {}, 
          outputAudioTranscription: {}, 
        },
      });

    } catch (error) {
      console.error("Connection failed", error);
      this.onStateChange(ConnectionState.ERROR);
    }
  }

  private handleOpen() {
    this.onStateChange(ConnectionState.CONNECTED);
    if (!this.inputAudioContext || !this.audioStream) return;

    this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.audioStream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      this.currentSession?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.sourceNode.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleLiveMessage(message: LiveServerMessage) {
    // 1. Handle Audio
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio) {
        await this.playAudioData(base64Audio);
    }

    // 2. Handle Transcription (Simplified)
    if (message.serverContent?.turnComplete) {
       // Logic to finalize text bubble
    }
  }

  private startAnalysisLoop() {
    const loop = () => {
      if (this.analyzer && this.outputAudioContext?.state === 'running') {
        const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
        this.analyzer.getByteTimeDomainData(dataArray);
        
        // Calculate RMS
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        
        // Boost signal for clearer lip movement (clamped 0-1)
        this.onAudioData(Math.min(1, rms * 8));
      } else {
        this.onAudioData(0);
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  async disconnect() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.sourceNode) this.sourceNode.disconnect();
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
    }
    if (this.inputAudioContext) await this.inputAudioContext.close();
    // Don't close outputAudioContext completely to allow re-use or TTS, but maybe suspend
    if (this.outputAudioContext) await this.outputAudioContext.suspend();
    
    this.onStateChange(ConnectionState.DISCONNECTED);
  }
}