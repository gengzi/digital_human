import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GeminiService } from './services/geminiService';
import { ControlPanel } from './components/ControlPanel';
import { BackgroundPanel } from './components/BackgroundPanel';
import { DigitalHuman } from './components/DigitalHuman';
import { ConnectionState, Message, AnimationControl, MorphTargetControl, BoneControl, Background } from './types';

export default function App() {
  // Use local default.glb file from public folder
  const [modelUrl, setModelUrl] = useState<string | null>('/default.glb');
  
  // Default to a fresh bright gradient background
  const [background, setBackground] = useState<Background>({ 
    type: 'gradient', 
    value: 'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)' 
  });
  
  const [isBgPanelOpen, setIsBgPanelOpen] = useState(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [animations, setAnimations] = useState<AnimationControl[]>([]);
  const [morphs, setMorphs] = useState<MorphTargetControl[]>([]);
  const [boneControls, setBoneControls] = useState<BoneControl[]>([]);
  const [isDebuggingBones, setIsDebuggingBones] = useState(false);

  // New state to control the DigitalHuman component
  const [textToSpeak, setTextToSpeak] = useState<string>('');
  const [audioToPlay, setAudioToPlay] = useState<string>('');

  const geminiRef = useRef<GeminiService | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  const connectionStateText: Record<ConnectionState, string> = {
      [ConnectionState.DISCONNECTED]: '未连接',
      [ConnectionState.CONNECTING]: '连接中',
      [ConnectionState.CONNECTED]: '已连接',
      [ConnectionState.ERROR]: '错误',
  }

  useEffect(() => {
    isMounted.current = true;
    geminiRef.current = new GeminiService(
      (state) => { if(isMounted.current) setConnectionState(state) },
      (msg) => { if(isMounted.current) setMessages(prev => [...prev, msg]) },
      (audioChunk) => { if(isMounted.current) setAudioToPlay(audioChunk) }
    );

    return () => {
      isMounted.current = false;
      geminiRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAvatarReady = useCallback(({ animations, morphs, bones }: { animations: AnimationControl[], morphs: MorphTargetControl[], bones: BoneControl[] }) => {
      setAnimations(animations);
      setMorphs(morphs);
      setBoneControls(bones);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const currentUrl = modelUrl;
      // Only revoke if it was a blob url we created, not the default string
      if (currentUrl && currentUrl.startsWith('blob:')) {
          URL.revokeObjectURL(currentUrl);
      }
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
    
    const history = [...messages];
    
    setMessages(prev => [...prev, userMsg]);
    const currentInput = inputText;
    setInputText('');

    try {
      const responseText = await geminiRef.current.sendMessage(currentInput, history);
      
      // Extremely defensive string conversion to prevent React Error #31
      let safeText = "无回应";
      if (typeof responseText === 'string') {
          safeText = responseText;
      } else if (responseText !== null && responseText !== undefined) {
          try {
             // If it's an object, try to stringify it, otherwise cast
             safeText = typeof responseText === 'object' ? JSON.stringify(responseText) : String(responseText);
          } catch {
              safeText = "Response Error";
          }
      }

      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: safeText, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      setTextToSpeak(safeText);
    } catch (e) { 
        console.error(e);
        const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: "抱歉，发生了一些错误。", timestamp: new Date() };
        setMessages(prev => [...prev, errorMsg]);
    }
  };

  const renderSafeMessage = (content: any): string => {
      if (content === null || content === undefined) return '';
      if (typeof content === 'string') return content;
      if (typeof content === 'number') return content.toString();
      if (typeof content === 'boolean') return content ? 'true' : 'false';
      try {
          return JSON.stringify(content);
      } catch {
          return '[Invalid Content]';
      }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white font-sans">
      
      <DigitalHuman
        apiKey={process.env.API_KEY || ''}
        modelUrl={modelUrl}
        background={background}
        textToSpeak={textToSpeak}
        audioToPlay={audioToPlay}
        onReady={handleAvatarReady}
        isDebuggingBones={isDebuggingBones}
        className="absolute inset-0 z-0"
      />

      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6">
        
        <div className="flex justify-between items-start pointer-events-auto relative">
          <div className="relative bg-gray-900/90 backdrop-blur p-4 rounded-xl border border-gray-700 shadow-2xl z-20">
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-3">
               Gemini 3D 数字人
             </h1>
             <div className="flex gap-2">
                <input type="file" accept=".glb,.gltf" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-xs font-medium transition-colors border border-gray-600">
                  <i className="fas fa-upload text-blue-400"></i> 模型
                </button>
                <button 
                  onClick={() => setIsBgPanelOpen(!isBgPanelOpen)} 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-gray-600 ${isBgPanelOpen ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  <i className="fas fa-image text-purple-400"></i> 背景
                </button>
             </div>
             
             {isBgPanelOpen && (
               <BackgroundPanel 
                  onBackgroundChange={setBackground} 
                  onClose={() => setIsBgPanelOpen(false)} 
               />
             )}
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
                    <h2 className="text-2xl font-bold mb-2">初始化数字人</h2>
                    <p className="text-gray-400 mb-6">请上传 .glb 文件开始。为了获得最佳的口型同步效果，请使用包含标准混合形状 (ARKit) 的模型。</p>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full transition transform hover:scale-105">
                        选择 GLB 文件
                    </button>
                    <div className="mt-4 text-xs text-gray-500">
                       没有模型？可以从 ReadyPlayerMe 下载。
                    </div>
                </div>
            </div>
        )}
        
        <div className="w-full flex justify-center pointer-events-auto">
          <div className="w-full max-w-2xl flex flex-col gap-2 items-center">
            <div className={`w-full overflow-hidden flex flex-col transition-all duration-300 ${messages.length === 0 ? 'h-0 opacity-0 md:h-80 md:opacity-100' : 'h-64 md:h-80'}`}>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm shadow-md ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                                {renderSafeMessage(m.text)}
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
            </div>

            <div className="w-full max-w-lg flex flex-col gap-2">
                <div className="flex items-center justify-center px-2 pt-1 h-6">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                          connectionState === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' :
                          connectionState === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-bounce' : 'bg-red-500'}`} />
                      <span className="text-xs font-mono uppercase text-gray-700">{connectionStateText[connectionState]}</span>
                   </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={handleConnectToggle} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${connectionState === ConnectionState.CONNECTED ? 'bg-red-100 text-red-600 border border-red-300 hover:bg-red-200' : 'bg-white/50 backdrop-blur-sm text-gray-800 hover:bg-white/80 border border-white/20'}`} title={connectionState === ConnectionState.CONNECTED ? "断开语音" : "开始语音聊天"}>
                        <i className={`fas ${connectionState === ConnectionState.CONNECTED ? 'fa-phone-slash' : 'fa-microphone'}`}></i>
                    </button>

                    <div className="flex-1 relative">
                        <input type="text" className="w-full h-12 bg-white/50 backdrop-blur-sm border border-white/20 rounded-full pl-5 pr-12 text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-md" placeholder="输入消息..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendText()} disabled={connectionState === ConnectionState.CONNECTED} />
                        <button onClick={handleSendText} disabled={!inputText.trim() || connectionState === ConnectionState.CONNECTED} className="absolute right-1 top-1 w-10 h-10 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}