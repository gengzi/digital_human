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
      onClose();
    }
  };

  return (
    <div className="absolute top-20 left-4 bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700 w-64 p-4 shadow-xl z-20">
      <h4 className="text-sm font-bold mb-3 text-white">选择背景</h4>
      
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => colorInputRef.current?.click()}
          className="w-full text-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          <i className="fas fa-palette mr-2"></i>选择颜色
          <input 
            ref={colorInputRef} 
            type="color" 
            className="absolute opacity-0 w-0 h-0"
            defaultValue="#f0e6d2"
            onInput={(e) => onBackgroundChange({ type: 'color', value: (e.target as HTMLInputElement).value })}
          />
        </button>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          <i className="fas fa-upload mr-2"></i>上传文件
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
  );
};
