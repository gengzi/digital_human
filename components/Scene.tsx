import React, { Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, Sky, Html, useProgress, useTexture, Plane } from '@react-three/drei';
import { Texture } from 'three';
import { Avatar } from './Avatar';
import { AnimationControl, MorphTargetControl, BoneControl, Background } from '../types';

// Fix for missing R3F JSX types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      ambientLight: any;
      directionalLight: any;
      color: any;
      meshBasicMaterial: any;
    }
  }
}

interface SceneProps {
  modelUrl: string | null;
  background: Background;
  audioLevel: number;
  onAvatarReady: (anims: AnimationControl[], morphs: MorphTargetControl[], bones: BoneControl[]) => void;
  isDebuggingBones: boolean;
}

// A dedicated component for the image background to encapsulate the useTexture hook
function ImageBackground({ url }: { url: string }) {
  const texture = useTexture(url);
  const { viewport } = useThree();

  return (
    <>
      <color attach="background" args={['#111']} />
      <Environment preset="city" />
      <Plane args={[viewport.width, viewport.height]} position={[0, 0, -5]}>
        <meshBasicMaterial map={texture as Texture} />
      </Plane>
    </>
  );
}

function BackgroundRenderer({ background }: { background: Background }) {
  switch (background.type) {
    case 'color':
      return (
        <>
          <color attach="background" args={[background.value]} />
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="sunset" />
        </>
      );
    case 'image':
      // The useTexture hook is now safely called inside this component
      return <ImageBackground url={background.value} />;
    case 'hdri':
      return <Environment files={background.value} background />;
    default:
      return <color attach="background" args={['#111']} />;
  }
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

export const Scene: React.FC<SceneProps> = ({ modelUrl, background, audioLevel, onAvatarReady, isDebuggingBones }) => {
  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <Canvas shadows camera={{ position: [0.2, 0.2, 3.8], fov: 30 }}>
        
        <Suspense fallback={null}>
            <BackgroundRenderer background={background} />
        </Suspense>
        
        <ambientLight intensity={0.8} />
        <directionalLight 
            position={[10, 10, 5]} 
            intensity={3} 
            color="#ffdcb4" 
            castShadow 
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
        />
        
        <Suspense fallback={<Loader />}>
          {modelUrl && (
            <group position={[-0.4, -0.8, 0]}>
               <group scale={0.9}>
                  <Avatar 
                    key={modelUrl}
                    url={modelUrl} 
                    audioLevel={audioLevel} 
                    onControlsReady={onAvatarReady} 
                    isDebuggingBones={isDebuggingBones}
                  />
               </group>
            </group>
          )}
        </Suspense>
        
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
    </div>
  );
};