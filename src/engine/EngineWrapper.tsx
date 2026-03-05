import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { GameRegistry } from './GamePlugin';

export function EngineWrapper({ gameId }: { gameId: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { room, setOnPlayerInput } = useAppStore();
    const gameRef = useRef<any>(null);

    useEffect(() => {
        const plugin = GameRegistry[gameId];
        if (!plugin) {
            console.error(`Game plugin ${gameId} not found`);
            return;
        }

        if (!containerRef.current || !room) return;

        const players = Object.values(room.players);

        // Initialize the game
        plugin.init(containerRef.current, players, (_state) => {
            // Optional: emit state to controllers
        });

        gameRef.current = plugin;

        // Bind input listener
        setOnPlayerInput((playerId, input) => {
            if (gameRef.current) {
                gameRef.current.updateInput(playerId, input);
            }
        });

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy();
                gameRef.current = null;
            }
            setOnPlayerInput(() => { });
        };
    }, [gameId, setOnPlayerInput]); // Only re-init when gameId changes, not when room changes

    // Update players when room changes
    useEffect(() => {
        if (gameRef.current && room) {
            gameRef.current.updatePlayers(Object.values(room.players));
        }
    }, [room]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full bg-black overflow-hidden"
            id="f2f-game-container"
        />
    );
}
