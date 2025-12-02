
{/* Fix: Add a triple-slash directive to explicitly include react-three-fiber types.
This resolves errors where JSX elements like `<color>`, `<ambientLight>`, `<directionalLight>`, and `<group>` were not recognized by TypeScript. */}
<reference types="@react-three/fiber" />
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, Sky, Html, useProgress } from '@react-three/drei';
import { Avatar } from './Avatar';
import { AnimationControl, MorphTargetControl, BoneControl } from '../types';

interface SceneProps {
  modelUrl: string | null;
  audioLevel: number;
  onAvatarReady: (anims: AnimationControl[], morphs: MorphTargetControl[], bones: BoneControl[]) => void;
  isDebuggingBones: boolean;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="bg-black/80 px-4 py-2 rounded-lg border border-gray-700 backdrop-blur-sm">
        <p className="text-white font-mono text-sm whitespace-nowrap">
          加载模型中... {progress.toFixed(0)}%
        </p>
      </div>
    </Html>
  );
}

export const Scene: React.FC<SceneProps> = ({ modelUrl, audioLevel, onAvatarReady, isDebuggingBones }) => {
  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <Canvas shadows camera={{ position: [0.2, 0.2, 3.8], fov: 30 }}>
        {/* Warm, sunny background color */}
        <color attach="background" args={['#f0e6d2']} />
        {/* Procedural sunny sky */}
        <Sky sunPosition={[100, 20, 100]} />
        
        {/* Warm, bright lighting to simulate a sunny day */}
        <ambientLight intensity={0.8} />
        <directionalLight 
            position={[10, 10, 5]} 
            intensity={3} 
            color="#ffdcb4" 
            castShadow 
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
        />
        
        {/* Environment for warm reflections */}
        <Environment preset="sunset" />

        <Suspense fallback={<Loader />}>
          {modelUrl && (
            // Avatar repositioned and scaled down further
            <group position={[-0.4, -0.8, 0]}>
               <group scale={0.9}>
                  <Avatar 
                    key={modelUrl} // Force remount when URL changes
                    url={modelUrl} 
                    audioLevel={audioLevel} 
                    onControlsReady={onAvatarReady} 
                    isDebuggingBones={isDebuggingBones}
                  />
               </group>
            </group>
          )}
        </Suspense>
        
        {/* Shadows to ground the character */}
        <ContactShadows resolution={1024} scale={10} blur={1} opacity={0.7} far={10} color="#000000" position={[0, -0.8, 0]} />
        
        <OrbitControls 
            target={[-0.4, 0.3, 0]} 
            minPolarAngle={Math.PI / 4} 
            maxPolarAngle={Math.PI / 1.8}
            minDistance={1.5}
            maxDistance={5}
            enablePan={false}
        />
      </Canvas>
      
      {!modelUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Placeholder for when no model is loaded (handled by UI overlay) */}
        </div>
      )}
    </div>
  );
};