import React, { useState, useRef, useEffect } from 'react';
import { AnimationControl, MorphTargetControl, BoneControl } from '../types';

interface ControlPanelProps {
  animations: AnimationControl[];
  morphs: MorphTargetControl[];
  boneControls: BoneControl[];
  isDebuggingBones: boolean;
  onStartDebug: () => void;
  onStopDebug: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ animations, morphs, boneControls, isDebuggingBones, onStartDebug, onStopDebug }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'anim' | 'morph' | 'bones'>('anim');
  const [sliderValues, setSliderValues] = useState<Record<string, Record<'x'|'y'|'z', number>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Initialize slider values when bone controls are available
    const initialValues: Record<string, Record<'x'|'y'|'z', number>> = {};
    boneControls.forEach(bone => {
        initialValues[bone.name] = { x: 0, y: 0, z: 0 };
    });
    setSliderValues(initialValues);
  }, [boneControls]);


  const handleStopDebug = () => {
    onStopDebug();
    formRef.current?.reset();
    // Reset state values as well
    const initialValues: Record<string, Record<'x'|'y'|'z', number>> = {};
    boneControls.forEach(bone => {
        initialValues[bone.name] = { x: 0, y: 0, z: 0 };
    });
    setSliderValues(initialValues);
  };

  if (animations.length === 0 && morphs.length === 0 && boneControls.length === 0) return null;

  return (
    <div className={`absolute top-4 right-4 bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700 transition-all duration-300 ${isOpen ? 'w-80 h-[80vh]' : 'w-12 h-12 overflow-hidden'}`}>
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="absolute top-0 right-0 w-12 h-12 flex items-center justify-center text-white hover:text-blue-400 z-10"
        >
            <i className={`fas ${isOpen ? 'fa-times' : 'fa-sliders-h'}`}></i>
        </button>

        {isOpen && (
            <div className="p-4 pt-12 h-full flex flex-col">
                <h3 className="text-lg font-bold mb-4 text-white">Avatar Controls</h3>
                
                <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
                    <button onClick={() => setActiveTab('anim')} className={`flex-1 py-1 px-2 rounded ${activeTab === 'anim' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Animations</button>
                    <button onClick={() => setActiveTab('morph')} className={`flex-1 py-1 px-2 rounded ${activeTab === 'morph' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Expressions</button>
                    <button onClick={() => setActiveTab('bones')} className={`flex-1 py-1 px-2 rounded ${activeTab === 'bones' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Bones</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {activeTab === 'anim' && (
                        <div className="space-y-2">
                            {animations.map((anim) => (
                                <button key={anim.name} onClick={() => anim.play()} className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm truncate" title={anim.name}>
                                    <i className="fas fa-play mr-2 text-xs"></i>{anim.name}
                                </button>
                            ))}
                            {animations.length === 0 && <p className="text-gray-500 text-sm">No animations found</p>}
                        </div>
                    )}

                    {activeTab === 'morph' && (
                        <div className="space-y-4">
                            {morphs.map((morph) => (
                                <div key={morph.name} className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400 truncate" title={morph.name}>{morph.name}</label>
                                    <input type="range" min="0" max="1" step="0.01" defaultValue="0" className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                </div>
                            ))}
                             {morphs.length === 0 && <p className="text-gray-500 text-sm">No blend shapes found</p>}
                        </div>
                    )}

                    {activeTab === 'bones' && (
                        <form ref={formRef} className="space-y-4">
                            <div className="p-2 bg-blue-900/30 border border-blue-700 rounded-md text-xs text-blue-200">
                                <i className="fas fa-info-circle mr-2"></i>Manipulating sliders will pause procedural animation.
                            </div>
                            {isDebuggingBones && (
                                <button type="button" onClick={handleStopDebug} className="w-full text-center px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-semibold">
                                    <i className="fas fa-sync-alt mr-2"></i>Re-enable Procedural Pose
                                </button>
                            )}
                            {boneControls.map(bone => (
                                <div key={bone.name} className="p-3 bg-gray-800 rounded-lg">
                                    <p className="font-bold text-sm text-gray-300 capitalize mb-2">{bone.name.replace(/([A-Z])/g, ' $1')}</p>
                                    <div className="space-y-3">
                                        {(['x', 'y', 'z'] as const).map(axis => (
                                            <div key={axis} className="grid grid-cols-5 items-center gap-2">
                                                <label className="text-xs font-mono text-gray-400 uppercase">{axis} Axis</label>
                                                <input type="range" min="-180" max="180" step="1" defaultValue="0" className="col-span-3 w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                                    onInput={(e) => {
                                                        onStartDebug();
                                                        const target = e.target as HTMLInputElement;
                                                        const value = parseFloat(target.value)
                                                        bone.setRotation(axis, value);
                                                        setSliderValues(prev => ({
                                                            ...prev,
                                                            // FIX: Provide a default object with all required properties to satisfy the type.
                                                            [bone.name]: { ...(prev[bone.name] || { x: 0, y: 0, z: 0 }), [axis]: value }
                                                        }));
                                                    }}
                                                />
                                                <span className="text-xs font-mono text-gray-300 text-right w-12">
                                                    {(sliderValues[bone.name]?.[axis] ?? 0).toFixed(0)}°
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {boneControls.length === 0 && <p className="text-gray-500 text-sm">No controllable bones found</p>}
                        </form>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
