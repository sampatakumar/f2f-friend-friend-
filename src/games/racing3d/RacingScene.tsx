import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { useKeyboardControls, Html } from '@react-three/drei';
import type { Player, ControllerInput } from '../../network/types';
import * as THREE from 'three';

interface RacingSceneProps {
    players: Player[];
    inputState: Record<string, ControllerInput>;
}

const MAX_LAPS = 3;
const TRACK_RADIUS = 60;
const TRACK_WIDTH = 25;
const NUM_CHECKPOINTS = 8; // Number of invisible sections around the track

// Derived constants
const OUTER_RADIUS = TRACK_RADIUS + TRACK_WIDTH / 2;
const INNER_RADIUS = TRACK_RADIUS - TRACK_WIDTH / 2;

// Checkpoint Definition (Angles)
const CHECKPOINT_ANGLES = Array.from({ length: NUM_CHECKPOINTS }).map((_, i) => (Math.PI * 2 * i) / NUM_CHECKPOINTS);

export function RacingScene({ players, inputState }: RacingSceneProps) {
    const [lapData, setLapData] = useState<Record<string, { lap: number; cp: number; finished: boolean; time: number }>>({});
    const [winner, setWinner] = useState<{ name: string; time: number } | null>(null);
    const [startTime] = useState(() => Date.now());

    useEffect(() => {
        const initData: any = {};
        players.forEach(p => {
            initData[p.id] = { lap: 1, cp: 0, finished: false, time: 0 };
        });
        setLapData(initData);
    }, [players]);

    return (
        <>
            {/* Environment: Grass Background */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
                <planeGeometry args={[400, 400]} />
                <meshStandardMaterial color="#2f855a" />
            </mesh>

            {/* Track Loop */}
            <RigidBody type="fixed" colliders="trimesh" friction={1.5} restitution={0.1}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.4, 0]}>
                    <ringGeometry args={[INNER_RADIUS, OUTER_RADIUS, 64]} />
                    <meshStandardMaterial color="#2d3748" side={THREE.DoubleSide} />
                </mesh>
            </RigidBody>

            {/* Track Inner Bounds (Wall) */}
            <RigidBody type="fixed" colliders="trimesh">
                <mesh receiveShadow position={[0, 0, 0]}>
                    <cylinderGeometry args={[INNER_RADIUS, INNER_RADIUS, 2, 64, 1, true]} />
                    <meshStandardMaterial color="#c53030" side={THREE.DoubleSide} />
                </mesh>
            </RigidBody>

            {/* Track Outer Bounds (Wall) */}
            <RigidBody type="fixed" colliders="trimesh">
                <mesh receiveShadow position={[0, 0, 0]}>
                    <cylinderGeometry args={[OUTER_RADIUS, OUTER_RADIUS, 2, 64, 1, true]} />
                    <meshStandardMaterial color="#c53030" side={THREE.DoubleSide} />
                </mesh>
            </RigidBody>

            {/* Start / Finish Line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[TRACK_RADIUS, -0.35, 0]}>
                <planeGeometry args={[TRACK_WIDTH, 4]} />
                <meshStandardMaterial color="#ffffff" map={createCheckerboardTexture()} />
            </mesh>
            {/* Start Line Arch */}
            <mesh position={[TRACK_RADIUS, 5, 0]}>
                <boxGeometry args={[TRACK_WIDTH, 1, 1]} />
                <meshStandardMaterial color="#4299e1" />
            </mesh>
            <mesh position={[TRACK_RADIUS + TRACK_WIDTH / 2, 2.5, 0]}>
                <boxGeometry args={[1, 5, 1]} />
                <meshStandardMaterial color="#4299e1" />
            </mesh>
            <mesh position={[TRACK_RADIUS - TRACK_WIDTH / 2, 2.5, 0]}>
                <boxGeometry args={[1, 5, 1]} />
                <meshStandardMaterial color="#4299e1" />
            </mesh>

            {/* Players */}
            {players.map((p, index) => (
                <Car
                    key={p.id}
                    player={p}
                    index={index}
                    inputState={inputState}
                    checkpointData={{
                        lap: lapData[p.id]?.lap || 1,
                        cp: lapData[p.id]?.cp || 0,
                        finished: lapData[p.id]?.finished || false
                    }}
                    onCheckpoint={(cp) => {
                        setLapData(prev => {
                            const d = prev[p.id];
                            if (!d || d.finished) return prev;

                            // Check if next checkpoint reached (or finishing lap)
                            if (cp === d.cp + 1) {
                                return { ...prev, [p.id]: { ...d, cp } };
                            }
                            // Reached finishing line checkpoint (0 = start/finish line)
                            if (cp === 0 && d.cp === NUM_CHECKPOINTS - 1) {
                                const newLap = d.lap + 1;
                                if (newLap > MAX_LAPS) {
                                    const time = (Date.now() - startTime) / 1000;
                                    if (!winner) setWinner({ name: p.name, time });
                                    return { ...prev, [p.id]: { lap: d.lap, cp: 0, finished: true, time } };
                                }
                                return { ...prev, [p.id]: { lap: newLap, cp: 0, finished: false, time: d.time } };
                            }
                            return prev;
                        });
                    }}
                />
            ))}

            {/* HUD Overlay */}
            <Html fullscreen style={{ pointerEvents: 'none' }}>
                <div className="absolute top-0 right-0 p-8 w-[300px]">
                    <div className="bg-slate-900/80 p-4 rounded-xl border-2 border-slate-700 text-white shadow-2xl backdrop-blur-md">
                        <h2 className="text-2xl font-black mb-4 text-emerald-400 border-b border-slate-600 pb-2">RACE STATUS</h2>
                        {players.map(p => {
                            const d = lapData[p.id];
                            if (!d) return null;
                            return (
                                <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-800">
                                    <span className="font-bold flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCarColor(players.findIndex(x => x.id === p.id)) }} />
                                        {p.name}
                                    </span>
                                    {d.finished ? (
                                        <span className="text-amber-400 font-mono font-bold text-sm">FINISH! {d.time.toFixed(1)}s</span>
                                    ) : (
                                        <span className="text-slate-300 font-mono">Lap {d.lap}/{MAX_LAPS}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {winner && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
                        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-12 rounded-3xl border-4 border-amber-400 text-center shadow-[0_0_100px_rgba(251,191,36,0.3)] animate-pulse">
                            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 mb-4 scale-110">WINNER!</h1>
                            <p className="text-4xl text-white font-bold">{winner.name}</p>
                            <p className="text-2xl text-slate-300 mt-4 font-mono">{winner.time.toFixed(2)} seconds</p>
                        </div>
                    </div>
                )}
            </Html>
        </>
    );
}

function Car({ player, index, inputState, checkpointData, onCheckpoint }: { player: Player, index: number, inputState: Record<string, ControllerInput>, checkpointData: any, onCheckpoint: (cp: number) => void }) {
    const bodyRef = useRef<RapierRigidBody>(null);
    const [, getKeys] = useKeyboardControls();

    // Starting on the start line (Angle 0). Staggered.
    const radiusOffset = (index % 4) * 4 - 6;
    const startRadius = TRACK_RADIUS + radiusOffset;
    const startZ = -((Math.floor(index / 4)) * 6 + 5);

    const startPos: [number, number, number] = [startRadius, 1, startZ];

    // Precalculate car parts
    const color = getCarColor(index);
    const accent = '#1a202c';

    useFrame((state, delta) => {
        if (!bodyRef.current) return;
        const body = bodyRef.current;
        const currentRot = body.rotation();
        const currentVel = body.linvel();
        const pos = body.translation();

        // -- LOGIC: LAP CHECKPOINTS --
        // Figure out angle of car to center to determine checkpoint sector
        const angle = Math.atan2(pos.z, pos.x);
        // Normalize angle to 0..2PI
        let normAngle = angle;
        if (normAngle < 0) normAngle += Math.PI * 2;

        // Find closest checkpoint index behind us
        let currentCP = 0;
        for (let i = 0; i < NUM_CHECKPOINTS; i++) {
            if (normAngle >= CHECKPOINT_ANGLES[i]) {
                currentCP = i;
            }
        }

        // Let host react know if we crossed a new sector
        if (currentCP !== checkpointData.cp) {
            onCheckpoint(currentCP);
        }

        // -- LOGIC: PHYSICS / DRIVING --
        if (checkpointData.finished) {
            // Apply brake if finished
            body.setLinearDamping(10);
            return;
        }

        const keys = getKeys();
        const inputs = inputState[player.id] || { x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnTurbo: false };

        let forward = 0;
        if (keys.forward || inputs.y < -0.2) forward = 1;
        if (keys.backward || inputs.y > 0.2) forward = -1;

        let turn = 0;
        if (keys.left || inputs.x < -0.2) turn = 1;
        if (keys.right || inputs.x > 0.2) turn = -1;

        // Forward direction from quaternion
        const quaternion = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);
        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);

        // Max velocity constraint
        const velocityVec = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z);
        const speed = velocityVec.length();

        // Physics constants (TUNED FOR 80KG UNIT)
        const acceleration = 3000;
        const maxSpeed = 60;
        const maxReverseSpeed = 20;
        const boostMultiplier = (keys.boost || inputs.btnA) ? 1.6 : 1;

        if (forward !== 0) {
            const isAccelerating = forward > 0;
            const limit = isAccelerating ? maxSpeed * boostMultiplier : maxReverseSpeed;

            if (speed < limit || Math.sign(velocityVec.dot(forwardVector)) !== forward) {
                body.applyImpulse({
                    x: forwardVector.x * forward * acceleration * boostMultiplier * delta,
                    y: 0,
                    z: forwardVector.z * forward * acceleration * boostMultiplier * delta
                }, true);
            }
        }

        // Apply turning (torque)
        if (turn !== 0 && speed > 2) {
            const turnSpeed = 1500;
            const speedFactor = Math.min(speed / 10, 1.5); // Increase turn capability at speed
            const dirMultiplier = forward >= 0 ? 1 : -1;
            body.applyTorqueImpulse({
                x: 0,
                y: turn * dirMultiplier * turnSpeed * speedFactor * delta,
                z: 0
            }, true);
        }

        // Extra drag to prevent endless sliding
        const lateralDrag = 15;
        const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
        const lateralVelocity = velocityVec.clone().projectOnVector(rightVector);

        body.applyImpulse({
            x: -lateralVelocity.x * lateralDrag * delta,
            y: 0,
            z: -lateralVelocity.z * lateralDrag * delta
        }, true);

        // Auto-follow camera for player 0
        if (index === 0) {
            // Place camera behind and above
            const cameraOffset = new THREE.Vector3(0, 8, 15).applyQuaternion(quaternion);
            const cameraPos = new THREE.Vector3(pos.x, pos.y, pos.z).add(cameraOffset);

            // Look slightly ahead of the car
            const lookTarget = new THREE.Vector3(pos.x, pos.y, pos.z).add(forwardVector.multiplyScalar(10));

            state.camera.position.lerp(cameraPos, 0.1);
            state.camera.lookAt(lookTarget);
        }
    });

    return (
        <RigidBody
            ref={bodyRef}
            position={startPos}
            rotation={[0, Math.PI / 2, 0]} // Face forward along the track
            colliders={false}
            mass={80}
            linearDamping={1.5}
            angularDamping={3.5}
        >
            <CuboidCollider args={[1, 0.5, 2.2]} />

            {/* Visual Car Geometry (Kart / F1 Style) */}
            <group position={[0, -0.2, 0]}>
                {/* Main Chassis */}
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[1.5, 0.6, 4]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                {/* Nose Cone */}
                <mesh castShadow receiveShadow position={[0, -0.1, -2.5]}>
                    <cylinderGeometry args={[0.3, 0.7, 1.5, 8]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                {/* Driver Cockpit Hole */}
                <mesh position={[0, 0.35, -0.2]}>
                    <boxGeometry args={[1, 0.1, 1.5]} />
                    <meshStandardMaterial color="#000000" />
                </mesh>

                {/* Back Spoiler */}
                <mesh castShadow receiveShadow position={[0, 0.8, 1.8]}>
                    <boxGeometry args={[2.5, 0.1, 0.6]} />
                    <meshStandardMaterial color={accent} />
                </mesh>
                {/* Spoiler Struts */}
                <mesh castShadow receiveShadow position={[-0.6, 0.4, 1.8]}>
                    <boxGeometry args={[0.1, 0.8, 0.4]} />
                    <meshStandardMaterial color={color} />
                </mesh>
                <mesh castShadow receiveShadow position={[0.6, 0.4, 1.8]}>
                    <boxGeometry args={[0.1, 0.8, 0.4]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                {/* Wheels */}
                <CarWheel position={[-1, 0, -1.2]} />
                <CarWheel position={[1, 0, -1.2]} />
                <CarWheel position={[-1, 0, 1.5]} scale={[1, 1, 1.2]} />
                <CarWheel position={[1, 0, 1.5]} scale={[1, 1, 1.2]} />
            </group>
        </RigidBody>
    );
}

function CarWheel({ position, scale = [1, 1, 1] }: { position: [number, number, number], scale?: [number, number, number] }) {
    return (
        <mesh position={position} scale={new THREE.Vector3(...scale)} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.4, 16]} />
            <meshStandardMaterial color="#111827" roughness={0.9} />
        </mesh>
    );
}

// Helpers
function getCarColor(index: number) {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#a855f7', '#06b6d4', '#ea580c'];
    return colors[index % colors.length];
}

function createCheckerboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    tex.magFilter = THREE.NearestFilter;
    return tex;
}
