import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Room, Player, ControllerInput } from '../network/types';

interface AppState {
    // Network
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    isConnected: boolean;

    // Room State
    roomId: string | null;
    room: Room | null;
    me: Player | null; // My player data if I'm a client, null if I'm host
    isHost: boolean;

    // Game State
    activeGame: string | null;

    // Actions
    connect: () => void;
    createRoom: () => Promise<string>;
    joinRoom: (roomId: string, name: string) => Promise<{ success: boolean, error?: string }>;
    leaveRoom: () => void;
    setReady: (isReady: boolean) => void;
    startGame: (gameId: string) => void;
    sendInput: (input: ControllerInput) => void;
    returnToLobby: () => void;

    // Host Callbacks
    onPlayerInput?: (playerId: string, input: ControllerInput) => void;
    setOnPlayerInput: (callback: (playerId: string, input: ControllerInput) => void) => void;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`;

export const useAppStore = create<AppState>((set, get) => ({
    socket: null,
    isConnected: false,
    roomId: null,
    room: null,
    me: null,
    isHost: false,
    activeGame: null,

    connect: () => {
        if (get().socket) return;

        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL);

        socket.on('connect', () => {
            set({ isConnected: true, socket });
        });

        socket.on('disconnect', () => {
            set({ isConnected: false, room: null, roomId: null });
        });

        socket.on('room-state', (room) => {
            set({ room });
        });

        socket.on('player-joined', (player) => {
            const room = get().room;
            if (room) {
                set({ room: { ...room, players: { ...room.players, [player.id]: player } } });
            }
        });

        socket.on('player-left', (playerId) => {
            const room = get().room;
            if (room) {
                const newPlayers = { ...room.players };
                delete newPlayers[playerId];
                set({ room: { ...room, players: newPlayers } });
            }
        });

        socket.on('player-input', (playerId, input) => {
            const { onPlayerInput } = get();
            if (onPlayerInput) {
                onPlayerInput(playerId, input);
            }
        });

        socket.on('game-started', (gameId) => {
            set({ activeGame: gameId });
        });

        // When host leaves, everyone is kicked
        socket.on('leave-room', () => {
            set({ room: null, roomId: null, activeGame: null, me: null, isHost: false });
        });

        set({ socket });
    },

    createRoom: () => {
        return new Promise((resolve, reject) => {
            const socket = get().socket;
            if (!socket) return reject('Not connected');

            socket.emit('create-room', (response) => {
                set({ roomId: response.roomId, isHost: true });
                resolve(response.roomId);
            });
        });
    },

    joinRoom: (roomId: string, name: string) => {
        return new Promise((resolve, reject) => {
            const socket = get().socket;
            if (!socket) return reject('Not connected');

            socket.emit('join-room', roomId, name, (response) => {
                if (response.success && response.room) {
                    set({
                        roomId,
                        room: response.room,
                        isHost: false,
                        me: response.room.players[socket.id!]
                    });
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: response.error });
                }
            });
        });
    },

    leaveRoom: () => {
        const socket = get().socket;
        if (socket) {
            // Disconnect and reconnect to clean up
            socket.disconnect();
            set({ socket: null, roomId: null, room: null, isHost: false, me: null, activeGame: null });
            get().connect();
        }
    },

    setReady: (isReady: boolean) => {
        const socket = get().socket;
        if (socket) {
            socket.emit('player-ready', isReady);
            set((state) => ({ me: state.me ? { ...state.me, isReady } : null }));
        }
    },

    startGame: (gameId: string) => {
        const socket = get().socket;
        if (socket && get().isHost) {
            socket.emit('start-game', gameId);
        }
    },

    sendInput: (input: ControllerInput) => {
        const socket = get().socket;
        if (socket && !get().isHost) {
            socket.emit('controller-input', input);
        }
    },

    returnToLobby: () => {
        const socket = get().socket;
        if (socket && get().isHost) {
            socket.emit('return-to-lobby');
            set({ activeGame: null });
        }
    },

    setOnPlayerInput: (callback) => {
        set({ onPlayerInput: callback });
    }
}));
