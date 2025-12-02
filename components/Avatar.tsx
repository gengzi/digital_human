import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useFrame, useGraph } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkinnedMesh, Bone, MathUtils, Euler } from 'three';
import { AnimationControl, MorphTargetControl } from '../types';

interface AvatarProps {
  url: string;
  audioLevel: number; // 0 to 1
  onControlsReady: (anims: AnimationControl[], morphs: MorphTargetControl[]) => void;
}

export const Avatar: React.FC<AvatarProps> = ({ url, audioLevel, onControlsReady }) => {
  const { scene, animations } = useGLTF(url);
  const group = useRef<any>();
  const { actions, names } = useAnimations(animations, group);
  
  // State for blinking logic
  const [blinkState, setBlinkState] = useState({ isBlinking: false, nextBlink: 2000 });

  // 1. Find Head Mesh for Expressions
  const headMesh = useMemo(() => {
    const meshes: SkinnedMesh[] = [];
    scene.traverse((node: any) => {
      if (node.isSkinnedMesh && node.morphTargetDictionary && Object.keys(node.morphTargetDictionary).length > 0) {
        meshes.push(node);
      }
    });
    if (meshes.length === 0) return null;
    
    // Prioritize standard names
    const preferred = meshes.find(m => /head|face|wolf3d_avatar/i.test(m.name));
    return preferred || meshes.sort((a, b) => 
        Object.keys(b.morphTargetDictionary!).length - Object.keys(a.morphTargetDictionary!).length
    )[0];
  }, [scene]);

  // 2. Find Bones for Procedural Animation
  const bones = useMemo(() => {
    const b: Record<string, Bone | null> = {
        neck: null, head: null, spine: null, hips: null,
        leftArm: null, leftForeArm: null, rightArm: null, rightForeArm: null
    };

    const findBone = (patterns: RegExp[]) => {
        let found: Bone | null = null;
        scene.traverse((node: any) => {
            if (found) return;
            if (node.isBone && patterns.some(p => p.test(node.name))) {
                found = node;
            }
        });
        return found;
    };

    b.neck = findBone([/neck/i]);
    b.head = findBone([/head/i]);
    b.spine = findBone([/spine/i, /body/i]);
    b.hips = findBone([/hip/i, /pelvis/i]);
    
    b.leftArm = findBone([/left.*arm/i, /l.*arm/i, /left.*shoulder/i]);
    b.leftForeArm = findBone([/left.*forearm/i, /l.*forearm/i, /left.*elbow/i]);
    b.rightArm = findBone([/right.*arm/i, /r.*arm/i, /right.*shoulder/i]);
    b.rightForeArm = findBone([/right.*forearm/i, /r.*forearm/i, /right.*elbow/i]);

    return b;
  }, [scene]);

  // Capture initial rotations for relative movement
  const initialRotations = useRef<Record<string, Euler>>({});
  useEffect(() => {
      Object.entries(bones).forEach(([key, bone]) => {
          if (bone) initialRotations.current[key] = (bone as Bone).rotation.clone();
      });
  }, [bones]);

  // 3. Setup Animations
  useEffect(() => {
    const animControls = names.map(name => ({
      name,
      play: () => { names.forEach(n => actions[n]?.fadeOut(0.5)); actions[name]?.reset().fadeIn(0.5).play(); },
      stop: () => actions[name]?.fadeOut(0.5),
      isActive: false
    }));

    const morphControls: MorphTargetControl[] = [];
    if (headMesh && headMesh.morphTargetDictionary) {
      Object.entries(headMesh.morphTargetDictionary).forEach(([name, index]) => {
        morphControls.push({ name, index: index as number, value: 0 });
      });
    }

    onControlsReady(animControls, morphControls);
    
    // Auto-play Idle
    if (names.length > 0) {
        const idleAnim = names.find(n => /idle|stand|wait/i.test(n)) || names[0];
        actions[idleAnim]?.reset().fadeIn(0.5).play();
    }
  }, [actions, names, headMesh, onControlsReady]);

  // 4. Procedural Loop
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const ms = t * 1000;

    // --- Face Logic ---
    if (headMesh && headMesh.morphTargetDictionary && headMesh.morphTargetInfluences) {
        // Lip Sync
        const mouthTargets = ['viseme_aa', 'viseme_O', 'jawOpen', 'mouthOpen', 'mouth_open'];
        const targetIndex = mouthTargets.map(name => headMesh.morphTargetDictionary![name]).find(i => i !== undefined);
        if (targetIndex !== undefined) {
            const current = headMesh.morphTargetInfluences[targetIndex];
            headMesh.morphTargetInfluences[targetIndex] = MathUtils.lerp(current, audioLevel, 0.3);
        }

        // Brow Raise (on high audio)
        const browTargets = ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'BrowsUp'];
        browTargets.forEach(name => {
            const idx = headMesh.morphTargetDictionary![name];
            if (idx !== undefined) {
                const target = audioLevel > 0.4 ? (audioLevel - 0.4) * 1.2 : 0;
                headMesh.morphTargetInfluences![idx] = MathUtils.lerp(headMesh.morphTargetInfluences![idx], target, 0.1);
            }
        });

        // Blinking
        if (!blinkState.isBlinking && ms > blinkState.nextBlink) {
            setBlinkState(prev => ({ ...prev, isBlinking: true }));
        }

        if (blinkState.isBlinking) {
            const blinkDuration = 150; // ms
            const progress = (ms - blinkState.nextBlink) / blinkDuration;
            
            let value = 0;
            if (progress < 0.5) value = progress * 2;
            else if (progress < 1.0) value = 2 - progress * 2;
            else {
                value = 0;
                setBlinkState({ isBlinking: false, nextBlink: ms + 2000 + Math.random() * 4000 });
            }

            ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed', 'blink'].forEach(name => {
                const idx = headMesh.morphTargetDictionary![name];
                if (idx !== undefined) headMesh.morphTargetInfluences![idx] = value;
            });
        }
    }

    // --- Body & Arm Logic ---
    const isTalking = audioLevel > 0.05;
    const talkIntensity = MathUtils.lerp(0, isTalking ? audioLevel : 0, 0.1);
    
    // Helper to get initial rotation
    const getInit = (name: string) => initialRotations.current[name];

    // Spine Breathing
    if (bones.spine && getInit('spine')) {
        const init = getInit('spine')!;
        bones.spine.rotation.x = init.x + Math.sin(t * 1.5) * 0.03;
        bones.spine.rotation.y = init.y + Math.cos(t * 1.5 * 0.5) * 0.03;
    }

    // Arm Gestures
    if (talkIntensity > 0.01) {
        // Multipliers
        const armAmp = 0.5; // Shoulder lift/sway
        const foreArmAmp = 0.8; // Hand wave

        // Right Arm (Dominant)
        if (bones.rightArm && getInit('rightArm')) {
            const init = getInit('rightArm')!;
            // Lift Z (up), Rotate X (forward/back)
            bones.rightArm.rotation.z = MathUtils.lerp(bones.rightArm.rotation.z, init.z - 0.5 * talkIntensity, 0.1);
            bones.rightArm.rotation.x = MathUtils.lerp(bones.rightArm.rotation.x, init.x + 0.2 * talkIntensity, 0.1);
        }
        if (bones.rightForeArm && getInit('rightForeArm')) {
            const init = getInit('rightForeArm')!;
            // Wave
            const wave = Math.sin(t * 8) * foreArmAmp * talkIntensity;
            bones.rightForeArm.rotation.x = MathUtils.lerp(bones.rightForeArm.rotation.x, init.x - 0.5 - Math.abs(wave), 0.1);
        }

        // Left Arm (Secondary)
        if (bones.leftArm && getInit('leftArm')) {
            const init = getInit('leftArm')!;
            bones.leftArm.rotation.z = MathUtils.lerp(bones.leftArm.rotation.z, init.z + 0.3 * talkIntensity, 0.1);
        }
        if (bones.leftForeArm && getInit('leftForeArm')) {
            const init = getInit('leftForeArm')!;
            const wave = Math.cos(t * 6) * foreArmAmp * 0.5 * talkIntensity;
            bones.leftForeArm.rotation.x = MathUtils.lerp(bones.leftForeArm.rotation.x, init.x - 0.3 - Math.abs(wave), 0.1);
        }
        
        // Head Emphasis
        if (bones.head && getInit('head')) {
            const init = getInit('head')!;
            bones.head.rotation.x = MathUtils.lerp(bones.head.rotation.x, init.x + Math.sin(t * 10) * 0.1 * talkIntensity, 0.1);
        }

    } else {
        // Return to breathing idle
        const resetBone = (bone: Bone | null, name: string, offsetZ = 0) => {
            if (bone && getInit(name)) {
                const init = getInit(name)!;
                // Add slight breathing motion to arms even when idle
                bone.rotation.z = MathUtils.lerp(bone.rotation.z, init.z + offsetZ + Math.sin(t) * 0.02, 0.05);
                bone.rotation.x = MathUtils.lerp(bone.rotation.x, init.x, 0.05);
                bone.rotation.y = MathUtils.lerp(bone.rotation.y, init.y, 0.05);
            }
        };

        resetBone(bones.rightArm, 'rightArm');
        resetBone(bones.rightForeArm, 'rightForeArm');
        resetBone(bones.leftArm, 'leftArm');
        resetBone(bones.leftForeArm, 'leftForeArm');
        
        if (bones.head && getInit('head')) {
             const init = getInit('head')!;
             bones.head.rotation.x = MathUtils.lerp(bones.head.rotation.x, init.x, 0.1);
        }
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};