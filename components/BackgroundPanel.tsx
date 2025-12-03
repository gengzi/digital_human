import React, { useRef } from 'react';
import { Background } from '../types';

interface BackgroundPanelProps {
  onBackgroundChange: (background: Background) => void;
  onClose: () => void;
}

export const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ onBackgroundChange, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const type = file.name.endsWith('.hdr') ? 'hdri' : 'image';
      onBackgroundChange({ type, value: url });
      onClose(); // Optional: close on selection
    }
  };

  const PresetButton = ({ icon, label, onClick, color, gradient }: { icon?: string, label: string, onClick: () => void, color?: string, gradient?: string }) => (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 transition-all group"
    >
      <div className="w-8 h-8 rounded-full mb-1 flex items-center justify-center text-lg overflow-hidden relative shadow-sm" style={{ background: gradient || color || '#374151' }}>
        {/* If color/gradient is provided, just show it. If not, show icon. */}
        {(color || gradient) ? (
            <div className="w-full h-full" />
        ) : (
            <i className={`fas ${icon} text-gray-300 group-hover:text-white`}></i>
        )}
      </div>
      <span className="text-[10px] text-gray-400 group-hover:text-white font-medium">{label}</span>
    </button>
  );

  return (
    <div className="absolute top-full left-0 mt-2 bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700 w-72 shadow-2xl z-50 flex flex-col max-h-[70vh]">
      <div className="flex justify-between items-center p-4 border-b border-gray-800 flex-shrink-0">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">背景设置</h4>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><i className="fas fa-times"></i></button>
      </div>
      
      <div className="overflow-y-auto p-4 space-y-5 custom-scrollbar">
          
          {/* Gradients */}
          <div>
            <span className="text-xs font-semibold text-gray-500 mb-2 block uppercase">渐变色</span>
            <div className="grid grid-cols-3 gap-2">
                <PresetButton 
                    gradient="linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)" 
                    label="清新薄荷" 
                    onClick={() => onBackgroundChange({ type: 'gradient', value: 'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)' })} 
                />
                <PresetButton 
                    gradient="linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)" 
                    label="温暖夕阳" 
                    onClick={() => onBackgroundChange({ type: 'gradient', value: 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)' })} 
                />
                <PresetButton 
                    gradient="linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)" 
                    label="梦幻紫蓝" 
                    onClick={() => onBackgroundChange({ type: 'gradient', value: 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)' })} 
                />
            </div>
          </div>

          {/* Nature */}
          <div>
            <span className="text-xs font-semibold text-gray-500 mb-2 block uppercase">大自然</span>
            <div className="grid grid-cols-3 gap-2">
                <PresetButton icon="fa-tree" label="森林" onClick={() => onBackgroundChange({ type: 'hdri', value: 'forest' })} />
                <PresetButton icon="fa-sun" label="公园" onClick={() => onBackgroundChange({ type: 'hdri', value: 'park' })} />
                <PresetButton icon="fa-cloud-sun" label="户外" onClick={() => onBackgroundChange({ type: 'hdri', value: 'city' })} />
            </div>
          </div>

          {/* Sci-Fi */}
          <div>
            <span className="text-xs font-semibold text-gray-500 mb-2 block uppercase">科幻未来</span>
            <div className="grid grid-cols-3 gap-2">
                <PresetButton icon="fa-microchip" label="实验室" onClick={() => onBackgroundChange({ type: 'hdri', value: 'studio' })} />
                <PresetButton icon="fa-moon" label="赛博夜" onClick={() => onBackgroundChange({ type: 'hdri', value: 'night' })} />
                <PresetButton color="#050510" label="深空" onClick={() => onBackgroundChange({ type: 'color', value: '#050510' })} />
            </div>
          </div>

          {/* Comic/Pop */}
          <div>
            <span className="text-xs font-semibold text-gray-500 mb-2 block uppercase">纯色</span>
            <div className="grid grid-cols-3 gap-2">
                <PresetButton color="#F2C94C" label="活力黄" onClick={() => onBackgroundChange({ type: 'color', value: '#F2C94C' })} />
                <PresetButton color="#9B51E0" label="电光紫" onClick={() => onBackgroundChange({ type: 'color', value: '#9B51E0' })} />
                <PresetButton color="#111" label="纯黑" onClick={() => onBackgroundChange({ type: 'color', value: '#111111' })} />
            </div>
          </div>

          {/* Custom */}
          <div>
            <span className="text-xs font-semibold text-gray-500 mb-2 block uppercase">自定义</span>
            <div className="flex gap-2">
                <button 
                onClick={() => colorInputRef.current?.click()}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-xs border border-gray-700 text-gray-300 transition-colors"
                >
                <i className="fas fa-palette mr-1"></i> 选色
                <input 
                    ref={colorInputRef} 
                    type="color" 
                    className="absolute opacity-0 w-0 h-0"
                    onChange={(e) => onBackgroundChange({ type: 'color', value: (e.target as HTMLInputElement).value })}
                />
                </button>
                <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-xs border border-gray-700 text-gray-300 transition-colors"
                >
                <i className="fas fa-upload mr-1"></i> 图片
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".png,.jpg,.jpeg,.hdr"
                    onChange={handleFileUpload}
                />
                </button>
            </div>
          </div>
      </div>
    </div>
  );
};