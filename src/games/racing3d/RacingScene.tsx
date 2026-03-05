import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useKeyboardControls, Html } from '@react-three/drei';
import type { Player, ControllerInput } from '../../network/types';
import * as THREE from 'three';

interface RacingSceneProps {
    players: Player[];
    inputState: Record<string, ControllerInput>;
}

const MAX_LAPS = 3;

// --- TRACK DEFINITION ---
const TRACK_POINTS = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(50, 0, 10),
    new THREE.Vector3(100, 0, 0),
    new THREE.Vector3(120, 0, -40),
    new THREE.Vector3(100, 0, -80),
    new THREE.Vector3(50, 0, -70),
    new THREE.Vector3(0, 0, -80),
    new THREE.Vector3(-40, 0, -40),
];

const TRACK_CURVE = new THREE.CatmullRomCurve3(TRACK_POINTS, true);
const TRACK_WIDTH = 12;
const TRACK_SEGMENTS = 100;

export function RacingScene({ players, inputState }: RacingSceneProps) {
    const [lapData, setLapData] = useState<Record<string, { lap: number; cp: number; finished: boolean; time: number }>>({});
    const [winner, setWinner] = useState<{ name: string; time: number } | null>(null);
    const [startTime] = useState(() => Date.now());

    // Generate track geometry
    const trackGeom = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(-TRACK_WIDTH / 2, -0.2);
        shape.lineTo(TRACK_WIDTH / 2, -0.2);
        shape.lineTo(TRACK_WIDTH / 2, 0.2);
        shape.lineTo(-TRACK_WIDTH / 2, 0.2);
        shape.lineTo(-TRACK_WIDTH / 2, -0.2);

        return new THREE.ExtrudeGeometry(shape, {
            steps: TRACK_SEGMENTS,
            bevelEnabled: false,
            extrudePath: TRACK_CURVE
        });
    }, []);

    useEffect(() => {
        const initData: any = {};
        players.forEach(p => {
            initData[p.id] = { lap: 1, cp: 0, finished: false, time: 0 };
        });
        setLapData(initData);
    }, [players]);

    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 20, 10]} intensity={1} castShadow />

            {/* Grass */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
                <planeGeometry args={[1000, 1000]} />
                <meshStandardMaterial color="#1a472a" />
            </mesh>

            {/* Main Track */}
            <RigidBody type="fixed" colliders="trimesh">
                <mesh geometry={trackGeom} receiveShadow>
                    <meshStandardMaterial color="#333" />
                </mesh>
            </RigidBody>

            {/* Starting Line Arch */}
            <mesh position={[0, 4, 0]}>
                <boxGeometry args={[TRACK_WIDTH + 2, 1, 1]} />
                <meshStandardMaterial color="#e53e3e" />
            </mesh>

            {/* Checkpoints & Finish Line */}
            {/* For simplicity in this "Pro" version, we use distance along curve for checkpoint tracking */}

            {players.map((p, index) => (
                <Car
                    key={p.id}
                    player={p}
                    index={index}
                    inputState={inputState}
                    checkpointData={{
                        lap: lapData[p.id]?.lap || 1,
                        finished: lapData[p.id]?.finished || false
                    }}
                    onLapComplete={(lap: number) => {
                        setLapData(prev => {
                            const d = prev[p.id];
                            if (!d || d.finished) return prev;
                            if (lap > MAX_LAPS) {
                                const time = (Date.now() - startTime) / 1000;
                                if (!winner) setWinner({ name: p.name, time });
                                return { ...prev, [p.id]: { ...d, finished: true, time } };
                            }
                            return { ...prev, [p.id]: { ...d, lap } };
                        });
                    }}
                />
            ))}

            <Html fullscreen style={{ pointerEvents: 'none' }}>
                <div className="absolute top-4 right-4 p-4 bg-black/60 rounded-xl text-white">
                    <h2 className="text-xl font-bold mb-2">Race Leaderboard</h2>
                    {players.map(p => (
                        <div key={p.id} className="flex justify-between gap-8 mb-1">
                            <span>{p.name}</span>
                            <span>{lapData[p.id]?.finished ? 'FINISHED' : `Lap ${lapData[p.id]?.lap || 1}/${MAX_LAPS}`}</span>
                        </div>
                    ))}
                </div>

                {winner && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 overflow-hidden">
                        <div className="bg-white p-12 rounded-3xl text-center shadow-2xl">
                            <h1 className="text-5xl font-black text-indigo-600 mb-2">WINNER!</h1>
                            <p className="text-3xl font-bold text-slate-800">{winner.name}</p>
                            <p className="text-xl text-slate-500 mt-2">{winner.time.toFixed(2)}s</p>
                        </div>
                    </div>
                )}
            </Html>
        </>
    );
}

function Car({ player, index, inputState, checkpointData, onLapComplete }: any) {
    const bodyRef = useRef<RapierRigidBody>(null);
    const [, getKeys] = useKeyboardControls();
    const lastT = useRef(0);

    // Stagger starts near (0,0,0)
    const startPos: [number, number, number] = [0, 1, index * 4 - 4];

    useFrame((state, delta) => {
        if (!bodyRef.current || checkpointData.finished) return;

        const body = bodyRef.current;
        const pos = body.translation();
        const rot = body.rotation();
        const vel = body.linvel();

        // 1. Calculate progress along the curve
        // This is a simplified progress calculation: finding the closest point on the spline
        // For performance, we just check distance in a loop or keep track of last index
        const currentPoint = new THREE.Vector3(pos.x, pos.y, pos.z);

        // Find t (0.0 to 1.0)
        // Optimization: check points nearby instead of full sampling
        let bestT = 0;
        let minDist = Infinity;
        for (let i = 0; i <= 100; i++) {
            const t = i / 100;
            const p = TRACK_CURVE.getPoint(t);
            const d = p.distanceTo(currentPoint);
            if (d < minDist) {
                minDist = d;
                bestT = t;
            }
        }

        // Lap detection: crossing from ~0.9 to ~0.1
        if (lastT.current > 0.8 && bestT < 0.2) {
            onLapComplete(checkpointData.lap + 1);
        }
        lastT.current = bestT;

        // 2. Physics & Controls
        const keys = getKeys();
        const inputs = inputState[player.id] || { x: 0, y: 0, btnA: false };

        const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
        const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

        const speed = new THREE.Vector3(vel.x, vel.y, vel.z).length();

        // Driving
        let forward = 0;
        if (keys.forward || inputs.y < -0.2) forward = 1;
        if (keys.backward || inputs.y > 0.2) forward = -1;

        if (forward !== 0) {
            const force = 4000 * forward * delta;
            body.applyImpulse({ x: forwardVector.x * force, y: 0, z: forwardVector.z * force }, true);
        }

        // Steering
        let turn = 0;
        if (keys.left || inputs.x < -0.2) turn = 1;
        if (keys.right || inputs.x > 0.2) turn = -1;

        if (turn !== 0 && speed > 2) {
            const torque = 1500 * turn * delta * (speed / 20 > 1 ? 1 : speed / 20);
            body.applyTorqueImpulse({ x: 0, y: torque, z: 0 }, true);
        }

        // Friction / Drag
        body.setLinearDamping(0.5);
        body.setAngularDamping(2);

        // Camera follow for first player
        if (index === 0) {
            const camOffset = new THREE.Vector3(0, 5, -10).applyQuaternion(quaternion);
            const camTarget = new THREE.Vector3(pos.x, pos.y, pos.z).add(camOffset);
            state.camera.position.lerp(camTarget, 0.1);
            state.camera.lookAt(pos.x, pos.y, pos.z);
        }
    });

    return (
        <RigidBody ref={bodyRef} position={startPos} mass={1} colliders="cuboid" linearDamping={0.5} angularDamping={2}>
            <mesh castShadow>
                <boxGeometry args={[2, 0.5, 4]} />
                <meshStandardMaterial color={index === 0 ? "blue" : "red"} />
            </mesh>
            <mesh position={[0, 0.5, 0.5]} castShadow>
                <boxGeometry args={[1.5, 0.5, 2]} />
                <meshStandardMaterial color="white" />
            </mesh>
        </RigidBody>
    );
}
