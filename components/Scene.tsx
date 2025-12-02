import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, Center, Resize, Html, useProgress } from '@react-three/drei';
import { Avatar } from './Avatar';
import { AnimationControl, MorphTargetControl } from '../types';

interface SceneProps {
  modelUrl: string | null;
  audioLevel: number;
  onAvatarReady: (anims: AnimationControl[], morphs: MorphTargetControl[]) => void;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="bg-black/80 px-4 py-2 rounded-lg border border-gray-700 backdrop-blur-sm">
        <p className="text-white font-mono text-sm whitespace-nowrap">
          Loading Model... {progress.toFixed(0)}%
        </p>
      </div>
    </Html>
  );
}

export const Scene: React.FC<SceneProps> = ({ modelUrl, audioLevel, onAvatarReady }) => {
  return (
    <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-gray-900 to-black">
      <Canvas shadows camera={{ position: [0, 0.2, 2.5], fov: 35 }}>
        <ambientLight intensity={0.6} />
        <spotLight position={[5, 10, 7]} angle={0.2} penumbra={1} shadow-mapSize={2048} castShadow intensity={1.5} />
        <directionalLight position={[-5, 5, 5]} intensity={0.5} color="#b0c4de" />
        
        <Environment preset="studio" />

        <Suspense fallback={<Loader />}>
          {modelUrl && (
            <Center>
               {/* Resize component ensures the model is always ~1.6 units tall, regardless of original scale */}
               <Resize height={1.6}>
                  <Avatar 
                    key={modelUrl} // Force remount when URL changes
                    url={modelUrl} 
                    audioLevel={audioLevel} 
                    onControlsReady={onAvatarReady} 
                  />
               </Resize>
            </Center>
          )}
        </Suspense>
        
        <ContactShadows resolution={1024} scale={10} blur={2} opacity={0.4} far={10} color="#000000" position={[0, -0.8, 0]} />
        
        <OrbitControls 
            target={[0, 0.3, 0]} 
            minPolarAngle={Math.PI / 4} 
            maxPolarAngle={Math.PI / 1.8}
            minDistance={1}
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