import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from './audioUtils';
import { ConnectionState, Message } from '../types';

// Constants for Audio
const LIVE_API_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const TEXT_MODEL = 'gemini-2.5-flash';

export class GeminiService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private audioStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private currentSession: Promise<any> | null = null;
  
  // Callbacks
  private onStateChange: (state: ConnectionState) => void;
  private onMessage: (msg: Message) => void;
  private onAudioChunk: (base64Audio: string) => void;

  constructor(
    onStateChange: (state: ConnectionState) => void,
    onMessage: (msg: Message) => void,
    onAudioChunk: (base64Audio: string) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    this.onStateChange = onStateChange;
    this.onMessage = onMessage;
    this.onAudioChunk = onAudioChunk;
  }
 
  // --- Text Chat Capability ---
  async sendMessage(text: string, history: Message[]): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [
          ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text }] }
        ],
      });
      return response.text || "我不太确定如何回应。";
    } catch (error) {
      console.error("Text chat error:", error);
      throw error;
    }
  }

  // --- Live Voice Capability ---
  async connect() {
    this.onStateChange(ConnectionState.CONNECTING);

    try {
      // 1. Get User Media
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Connect to Live API
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
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio) {
        // Pass the audio chunk back to the parent component to handle playback
        this.onAudioChunk(base64Audio);
    }
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
    
    this.onStateChange(ConnectionState.DISCONNECTED);
  }
}