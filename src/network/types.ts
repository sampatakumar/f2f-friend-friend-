// Shared types between Client and Server

export interface Player {
    id: string; // Socket ID
    name: string;
    avatar: string;
    isHost: boolean;
    isReady: boolean;
    score: number;
}

export interface Room {
    id: string;
    hostId: string;
    players: Record<string, Player>;
    state: 'LOBBY' | 'PLAYING' | 'SCOREBOARD';
    currentGame?: string;
}

export interface ControllerInput {
    x: number;
    y: number;
    btnA: boolean;
    btnB: boolean;
    btnX: boolean;
    btnY: boolean;
    btnTurbo: boolean;
}

export interface ClientToServerEvents {
    'create-room': (callback: (response: { roomId: string }) => void) => void;
    'join-room': (roomId: string, name: string, callback: (response: { success: boolean, room?: Room, error?: string }) => void) => void;
    'leave-room': () => void;
    'player-ready': (isReady: boolean) => void;
    'controller-input': (input: ControllerInput) => void;
    'start-game': (gameId: string) => void;
    'return-to-lobby': () => void;
}

export interface ServerToClientEvents {
    'room-state': (room: Room) => void;
    'player-joined': (player: Player) => void;
    'player-left': (playerId: string) => void;
    'player-input': (playerId: string, input: ControllerInput) => void; // Host receives this
    'game-started': (gameId: string) => void;
    'game-ended': (results: any) => void;
    'leave-room': () => void;
}
