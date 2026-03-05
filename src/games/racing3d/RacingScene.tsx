import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import type { Player, ControllerInput } from '../../network/types';
import * as THREE from 'three';

interface RacingSceneProps {
    players: Player[];
    inputState: Record<string, ControllerInput>;
}

export function RacingScene({ players, inputState }: RacingSceneProps) {
    return (
        <>
            {/* Track Base */}
            <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]} friction={2}>
                <mesh receiveShadow>
                    <boxGeometry args={[200, 1, 200]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
            </RigidBody>

            {/* Track Walls */}
            <RigidBody type="fixed" colliders="cuboid" position={[0, 1, -100]}>
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[200, 2, 2]} />
                    <meshStandardMaterial color="#e53e3e" />
                </mesh>
            </RigidBody>
            <RigidBody type="fixed" colliders="cuboid" position={[0, 1, 100]}>
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[200, 2, 2]} />
                    <meshStandardMaterial color="#e53e3e" />
                </mesh>
            </RigidBody>
            <RigidBody type="fixed" colliders="cuboid" position={[-100, 1, 0]}>
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[2, 2, 200]} />
                    <meshStandardMaterial color="#e53e3e" />
                </mesh>
            </RigidBody>
            <RigidBody type="fixed" colliders="cuboid" position={[100, 1, 0]}>
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[2, 2, 200]} />
                    <meshStandardMaterial color="#e53e3e" />
                </mesh>
            </RigidBody>

            {/* Players */}
            {players.map((p, index) => (
                <Car
                    key={p.id}
                    player={p}
                    index={index}
                    inputs={inputState[p.id] || { x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnTurbo: false }}
                />
            ))}
        </>
    );
}

function Car({ player: _player, index, inputs }: { player: Player, index: number, inputs: ControllerInput }) {
    const bodyRef = useRef<RapierRigidBody>(null);
    const [, getKeys] = useKeyboardControls();

    // Basic vehicle colors based on player index
    const colors = ['#3182ce', '#e53e3e', '#38a169', '#d69e2e', '#805ad5', '#e53e3e', '#319795', '#dd6b20'];
    const color = colors[index % colors.length];

    const startPos: [number, number, number] = [(index % 4) * 4 - 6, 2, Math.floor(index / 4) * -6 + 10];

    useFrame((state, delta) => {
        if (!bodyRef.current) return;

        // Merge mobile inputs and keyboard inputs (for testing on host)
        const keys = getKeys();

        // Mobile joystick Y is up/down (typically up is negative in DOM, but let's assume y>0 is up for controller, actually standard gamepad uses Y- down. 
        // In our nipplejs adaptation: dx, dy. up is negative dy. So inputs.y is negative when pushing forward.
        // Wait, let's normalize:
        let forward = 0;
        if (keys.forward || inputs.y < -0.2) forward = 1;
        if (keys.backward || inputs.y > 0.2) forward = -1;

        let turn = 0;
        if (keys.left || inputs.x < -0.2) turn = 1;
        if (keys.right || inputs.x > 0.2) turn = -1;

        const body = bodyRef.current;

        // Simple car physics applied via velocities rather than full raycast vehicle for now (for stability/simplicity)
        const currentVel = body.linvel();
        const currentRot = body.rotation();

        // Forward direction from quaternion
        const quaternion = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);
        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);

        // Apply acceleration
        const speed = 40;
        const boost = (keys.boost || inputs.btnA) ? 1.5 : 1;

        if (forward !== 0) {
            body.applyImpulse({
                x: forwardVector.x * forward * speed * boost * delta,
                y: 0,
                z: forwardVector.z * forward * speed * boost * delta
            }, true);
        }

        // Apply turning (torque)
        if (turn !== 0 && Math.abs(currentVel.x) + Math.abs(currentVel.z) > 1) {
            // Only turn if moving
            const turnSpeed = 15;
            const turnDir = forward > 0 ? turn : -turn; // Reverse turn direction if reversing
            body.applyTorqueImpulse({
                x: 0,
                y: turnDir * turnSpeed * delta,
                z: 0
            }, true);
        }

        // Auto-follow camera for player 0 (just to see the action)
        if (index === 0) {
            const pos = body.translation();
            const cameraPos = new THREE.Vector3(pos.x, pos.y + 10, pos.z + 15);
            state.camera.position.lerp(cameraPos, 0.1);
            state.camera.lookAt(pos.x, pos.y, pos.z);
        }
    });

    return (
        <RigidBody
            ref={bodyRef}
            position={startPos}
            colliders={false}
            mass={100}
            linearDamping={1.5}
            angularDamping={2.5}
        >
            <CuboidCollider args={[1, 0.5, 2]} />
            {/* Car Body */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[2, 1, 4]} />
                <meshStandardMaterial color={color} />
            </mesh>
            {/* Car Roof */}
            <mesh castShadow receiveShadow position={[0, 0.75, -0.5]}>
                <boxGeometry args={[1.8, 0.5, 2]} />
                <meshStandardMaterial color="#1a202c" />
            </mesh>

            {/* Player Name Tag (simplified as just a color for now, since Text needs extra imports) */}
        </RigidBody>
    );
}
