import type { Player, ControllerInput } from '../network/types';

export interface GamePlugin {
    id: string;
    title: string;
    minPlayers: number;
    maxPlayers: number;

    /**
     * Initialize the game with the given container and players
     */
    init(
        container: HTMLDivElement,
        players: Player[],
        emitState: (state: any) => void
    ): void;

    /**
     * Update the game state based on player input
     */
    updateInput(playerId: string, input: ControllerInput): void;

    /**
     * Update the list of active players
     */
    updatePlayers(players: Player[]): void;

    /**
     * Destroy the game and clean up resources
     */
    destroy(): void;
}

// Global registry of all available games
export const GameRegistry: Record<string, GamePlugin> = {};

export function registerGame(plugin: GamePlugin) {
    GameRegistry[plugin.id] = plugin;
}
