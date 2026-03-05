import Phaser from 'phaser';
import type { GamePlugin } from '../../engine/GamePlugin';
import type { Player, ControllerInput } from '../../network/types';

class InvadersScene extends Phaser.Scene {
    playerShips: Record<string, Phaser.Physics.Arcade.Sprite> = {};
    aliens!: Phaser.Physics.Arcade.Group;
    bullets!: Phaser.Physics.Arcade.Group;
    alienBullets!: Phaser.Physics.Arcade.Group;
    playerData: Player[] = [];
    inputStates: Record<string, ControllerInput> = {};
    score = 0;
    scoreText!: Phaser.GameObjects.Text;

    constructor() {
        super('InvadersScene');
    }

    init(data: { players: Player[] }) {
        this.playerData = data.players;
    }

    preload() {
        this.load.image('bullet', 'https://labs.phaser.io/assets/games/invaders/bullet.png');
        this.load.image('enemyBullet', 'https://labs.phaser.io/assets/games/invaders/enemy-bullet.png');
        this.load.spritesheet('invader', 'https://labs.phaser.io/assets/games/invaders/invader32x32x4.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('ship', 'https://labs.phaser.io/assets/games/invaders/player.png');
        this.load.spritesheet('kaboom', 'https://labs.phaser.io/assets/games/invaders/explode.png', { frameWidth: 128, frameHeight: 128 });
        this.load.image('starfield', 'https://labs.phaser.io/assets/games/invaders/starfield.png');
    }

    create() {
        this.add.tileSprite(0, 0, 1280, 720, 'starfield').setOrigin(0);

        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 30
        });

        this.alienBullets = this.physics.add.group({
            defaultKey: 'enemyBullet',
            maxSize: 30
        });

        this.aliens = this.physics.add.group();
        this.createAliens();

        const colors = [0xffffff, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        this.playerData.forEach((p, i) => {
            const ship = this.physics.add.sprite(400 + i * 100, 650, 'ship');
            ship.setCollideWorldBounds(true);
            ship.setTint(colors[i % colors.length]);
            this.playerShips[p.id] = ship;
        });

        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', color: '#fff' });

        this.physics.add.overlap(this.bullets, this.aliens, this.collisionHandler, undefined, this);
        this.physics.add.overlap(this.alienBullets, Object.values(this.playerShips), this.enemyHitsPlayer, undefined, this);

        this.time.addEvent({
            delay: 1000,
            callback: this.alienFires,
            callbackScope: this,
            loop: true
        });
    }

    createAliens() {
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 10; x++) {
                const alien = this.aliens.create(200 + x * 48, 100 + y * 50, 'invader');
                alien.setOrigin(0.5);
                alien.play('invade');
                (alien.body as Phaser.Physics.Arcade.Body).setImmovable(true);
            }
        }

        this.tweens.add({
            targets: this.aliens.getChildren(),
            x: '+=200',
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    update() {
        Object.keys(this.playerShips).forEach(id => {
            const input = this.inputStates[id] || { x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnTurbo: false };
            const ship = this.playerShips[id];

            ship.setVelocityX(input.x * 300);

            if (input.btnA) {
                this.fireBullet(ship);
            }
        });
    }

    fireBullet(ship: Phaser.Physics.Arcade.Sprite) {
        const bullet = this.bullets.get(ship.x, ship.y - 20) as Phaser.Physics.Arcade.Sprite;
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            (bullet.body as Phaser.Physics.Arcade.Body).velocity.y = -400;
        }
    }

    alienFires() {
        const alien = Phaser.Utils.Array.GetRandom(this.aliens.getChildren().filter(a => a.active)) as Phaser.Physics.Arcade.Sprite;
        if (alien) {
            const bullet = this.alienBullets.get(alien.x, alien.y) as Phaser.Physics.Arcade.Sprite;
            if (bullet) {
                bullet.setActive(true);
                bullet.setVisible(true);
                (bullet.body as Phaser.Physics.Arcade.Body).velocity.y = 200;
            }
        }
    }

    collisionHandler(bullet: any, alien: any) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();
        alien.setActive(false);
        alien.setVisible(false);
        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);

        if (this.aliens.countActive() === 0) {
            this.score += 1000;
            this.scoreText.setText('Score: ' + this.score);
            this.createAliens();
        }
    }

    enemyHitsPlayer(ship: any, bullet: any) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();

        ship.setAlpha(0.5);
        this.time.delayedCall(1000, () => ship.setAlpha(1));
    }
}

class InvadersPlugin implements GamePlugin {
    id = 'invaders';
    title = 'Space Invaders';
    minPlayers = 1;
    maxPlayers = 8;

    private game: Phaser.Game | null = null;
    private scene: InvadersScene | null = null;

    init(container: HTMLDivElement, players: Player[], _emitState: (state: any) => void): void {
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
            scene: InvadersScene,
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        this.game = new Phaser.Game(config);
        this.game.events.once('ready', () => {
            this.scene = this.game!.scene.getScene('InvadersScene') as InvadersScene;
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

export const Invaders = new InvadersPlugin();
