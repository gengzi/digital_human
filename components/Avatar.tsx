import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkinnedMesh, Bone, MathUtils } from 'three';
import { AnimationControl, MorphTargetControl, BoneControl } from '../types';

// Fix for missing R3F JSX types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      primitive: any;
    }
  }
}

interface AvatarProps {
  url: string;
  audioLevel: number; // 0 to 1
  onControlsReady: (anims: AnimationControl[], morphs: MorphTargetControl[], bones: BoneControl[]) => void;
  isDebuggingBones: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ url, audioLevel, onControlsReady, isDebuggingBones }) => {
  const { scene, animations } = useGLTF(url);
  const group = useRef<any>(null);
  const { actions, names } = useAnimations(animations, group);
  
  const [blinkState, setBlinkState] = useState({ isBlinking: false, nextBlink: 2000 });
  const smoothAudio = useRef(0);

  const headMesh = useMemo(() => {
    let targetMesh: SkinnedMesh | null = null;
    scene.traverse((node: any) => {
      if (node.isSkinnedMesh && (node.name.includes('Wolf3D_Head') || node.name.includes('Wolf3D_Avatar'))) {
        targetMesh = node;
      }
    });
    if (!targetMesh) {
        scene.traverse((node: any) => {
            if (!targetMesh && node.isSkinnedMesh && node.morphTargetDictionary) {
                targetMesh = node;
            }
        });
    }
    return targetMesh;
  }, [scene]);

  const bones = useMemo(() => {
    const b: Record<string, Bone | null> = {
        neck: null, head: null, spine: null, hips: null,
        leftArm: null, leftForeArm: null, leftHand: null, leftShoulder: null,
        rightArm: null, rightForeArm: null, rightHand: null, rightShoulder: null
    };
    scene.traverse((node: any) => {
        if (!node.isBone) return;
        const name = node.name.toLowerCase();
        const is = (n: string) => name.includes(n);

        if (is('head')) b.head = node;
        else if (is('neck')) b.neck = node;
        else if (is('spine2') || (is('spine') && !b.spine)) b.spine = node;
        else if (is('hips')) b.hips = node;
        else if (is('left') && is('shoulder')) b.leftShoulder = node;
        else if (is('left') && is('forearm')) b.leftForeArm = node;
        else if (is('left') && is('hand')) b.leftHand = node;
        else if (is('left') && is('arm')) b.leftArm = node;
        else if (is('right') && is('shoulder')) b.rightShoulder = node;
        else if (is('right') && is('forearm')) b.rightForeArm = node;
        else if (is('right') && is('hand')) b.rightHand = node;
        else if (is('right') && is('arm')) b.rightArm = node;
    });
    return b;
  }, [scene]);

  useEffect(() => {
    // --- Set Initial Relaxed Pose to prevent T-Pose flash ---
    if (bones.leftArm) {
      bones.leftArm.rotation.x = MathUtils.degToRad(61);
      bones.leftArm.rotation.y = MathUtils.degToRad(-20);
      bones.leftArm.rotation.z = MathUtils.degToRad(-8);
    }
    if (bones.leftForeArm) {
      bones.leftForeArm.rotation.z = MathUtils.degToRad(15);
    }
    if (bones.rightArm) {
      bones.rightArm.rotation.x = MathUtils.degToRad(61);
      bones.rightArm.rotation.y = MathUtils.degToRad(20);
      bones.rightArm.rotation.z = MathUtils.degToRad(14);
    }
    if (bones.rightForeArm) {
      bones.rightForeArm.rotation.z = MathUtils.degToRad(-15);
    }
    // --- End Initial Pose Setup ---

    const animControls = names.map(name => ({
      name,
      play: () => { 
          names.forEach(n => actions[n]?.fadeOut(0.5)); 
          const action = actions[name];
          if (action) { action.reset().fadeIn(0.5).play(); }
      },
      stop: () => actions[name]?.fadeOut(0.5),
      isActive: false
    }));

    const morphControls: MorphTargetControl[] = [];
    if (headMesh && headMesh.morphTargetDictionary) {
      Object.entries(headMesh.morphTargetDictionary).forEach(([name, index]) => {
        morphControls.push({ name, index: index as number, value: 0 });
      });
    }

    const relevantBones = ['leftArm', 'leftForeArm', 'rightArm', 'rightForeArm', 'spine', 'head'];
    const boneControls: BoneControl[] = Object.entries(bones)
      .filter(([name, bone]) => bone && relevantBones.includes(name))
      .map(([name, bone]) => ({
        name,
        setRotation: (axis, valueInDegrees) => {
          if (bone) {
            (bone as Bone).rotation[axis] = MathUtils.degToRad(valueInDegrees);
          }
        },
      }));

    onControlsReady(animControls, morphControls, boneControls);
    
    const idleAnim = names.find(n => /idle|stand|wait/i.test(n));
    if (idleAnim) { actions[idleAnim]?.reset().fadeIn(0.5).play(); }
    
  }, [actions, names, headMesh, onControlsReady, bones]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    smoothAudio.current = MathUtils.lerp(smoothAudio.current, audioLevel, 0.2);
    const intensity = smoothAudio.current;
    const isTalking = intensity > 0.05;

    if (headMesh?.morphTargetDictionary && headMesh.morphTargetInfluences) {
        // --- Lip Sync ---
        const mouthTargets = ['viseme_aa', 'jawOpen', 'mouthOpen', 'mouth_open'];
        const targetIndex = mouthTargets.map(name => headMesh.morphTargetDictionary![name]).find(i => i !== undefined);
        if (targetIndex !== undefined) {
            headMesh.morphTargetInfluences[targetIndex] = MathUtils.lerp(headMesh.morphTargetInfluences[targetIndex], intensity * 1.2, 0.4);
        }

        // --- Default Smile Expression ---
        const smileTargets = ['mouthSmile', 'mouthSmileLeft', 'mouthSmileRight', 'smile'];
        smileTargets.forEach(name => {
            const idx = headMesh.morphTargetDictionary![name];
            if (idx !== undefined) {
                headMesh.morphTargetInfluences![idx] = MathUtils.lerp(headMesh.morphTargetInfluences![idx], 0.4, 0.1);
            }
        });

        // --- Blinking ---
        if (!blinkState.isBlinking && t * 1000 > blinkState.nextBlink) {
            setBlinkState(prev => ({ ...prev, isBlinking: true }));
        }
        if (blinkState.isBlinking) {
            const blinkDuration = 150;
            const progress = (t * 1000 - blinkState.nextBlink) / blinkDuration;
            let value = progress < 0.5 ? progress * 2 : (progress < 1.0 ? 2 - progress * 2 : 0);
            if (progress >= 1.0) {
              setBlinkState({ isBlinking: false, nextBlink: t * 1000 + 2000 + Math.random() * 4000 });
            }
            ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed', 'blink'].forEach(name => {
                const idx = headMesh.morphTargetDictionary![name];
                if (idx !== undefined) headMesh.morphTargetInfluences![idx] = value;
            });
        }
        
        // --- Dynamic Expressions while Talking ---
        const expressionTargets = {
            browInnerUp: Math.sin(t * 1.5) * 0.1 + 0.1,
            cheekSquintLeft: Math.sin(t * 2.1) * 0.1 + 0.1,
            cheekSquintRight: Math.sin(t * 2.3) * 0.1 + 0.1,
        };

        Object.entries(expressionTargets).forEach(([name, targetValue]) => {
            const idx = headMesh.morphTargetDictionary![name];
            if (idx !== undefined) {
                const currentValue = headMesh.morphTargetInfluences![idx];
                const finalValue = isTalking ? targetValue : 0;
                headMesh.morphTargetInfluences![idx] = MathUtils.lerp(currentValue, finalValue, 0.1);
            }
        });
    }

    const isAnyAnimPlaying = names.some(n => actions[n]?.isRunning() && actions[n]!.getEffectiveWeight() > 0.1);

    if (!isAnyAnimPlaying && !isDebuggingBones) {
        const LERP_SPEED = 0.1;
        
        // --- Shared Idle/Breathing Motion ---
        const breath = Math.sin(t * 1.5) * 0.01;
        if (bones.spine) {
             bones.spine.rotation.x = MathUtils.lerp(bones.spine.rotation.x, breath, LERP_SPEED);
        }
        if (bones.head) {
             bones.head.rotation.x = MathUtils.lerp(bones.head.rotation.x, breath * 2, LERP_SPEED);
             bones.head.rotation.y = MathUtils.lerp(bones.head.rotation.y, Math.sin(t * 0.5) * 0.05, LERP_SPEED);
        }

        // --- Talking vs. Idle Hand Gestures ---
        let lArm = { x: 61, y: -20, z: -8 };
        let lForeArm = { z: 15 };
        let rArm = { x: 61, y: 20, z: 14 };
        let rForeArm = { z: -15 };

        if (isTalking) {
            const gestureTime = t * 1.2;
            rArm.x = 40 + Math.sin(gestureTime) * 10;
            rArm.y = 25 + Math.cos(gestureTime * 0.8) * 5;
            rArm.z = -10 + Math.sin(gestureTime) * 15;
            rForeArm.z = -40 + Math.cos(gestureTime * 1.2) * 20;

            lArm.x = 50 + Math.sin(gestureTime * 0.7) * 5;
            lArm.z = -5 + Math.cos(gestureTime * 0.9) * 5;
            lForeArm.z = 20;
        }

        if (bones.leftArm) {
          bones.leftArm.rotation.x = MathUtils.lerp(bones.leftArm.rotation.x, MathUtils.degToRad(lArm.x), LERP_SPEED);
          bones.leftArm.rotation.y = MathUtils.lerp(bones.leftArm.rotation.y, MathUtils.degToRad(lArm.y), LERP_SPEED);
          bones.leftArm.rotation.z = MathUtils.lerp(bones.leftArm.rotation.z, MathUtils.degToRad(lArm.z), LERP_SPEED);
        }
        if (bones.leftForeArm) {
            bones.leftForeArm.rotation.z = MathUtils.lerp(bones.leftForeArm.rotation.z, MathUtils.degToRad(lForeArm.z), LERP_SPEED);
        }
        
        if (bones.rightArm) {
          bones.rightArm.rotation.x = MathUtils.lerp(bones.rightArm.rotation.x, MathUtils.degToRad(rArm.x), LERP_SPEED);
          bones.rightArm.rotation.y = MathUtils.lerp(bones.rightArm.rotation.y, MathUtils.degToRad(rArm.y), LERP_SPEED);
          bones.rightArm.rotation.z = MathUtils.lerp(bones.rightArm.rotation.z, MathUtils.degToRad(rArm.z), LERP_SPEED);
        }
        if (bones.rightForeArm) {
            bones.rightForeArm.rotation.z = MathUtils.lerp(bones.rightForeArm.rotation.z, MathUtils.degToRad(rForeArm.z), LERP_SPEED);
        }
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};