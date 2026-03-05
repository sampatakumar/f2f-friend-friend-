// No react dom imports needed for canvas game
import type { GamePlugin } from '../../engine/GamePlugin';
import type { Player, ControllerInput } from '../../network/types';

// Simple constants for the game
const WIDTH = 1280;
const HEIGHT = 720;
const PLAYER_SPEED = 5;
const PLAYER_SIZE = 20;
const PROJECTILE_SPEED = 10;
const PROJECTILE_SIZE = 5;
const SHOOT_COOLDOWN = 200; // ms

interface Projectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: string;
    active: boolean;
}

interface PlayerState {
    id: string;
    x: number;
    y: number;
    color: string;
    score: number;
    lastShot: number;
    rotation: number; // in radians
    name: string;
}

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

class SpaceArenaPlugin implements GamePlugin {
    id = 'space-arena';
    title = 'Space Arena';
    minPlayers = 1;
    maxPlayers = 8;

    private container: HTMLDivElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private animationFrameId: number = 0;

    private players: Record<string, PlayerState> = {};
    private projectiles: Projectile[] = [];
    private inputState: Record<string, ControllerInput> = {};

    init(container: HTMLDivElement, players: Player[], _emitState: (state: any) => void): void {
        this.container = container;

        this.canvas = document.createElement('canvas');
        this.canvas.width = WIDTH;
        this.canvas.height = HEIGHT;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';
        this.canvas.style.backgroundColor = '#0f172a'; // slate-900

        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Initialize players
        players.forEach((p, index) => {
            this.inputState[p.id] = { x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnTurbo: false };
            this.players[p.id] = {
                id: p.id,
                name: p.name,
                x: WIDTH / 2 + (Math.random() - 0.5) * 400,
                y: HEIGHT / 2 + (Math.random() - 0.5) * 400,
                color: COLORS[index % COLORS.length],
                score: 0,
                lastShot: 0,
                rotation: 0,
            };
        });

        this.gameLoop = this.gameLoop.bind(this);
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }

    updateInput(playerId: string, input: ControllerInput): void {
        this.inputState[playerId] = input;
    }

    destroy(): void {
        cancelAnimationFrame(this.animationFrameId);
        if (this.canvas && this.container) {
            this.container.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
        this.container = null;
    }

    private gameLoop(timestamp: number) {
        this.update(timestamp);
        this.draw();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }

    private update(timestamp: number) {
        // Update players
        Object.values(this.players).forEach(p => {
            const input = this.inputState[p.id];
            if (!input) return;

            // Movement
            if (input.x !== 0 || input.y !== 0) {
                p.x += input.x * PLAYER_SPEED;
                p.y += input.y * PLAYER_SPEED;
                p.rotation = Math.atan2(input.y, input.x);
            }

            // Boundary checks
            p.x = Math.max(PLAYER_SIZE, Math.min(WIDTH - PLAYER_SIZE, p.x));
            p.y = Math.max(PLAYER_SIZE, Math.min(HEIGHT - PLAYER_SIZE, p.y));

            // Shooting
            if (input.btnA && timestamp - p.lastShot > SHOOT_COOLDOWN) {
                p.lastShot = timestamp;

                // Shoot in the direction we're facing (or right if never moved)
                const rot = p.rotation || 0;
                this.projectiles.push({
                    x: p.x + Math.cos(rot) * (PLAYER_SIZE + 5),
                    y: p.y + Math.sin(rot) * (PLAYER_SIZE + 5),
                    vx: Math.cos(rot) * PROJECTILE_SPEED,
                    vy: Math.sin(rot) * PROJECTILE_SPEED,
                    ownerId: p.id,
                    active: true
                });
            }
        });

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            proj.x += proj.vx;
            proj.y += proj.vy;

            // Check bounds
            if (proj.x < 0 || proj.x > WIDTH || proj.y < 0 || proj.y > HEIGHT) {
                proj.active = false;
            }

            // Check player collisions
            if (proj.active) {
                Object.values(this.players).forEach(p => {
                    if (p.id === proj.ownerId) return; // Can't hit yourself

                    const dx = p.x - proj.x;
                    const dy = p.y - proj.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < PLAYER_SIZE + PROJECTILE_SIZE) {
                        proj.active = false;

                        // Hit! Respawn hit player and give score to shooter
                        p.x = WIDTH / 2 + (Math.random() - 0.5) * 800;
                        p.y = HEIGHT / 2 + (Math.random() - 0.5) * 400;

                        if (this.players[proj.ownerId]) {
                            this.players[proj.ownerId].score += 1;
                        }
                    }
                });
            }

            if (!proj.active) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    private draw() {
        if (!this.ctx) return;

        // Clear background
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // Draw grid for space feel
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < WIDTH; i += 50) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, HEIGHT); this.ctx.stroke();
        }
        for (let j = 0; j < HEIGHT; j += 50) {
            this.ctx.beginPath(); this.ctx.moveTo(0, j); this.ctx.lineTo(WIDTH, j); this.ctx.stroke();
        }

        // Draw projectiles
        this.ctx.fillStyle = '#fef08a'; // yellow-200
        for (const proj of this.projectiles) {
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, PROJECTILE_SIZE, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw players
        Object.values(this.players).forEach(p => {
            this.ctx!.save();
            this.ctx!.translate(p.x, p.y);
            this.ctx!.rotate(p.rotation);

            // Draw primitive ship (triangle)
            this.ctx!.fillStyle = p.color;
            this.ctx!.beginPath();
            this.ctx!.moveTo(PLAYER_SIZE, 0);
            this.ctx!.lineTo(-PLAYER_SIZE / 2, PLAYER_SIZE / 2);
            this.ctx!.lineTo(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2);
            this.ctx!.closePath();
            this.ctx!.fill();

            // Add thruster glow if moving
            const input = this.inputState[p.id];
            if (input && (input.x !== 0 || input.y !== 0)) {
                this.ctx!.fillStyle = '#f97316'; // orange-500
                this.ctx!.beginPath();
                this.ctx!.moveTo(-PLAYER_SIZE / 2, PLAYER_SIZE / 4);
                this.ctx!.lineTo(-PLAYER_SIZE, 0);
                this.ctx!.lineTo(-PLAYER_SIZE / 2, -PLAYER_SIZE / 4);
                this.ctx!.closePath();
                this.ctx!.fill();
            }

            this.ctx!.restore();

            // Draw player name and score
            this.ctx!.fillStyle = 'white';
            this.ctx!.font = '14px sans-serif';
            this.ctx!.textAlign = 'center';
            this.ctx!.fillText(`${p.name} (${p.score})`, p.x, p.y - PLAYER_SIZE - 10);
        });

        // Draw Scoreboard overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(10, 10, 200, 20 + Object.keys(this.players).length * 25);
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('LEADERBOARD', 20, 30);

        const sortedPlayers = Object.values(this.players).sort((a, b) => b.score - a.score);
        sortedPlayers.forEach((p, idx) => {
            this.ctx!.fillStyle = p.color;
            this.ctx!.fillText(`${p.name}: ${p.score}`, 20, 55 + idx * 25);
        });
    }
}

export const SpaceArena = new SpaceArenaPlugin();
