import Phaser from 'phaser';
import type { GamePlugin } from '../../engine/GamePlugin';
import type { Player, ControllerInput } from '../../network/types';

class Tank extends Phaser.GameObjects.Container {
    tank: Phaser.GameObjects.Image;
    turret: Phaser.GameObjects.Image;
    shadow: Phaser.GameObjects.Image;
    bullets: Phaser.Physics.Arcade.Group;
    nextFire: number = 0;
    fireRate: number = 200;
    playerId: string;
    playerName: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number, playerId: string, name: string, color: number, bullets: Phaser.Physics.Arcade.Group) {
        super(scene, x, y);

        this.playerId = playerId;
        this.bullets = bullets;

        this.shadow = scene.add.image(x, y, 'tank', 'shadow');
        this.shadow.setOrigin(0.5);

        this.tank = scene.add.image(0, 0, 'tank', 'tank1');
        this.tank.setOrigin(0.5);
        this.tank.setTint(color);

        this.turret = scene.add.image(0, 0, 'tank', 'turret');
        this.turret.setOrigin(0.3, 0.5);
        this.turret.setTint(color);

        this.playerName = scene.add.text(0, -50, name, { fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 });
        this.playerName.setOrigin(0.5);

        this.add([this.tank, this.turret, this.playerName]);
        scene.add.existing(this);
        scene.physics.world.enable(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
        body.setSize(64, 64);
    }

    update(input: ControllerInput) {
        const body = this.body as Phaser.Physics.Arcade.Body;

        // Movement
        if (input.x !== 0 || input.y !== 0) {
            const angle = Math.atan2(input.y, input.x);
            this.tank.rotation = angle + Math.PI / 2;
            this.turret.rotation = angle + Math.PI / 2;

            body.setVelocity(input.x * 200, input.y * 200);
        } else {
            body.setVelocity(0, 0);
        }

        this.shadow.x = this.x;
        this.shadow.y = this.y;
        this.shadow.rotation = this.tank.rotation;

        // Firing
        if (input.btnA && this.scene.time.now > this.nextFire) {
            this.nextFire = this.scene.time.now + this.fireRate;
            this.fire();
        }
    }

    fire() {
        const bullet = this.bullets.get(this.x, this.y) as Phaser.Physics.Arcade.Sprite;
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            const angle = this.turret.rotation - Math.PI / 2;
            this.scene.physics.velocityFromRotation(angle, 400, bullet.body.velocity);
            bullet.rotation = angle;
            (bullet as any).ownerId = this.playerId;
        }
    }
}

class TankBattleScene extends Phaser.Scene {
    players: Record<string, Tank> = {};
    bullets!: Phaser.Physics.Arcade.Group;
    playerData: Player[] = [];
    inputStates: Record<string, ControllerInput> = {};
    onSync?: (state: any) => void;

    constructor() {
        super('TankBattleScene');
    }

    init(data: { players: Player[] }) {
        this.playerData = data.players;
    }

    preload() {
        this.load.atlas('tank', 'https://labs.phaser.io/assets/games/tanks/tanks.png', 'https://labs.phaser.io/assets/games/tanks/tanks.json');
        this.load.image('bullet', 'https://labs.phaser.io/assets/games/tanks/bullet.png');
        this.load.image('earth', 'https://labs.phaser.io/assets/games/tanks/scorched_earth.png');
    }

    create() {
        this.add.tileSprite(0, 0, 1280, 720, 'earth').setOrigin(0);

        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 100
        });

        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];

        this.playerData.forEach((p, i) => {
            const tank = new Tank(
                this,
                100 + i * 200,
                100 + i * 150,
                p.id,
                p.name,
                colors[i % colors.length],
                this.bullets
            );
            this.players[p.id] = tank;
        });

        this.physics.add.collider(this.bullets, Object.values(this.players), (bullet: any, tank: any) => {
            if (bullet.ownerId !== tank.playerId) {
                bullet.setActive(false);
                bullet.setVisible(false);
                bullet.body.stop();

                // Explode effect?
                tank.setPosition(Math.random() * 800 + 200, Math.random() * 400 + 100);
            }
        });
    }

    update() {
        Object.keys(this.players).forEach(id => {
            const input = this.inputStates[id] || { x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnTurbo: false };
            this.players[id].update(input);
        });

        this.bullets.children.each((b: any) => {
            if (b.active && (b.y < 0 || b.y > 720 || b.x < 0 || b.x > 1280)) {
                b.setActive(false);
                b.setVisible(false);
            }
            return null;
        });
    }
}

class TankBattlePlugin implements GamePlugin {
    id = 'tank-battle';
    title = 'Tank Battle';
    minPlayers = 1;
    maxPlayers = 8;

    private game: Phaser.Game | null = null;
    private scene: TankBattleScene | null = null;

    init(container: HTMLDivElement, players: Player[], emitState: (state: any) => void): void {
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            parent: container,
            width: 1280,
            height: 720,
            physics: {
                default: 'arcade',
                arcade: {
                    debug: false,
                    gravity: { x: 0, y: 0 }
                }
            },
            scene: TankBattleScene,
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        this.game = new Phaser.Game(config);
        this.game.events.once('ready', () => {
            this.scene = this.game!.scene.getScene('TankBattleScene') as TankBattleScene;
            this.scene.onSync = emitState;
            this.scene.scene.restart({ players });
        });
    }

    updateInput(playerId: string, input: ControllerInput): void {
        if (this.scene) {
            this.scene.inputStates[playerId] = input;
        }
    }

    updatePlayers(players: Player[]): void {
        if (this.scene) {
            this.scene.playerData = players;
            // Handle player joining/leaving logic if needed
        }
    }

    destroy(): void {
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
            this.scene = null;
        }
    }
}

export const TankBattle = new TankBattlePlugin();
