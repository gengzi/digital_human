import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scene } from './components/Scene';
import { GeminiService } from './services/geminiService';
import { ControlPanel } from './components/ControlPanel';
import { ConnectionState, Message, AnimationControl, MorphTargetControl, BoneControl } from './types';

export default function App() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [animations, setAnimations] = useState<AnimationControl[]>([]);
  const [morphs, setMorphs] = useState<MorphTargetControl[]>([]);
  const [boneControls, setBoneControls] = useState<BoneControl[]>([]);
  const [isDebuggingBones, setIsDebuggingBones] = useState(false);

  const geminiRef = useRef<GeminiService | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    geminiRef.current = new GeminiService(
      setConnectionState,
      (msg) => setMessages(prev => [...prev, msg]),
      setAudioLevel
    );
    // FIX: The useEffect cleanup function cannot be async. Wrap the call in braces to ensure it returns void.
    return () => {
      geminiRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAvatarReady = useCallback((anims: AnimationControl[], morphs: MorphTargetControl[], bones: BoneControl[]) => {
      setAnimations(anims);
      setMorphs(morphs);
      setBoneControls(bones);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (modelUrl) URL.revokeObjectURL(modelUrl);
      setModelUrl(URL.createObjectURL(file));
    }
  };

  const handleConnectToggle = () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      geminiRef.current?.disconnect();
    } else {
      geminiRef.current?.connect();
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim() || !geminiRef.current) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: inputText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    try {
      const responseText = await geminiRef.current.sendMessage(inputText, messages);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white font-sans">
      
      <div className="absolute inset-0 z-0">
        <Scene 
            modelUrl={modelUrl} 
            audioLevel={audioLevel}
            onAvatarReady={handleAvatarReady}
            isDebuggingBones={isDebuggingBones}
        />
      </div>

      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6">
        
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-gray-900/80 backdrop-blur p-3 rounded-lg border border-gray-700 shadow-xl">
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
               Gemini Digital Human
             </h1>
             <div className="mt-2 flex gap-2">
                <input type="file" accept=".glb,.gltf" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition">
                  <i className="fas fa-upload mr-1"></i> Change Model
                </button>
             </div>
          </div>
          
          <div className="pointer-events-auto">
             <ControlPanel 
                animations={animations} 
                morphs={morphs} 
                boneControls={boneControls}
                isDebuggingBones={isDebuggingBones}
                onStartDebug={() => setIsDebuggingBones(true)}
                onStopDebug={() => setIsDebuggingBones(false)}
             />
          </div>
        </div>

        {!modelUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-50 bg-black/60 backdrop-blur-sm">
                <div className="text-center p-8 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-md mx-4">
                    <div className="text-6xl text-blue-500 mb-4"><i className="fas fa-cube"></i></div>
                    <h2 className="text-2xl font-bold mb-2">Initialize Digital Human</h2>
                    <p className="text-gray-400 mb-6">Upload a .glb file to begin. For best results, use a model with standard blend shapes (ARKit) for lip sync.</p>
                    {/* FIX: Corrected typo from fileInput_current to fileInputRef.current */}
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full transition transform hover:scale-105">
                        Select GLB File
                    </button>
                    <div className="mt-4 text-xs text-gray-500">
                       Don't have one? Try downloading from ReadyPlayerMe.
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-end pointer-events-auto max-w-5xl mx-auto w-full">
            <div className={`flex-1 w-full md:w-auto bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-700 overflow-hidden flex flex-col transition-all duration-300 ${messages.length === 0 ? 'h-0 opacity-0 md:h-80 md:opacity-100' : 'h-64 md:h-80'}`}>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
            </div>

            <div className="w-full md:w-auto md:min-w-[400px] bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-700 p-2 shadow-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between px-2 pt-1">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                          connectionState === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' :
                          connectionState === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-bounce' : 'bg-red-500'}`} />
                      <span className="text-xs font-mono uppercase text-gray-400">{connectionState}</span>
                   </div>
                   {connectionState === ConnectionState.CONNECTED && (
                       <div className="flex gap-0.5 items-end h-3">
                           {[1,2,3,4,5].map(i => (<div key={i} className="w-1 bg-blue-500 rounded-full transition-all duration-75" style={{ height: `${Math.max(20, audioLevel * 100 * (Math.random() + 0.5))}%` }}></div>))}
                       </div>
                   )}
                </div>

                <div className="flex gap-2">
                    <button onClick={handleConnectToggle} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${connectionState === ConnectionState.CONNECTED ? 'bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500 hover:text-white' : 'bg-blue-600 text-white hover:bg-blue-500'}`} title={connectionState === ConnectionState.CONNECTED ? "Disconnect Voice" : "Start Voice Chat"}>
                        <i className={`fas ${connectionState === ConnectionState.CONNECTED ? 'fa-phone-slash' : 'fa-microphone'}`}></i>
                    </button>

                    <div className="flex-1 relative">
                        <input type="text" className="w-full h-12 bg-gray-800 rounded-full pl-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="Type a message..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendText()} disabled={connectionState === ConnectionState.CONNECTED} />
                        <button onClick={handleSendText} disabled={!inputText.trim() || connectionState === ConnectionState.CONNECTED} className="absolute right-1 top-1 w-10 h-10 rounded-full bg-gray-700 text-gray-300 hover:text-white hover:bg-blue-600 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}