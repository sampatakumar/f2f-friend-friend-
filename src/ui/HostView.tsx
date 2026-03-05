import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { EngineWrapper } from '../engine/EngineWrapper';

const GAMES = [
    { id: 'racing3d', title: '3D Racing', maxPlayers: 8 },
    { id: 'space-arena', title: 'Space Arena', maxPlayers: 8 },
];

export default function HostView() {
    const {
        isConnected, roomId, room, activeGame,
        createRoom, startGame, returnToLobby
    } = useAppStore();

    const [loading, setLoading] = useState(false);

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center w-full h-full">
                <h1 className="text-3xl font-bold animate-pulse text-blue-400">Connecting to Server...</h1>
            </div>
        );
    }

    // State 1: No room created yet
    if (!roomId) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <h1 className="text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-8 drop-shadow-lg">
                        F2F GAMING
                    </h1>
                    <p className="text-2xl text-slate-300 mb-12">The ultimate phone-controlled party platform.</p>

                    <button
                        onClick={async () => {
                            setLoading(true);
                            await createRoom();
                            setLoading(false);
                        }}
                        disabled={loading}
                        className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-2xl rounded-xl transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Hacking Mainframe...' : 'HOST A GAME'}
                    </button>
                </motion.div>
            </div>
        );
    }

    // State 2: Active game playing
    if (activeGame) {
        return (
            <div className="absolute inset-0 w-full h-full bg-black">
                <div className="absolute top-4 left-4 z-50 bg-black/50 p-2 rounded text-white flex gap-4 backdrop-blur-md">
                    <span>Room: <strong className="text-emerald-400">{roomId}</strong></span>
                    <span>Game: <strong className="text-blue-400">{activeGame}</strong></span>
                    <button
                        onClick={returnToLobby}
                        className="ml-4 px-3 py-1 bg-red-500 hover:bg-red-400 rounded text-sm text-white font-bold"
                    >
                        END GAME
                    </button>
                </div>

                {/* GAME ENGINE CONTAINER WILL GO HERE */}
                <EngineWrapper gameId={activeGame} />
            </div>
        );
    }

    // State 3: Lobby / Game Selection
    const players = Object.values(room?.players || {});
    const joinUrl = `${window.location.origin}/controller/${roomId}`;

    return (
        <div className="flex w-full h-full bg-slate-900 p-8 gap-8">
            {/* Sidebar: Lobby & QR */}
            <div className="w-1/3 bg-slate-800 rounded-2xl p-6 flex flex-col shadow-2xl border border-slate-700">
                <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">ROOM CODE: <span className="text-white bg-slate-700 px-3 py-1 rounded">{roomId}</span></h2>

                <div className="bg-white p-4 rounded-xl self-center mb-8">
                    <QRCodeSVG value={joinUrl} size={200} />
                </div>

                <h3 className="text-xl font-bold mb-4 text-slate-300 border-b border-slate-700 pb-2">
                    Players ({players.length})
                </h3>

                <div className="flex-1 overflow-y-auto w-full flex flex-col gap-3 pr-2">
                    {players.length === 0 ? (
                        <p className="text-slate-500 text-center italic mt-10">Waiting for players to scan code...</p>
                    ) : (
                        players.map((p) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-4 bg-slate-700/50 p-3 rounded-lg border border-slate-600"
                            >
                                <img src={p.avatar} alt="avatar" className="w-12 h-12 rounded-full bg-slate-600" />
                                <div className="flex-1">
                                    <div className="font-bold text-lg">{p.name}</div>
                                    <div className={`text-sm ${p.isReady ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {p.isReady ? 'READY' : 'Waiting...'}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Area: Game Library */}
            <div className="flex-1 right bg-slate-800 rounded-2xl p-8 flex flex-col shadow-2xl border border-slate-700">
                <h2 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Game Library</h2>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-4">
                    {GAMES.map(g => (
                        <div
                            key={g.id}
                            onClick={() => {
                                if (players.length > 0) {
                                    startGame(g.id);
                                }
                            }}
                            className={`
                relative bg-slate-700 rounded-xl overflow-hidden aspect-video cursor-pointer 
                transition-transform hover:scale-[1.02] border-2 border-transparent hover:border-blue-500
                flex flex-col justify-end p-4 group
                ${players.length === 0 ? 'opacity-50 cursor-not-allowed grayscale' : ''}
              `}
                        >
                            {/* placeholder bg */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-10" />
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80')] bg-cover bg-center group-hover:scale-110 transition-transform duration-700" />

                            <div className="relative z-20">
                                <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{g.title}</h3>
                                <p className="text-slate-300 text-sm">Max {g.maxPlayers} Players</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
