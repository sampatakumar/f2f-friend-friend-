import { createRoot, type Root } from 'react-dom/client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { KeyboardControls } from '@react-three/drei';
import type { GamePlugin } from '../../engine/GamePlugin';
import type { Player, ControllerInput } from '../../network/types';
import { RacingScene } from './RacingScene';

class Racing3DPlugin implements GamePlugin {
    id = 'racing3d';
    title = '3D Racing';
    minPlayers = 1;
    maxPlayers = 8;

    private root: Root | null = null;
    private inputState: Record<string, ControllerInput> = {};
    private players: Player[] = [];

    init(container: HTMLDivElement, players: Player[], _emitState: (state: any) => void): void {
        this.root = createRoot(container);
        this.players = players;

        // Initialize input state for each player
        players.forEach(p => {
            this.inputState[p.id] = { x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnTurbo: false };
        });

        this.render();
    }

    updateInput(playerId: string, input: ControllerInput): void {
        this.inputState[playerId] = input;
        // We don't need to re-render React on every input, 
        // the RacingScene component will read from a proxy or ref to the inputState instance
    }

    destroy(): void {
        if (this.root) {
            setTimeout(() => {
                this.root?.unmount();
                this.root = null;
            }, 0);
        }
    }

    private render() {
        if (!this.root) return;

        this.root.render(
            <KeyboardControls
                map={[
                    { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
                    { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
                    { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
                    { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
                    { name: 'boost', keys: ['Shift'] },
                ]}
            >
                <Canvas shadows camera={{ position: [0, 10, 20], fov: 50 }}>
                    <Suspense fallback={null}>
                        <color attach="background" args={['#87CEEB']} />
                        <ambientLight intensity={0.5} />
                        <directionalLight castShadow position={[10, 20, 10]} intensity={1.5} shadow-mapSize={[2048, 2048]} />

                        <Physics gravity={[0, -9.81, 0]}>
                            <RacingScene players={this.players} inputState={this.inputState} />
                        </Physics>
                    </Suspense>
                </Canvas>
            </KeyboardControls>
        );
    }
}

export const Racing3D = new Racing3DPlugin();
