import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

export default function ControllerView() {
    const { roomId } = useParams();
    const { isConnected, joinRoom, room, me, setReady, sendInput } = useAppStore();
    const [name, setName] = useState('');
    const [joined, setJoined] = useState(false);
    const [error, setError] = useState('');

    const joystickRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
        };
    }, []);

    const requestFullscreenAndLandscape = async () => {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
            // Attempt to lock orientation to landscape
            const so = screen.orientation as any;
            if (so && so.lock) {
                await so.lock('landscape').catch((err: any) => {
                    console.warn('Orientation lock failed:', err);
                });
            }
        } catch (err) {
            console.warn('Fullscreen request failed:', err);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !roomId) return;

        // Request fullscreen upon user interaction
        requestFullscreenAndLandscape();

        const res = await joinRoom(roomId, name);
        if (res.success) {
            setJoined(true);
        } else {
            setError(res.error || 'Failed to join room');
        }
    };

    const handleGamepadButton = (btn: string, state: boolean) => {
        if (state && navigator.vibrate) navigator.vibrate(20);
        sendInput({
            x: 0, y: 0,
            btnA: btn === 'A' ? state : false,
            btnB: btn === 'B' ? state : false,
            btnX: btn === 'X' ? state : false,
            btnY: btn === 'Y' ? state : false,
            btnTurbo: btn === 'T' ? state : false,
        });
    };

    if (!isConnected) {
        return <div className="p-8 text-center text-xl">Connecting...</div>;
    }

    if (!joined || !me) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6 text-white text-center">
                <h1 className="text-4xl font-bold mb-2">Join Room</h1>
                <h2 className="text-2xl text-emerald-400 mb-8 font-mono">{roomId}</h2>

                <form onSubmit={handleJoin} className="w-full max-w-sm flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="Your Name"
                        value={name}
                        onChange={e => setName(e.target.value.substring(0, 12))}
                        className="w-full px-6 py-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-xl text-center focus:border-blue-500 outline-none"
                        required
                    />
                    {error && <p className="text-red-400">{error}</p>}
                    <button
                        type="submit"
                        className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xl transition-colors active:bg-blue-700"
                    >
                        JOIN NOW
                    </button>
                </form>
            </div>
        );
    }

    if (room?.state === 'LOBBY' || room?.state === 'SCOREBOARD') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6 text-white text-center">
                <img src={me.avatar} alt="avatar" className="w-24 h-24 rounded-full bg-slate-700 mb-4" />
                <h1 className="text-3xl font-bold mb-8">{me.name}</h1>

                <button
                    onClick={() => {
                        requestFullscreenAndLandscape();
                        setReady(!me.isReady);
                    }}
                    className={`w-full py-6 rounded-2xl font-black text-2xl transition-colors ${me.isReady
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                >
                    {me.isReady ? 'READY!' : 'TAP TO READY UP'}
                </button>
                <p className="mt-8 text-slate-400">Look at the Host screen.</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900 text-white select-none touch-none flex flex-col justify-between overflow-hidden">
            <div className="h-12 bg-slate-800 flex justify-between items-center px-4 shadow-md">
                <span className="font-bold">{me.name}</span>
                <span className="text-emerald-400 text-sm">{room?.currentGame}</span>
            </div>

            <div className="flex-1 right flex items-center justify-between px-8 sm:px-16" style={{ touchAction: 'none' }}>

                <div
                    ref={joystickRef}
                    onPointerDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const cx = rect.left + rect.width / 2;
                        const cy = rect.top + rect.height / 2;
                        e.currentTarget.setPointerCapture(e.pointerId);

                        const updateStick = (evt: React.PointerEvent) => {
                            const dx = evt.clientX - cx;
                            const dy = evt.clientY - cy;
                            const maxR = rect.width / 2;
                            let x = dx; let y = dy;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > maxR) {
                                x = (dx / dist) * maxR;
                                y = (dy / dist) * maxR;
                            }
                            const stick = evt.currentTarget.querySelector('.stick') as HTMLElement;
                            if (stick) stick.style.transform = `translate(${x}px, ${y}px)`;

                            sendInput({
                                x: +(x / maxR).toFixed(2),
                                y: +(y / maxR).toFixed(2),
                                btnA: false, btnB: false, btnX: false, btnY: false, btnTurbo: false
                            });
                        };

                        updateStick(e);

                        e.currentTarget.onpointermove = (moveEvt: any) => updateStick(moveEvt);
                        e.currentTarget.onpointerup = (upEvt: any) => {
                            const stick = upEvt.currentTarget.querySelector('.stick') as HTMLElement;
                            if (stick) stick.style.transform = `translate(0px, 0px)`;
                            upEvt.currentTarget.onpointermove = null;
                            upEvt.currentTarget.onpointerup = null;
                            upEvt.currentTarget.releasePointerCapture(upEvt.pointerId);
                            sendInput({ x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnTurbo: false });
                        };
                    }}
                    className="w-40 h-40 bg-slate-800 rounded-full border-4 border-slate-700 flex items-center justify-center relative touch-none"
                >
                    <div className="stick w-16 h-16 bg-slate-600 rounded-full shadow-lg transition-transform duration-75" />
                </div>

                <div className="relative w-48 h-48 touch-none">
                    <button
                        onPointerDown={() => handleGamepadButton('Y', true)}
                        onPointerUp={() => handleGamepadButton('Y', false)}
                        onPointerLeave={() => handleGamepadButton('Y', false)}
                        className="absolute top-0 left-1/2 -ml-8 w-16 h-16 rounded-full bg-yellow-500 active:bg-yellow-400 active:scale-95 shadow-lg border-2 border-yellow-600 font-bold text-slate-900 text-2xl"
                    >Y</button>

                    <button
                        onPointerDown={() => handleGamepadButton('B', true)}
                        onPointerUp={() => handleGamepadButton('B', false)}
                        onPointerLeave={() => handleGamepadButton('B', false)}
                        className="absolute top-1/2 right-0 -mt-8 w-16 h-16 rounded-full bg-red-500 active:bg-red-400 active:scale-95 shadow-lg border-2 border-red-600 font-bold text-slate-900 text-2xl"
                    >B</button>

                    <button
                        onPointerDown={() => handleGamepadButton('A', true)}
                        onPointerUp={() => handleGamepadButton('A', false)}
                        onPointerLeave={() => handleGamepadButton('A', false)}
                        className="absolute bottom-0 left-1/2 -ml-8 w-16 h-16 rounded-full bg-green-500 active:bg-green-400 active:scale-95 shadow-lg border-2 border-green-600 font-bold text-slate-900 text-2xl"
                    >A</button>

                    <button
                        onPointerDown={() => handleGamepadButton('X', true)}
                        onPointerUp={() => handleGamepadButton('X', false)}
                        onPointerLeave={() => handleGamepadButton('X', false)}
                        className="absolute top-1/2 left-0 -mt-8 w-16 h-16 rounded-full bg-blue-500 active:bg-blue-400 active:scale-95 shadow-lg border-2 border-blue-600 font-bold text-slate-900 text-2xl"
                    >X</button>
                </div>
            </div>

            <div className="h-4" />
        </div>
    );
}
