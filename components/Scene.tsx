import React, { Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, Sky, Html, useProgress, useTexture, Plane } from '@react-three/drei';
import { Texture } from 'three';
import { Avatar } from './Avatar';
import { AnimationControl, MorphTargetControl, BoneControl, Background } from '../types';

interface SceneProps {
  modelUrl: string | null;
  background: Background;
  audioLevel: number;
  onAvatarReady: (anims: AnimationControl[], morphs: MorphTargetControl[], bones: BoneControl[]) => void;
  isDebuggingBones: boolean;
}

// Simple Error Boundary to catch GLTF loading errors
class AvatarErrorBoundary extends Component<{ children: ReactNode, fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Avatar Error:", error, info);
  }
  componentDidUpdate(prevProps: { children: ReactNode }) {
      if (prevProps.children !== this.props.children) {
          this.setState({ hasError: false });
      }
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
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

// List of standard Drei environment presets to distinguish from file URLs
const PRESETS = ['apartment', 'city', 'dawn', 'forest', 'lobby', 'night', 'park', 'studio', 'sunset', 'warehouse'];

function BackgroundRenderer({ background }: { background: Background }) {
  switch (background.type) {
    case 'color':
      return (
        <>
          <color attach="background" args={[background.value]} />
          {/* Use a neutral environment for lighting so the color pop isn't washed out, but the model is lit */}
          <Environment preset="city" /> 
        </>
      );
    case 'gradient':
      // For gradient, we don't attach a background color to the scene.
      // We rely on the transparent Canvas and the parent div's CSS background.
      // We still need lighting.
      return <Environment preset="city" />;
    case 'image':
      // The useTexture hook is now safely called inside this component
      return <ImageBackground url={background.value} />;
    case 'hdri':
      // Check if the value is one of the built-in presets
      if (PRESETS.includes(background.value)) {
          return <Environment preset={background.value as any} background />;
      }
      // Otherwise treat it as a URL/Path
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
  // Determine CSS background for gradients
  const containerStyle = background.type === 'gradient' 
    ? { background: background.value }
    : { backgroundColor: 'black' };

  return (
    <div className="absolute inset-0 w-full h-full" style={containerStyle}>
      {/* Enable alpha on Canvas to let CSS background show through when needed */}
      <Canvas shadows camera={{ position: [0.2, 0.2, 3.8], fov: 30 }} gl={{ alpha: true }}>
        
        <Suspense fallback={null}>
            <BackgroundRenderer background={background} />
        </Suspense>
        
        <ambientLight intensity={0.6} />
        <directionalLight 
            position={[10, 10, 5]} 
            intensity={2} 
            color="#ffffff" 
            castShadow 
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
        />
        
        <AvatarErrorBoundary 
          fallback={
            <Html center>
                <div className="bg-red-900/80 p-4 rounded-xl border border-red-500 backdrop-blur-sm max-w-xs text-center">
                    <div className="text-2xl text-red-300 mb-2"><i className="fas fa-exclamation-triangle"></i></div>
                    <p className="text-white font-bold mb-1">无法加载模型</p>
                    <p className="text-gray-300 text-xs mb-3">404 未找到或格式错误。</p>
                    <div className="text-gray-400 text-[10px] text-left space-y-1 bg-black/30 p-2 rounded">
                        <p>1. 如果使用本地文件，请将其放入 <span className="text-yellow-300 font-mono">public</span> 文件夹。</p>
                        <p>2. 或者使用 "上传模型" 按钮手动选择文件。</p>
                    </div>
                </div>
            </Html>
          }
        >
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
        </AvatarErrorBoundary>
        
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