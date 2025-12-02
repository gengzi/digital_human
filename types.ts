export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AnimationControl {
  name: string;
  play: () => void;
  stop: () => void;
  isActive: boolean;
}

export interface MorphTargetControl {
  name: string;
  value: number; // 0 to 1
  index: number;
}
