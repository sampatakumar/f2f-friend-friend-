import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { ClientToServerEvents, ServerToClientEvents, Room, Player } from '../src/network/types';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, any>(httpServer, {
    cors: {
        origin: '*', // For production, replace '*' with your Vercel URL
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const PORT = process.env.PORT || 3001;

// In-memory store
const rooms: Record<string, Room> = {};

function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`Socket connected: ${socket.id}`);

    let currentRoomId: string | null = null;

    socket.on('create-room', (callback) => {
        const roomId = generateRoomId();
        currentRoomId = roomId;

        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            players: {},
            state: 'LOBBY'
        };

        socket.join(roomId);
        callback({ roomId });
        console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    socket.on('join-room', (roomId, name, callback) => {
        const room = rooms[roomId];
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        if (room.state !== 'LOBBY') {
            callback({ success: false, error: 'Game already in progress' });
            return;
        }

        currentRoomId = roomId;
        const player: Player = {
            id: socket.id,
            name,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${socket.id}`,
            isHost: false,
            isReady: false,
            score: 0
        };

        room.players[socket.id] = player;
        socket.join(roomId);

        // Notify others in room
        socket.to(roomId).emit('player-joined', player);

        // Send full state to joining player
        callback({ success: true, room });
        console.log(`Player ${name} (${socket.id}) joined room ${roomId}`);

        // Broadcast updated state to room
        io.to(roomId).emit('room-state', room);
    });

    socket.on('player-ready', (isReady) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.players[socket.id]) {
            room.players[socket.id].isReady = isReady;
            io.to(currentRoomId).emit('room-state', room);
        }
    });

    socket.on('controller-input', (input) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        // Forward input to the host
        socket.to(room.hostId).emit('player-input', socket.id, input);
    });

    socket.on('start-game', (gameId) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.hostId === socket.id) {
            room.state = 'PLAYING';
            room.currentGame = gameId;
            io.to(currentRoomId).emit('game-started', gameId);
            io.to(currentRoomId).emit('room-state', room);
        }
    });

    socket.on('return-to-lobby', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.hostId === socket.id) {
            room.state = 'LOBBY';
            room.currentGame = undefined;
            // Reset ready states
            Object.values(room.players).forEach(p => p.isReady = false);
            io.to(currentRoomId).emit('room-state', room);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        if (currentRoomId && rooms[currentRoomId]) {
            const room = rooms[currentRoomId];

            if (room.hostId === socket.id) {
                // Host disconnected, destroy room
                io.to(currentRoomId).emit('leave-room');
                delete rooms[currentRoomId];
                console.log(`Room ${currentRoomId} destroyed due to host disconnect`);
            } else {
                // Player disconnected
                delete room.players[socket.id];
                socket.to(currentRoomId).emit('player-left', socket.id);
                io.to(currentRoomId).emit('room-state', room);
            }
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Socket.io server running on port ${PORT}`);
});
