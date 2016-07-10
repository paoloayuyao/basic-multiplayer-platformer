
var platforms;
var bullets;

var player;

var cursors;
var spaceBar;

var bulletXSpeed = 300;

var ready = false;
var eurecaServer;

var myId;

var enemies = {};

function clientSetup() {
    var eurecaClient = new Eureca.Client();
    eurecaClient.ready(function (proxy) {
        eurecaServer = proxy;
    });

    eurecaClient.exports.setId = function (id) {
        myId = id;
        create();
        eurecaServer.handshake();
        ready = true;
    }

    eurecaClient.exports.kill = function (id) {
        enemiesRegistry[id].kill();
    }

    eurecaClient.exports.spawnEnemy = function (id, x, y) {
        if (id == myId) return;
        var enemy = new Player(game, x, y);
        enemies[id] = enemy;
    }

    eurecaClient.exports.updateState = function (id, state) {
        var enemy = enemies[id];
        enemy.cursor = state;
        enemy.update();
    }

}

function preload() {
    game.stage.disableVisibilityChange = true;
    loadAssets();
}

function loadAssets() {
    game.load.spritesheet('player', 'assets/sprites/hero-transparent-borderless.png', 28, 28);
    game.load.spritesheet('slime', 'assets/sprites/slime-transparent-set-withdir.png', 28, 28);
    game.load.image('bg', 'assets/bg/wall.png');
    game.load.image('ground', 'assets/bg/ground.png');
    game.load.image('bullet', 'assets/sprites/red-square-bullet.png');
}

function create() {
    game.physics.startSystem(Phaser.Physics.ARCADE);
    game.add.tileSprite(0, 0, 640, 480);

    bullets = game.add.group();
    bullets.enableBody = true;

    platforms = game.add.group();
    platforms.enableBody = true;

    var ground = new Platform(game, 0, game.world.height - 16, 640, 16, 'ground');
    platforms.add(ground);

    // start x, y, size x, y, reference
    for (var i = 1; i <= 6; i++) {
        // we now use Platform objects
        var ledge = new Platform(game, 50, i * 64, 32 * i * 2, 16, 'ground');
        platforms.add(ledge);
    }

    for (var i = 6; i >= 1; i--) {
        var ledge = new Platform(game, (game.width - 32 * i * 2) - 50, (game.height - 64 * i) - 32, 32 * i * 2, 16, 'ground')
        platforms.add(ledge);
    }

    platforms.forEach(function (item) {
        item.body.collideWorldBounds = true;
        item.body.immovable = true;
        item.body.allowGravity = false;
    }, this);

    cursors = game.input.keyboard.createCursorKeys();

    player = new Player(game, 0, 0);
    enemies[myId] = player;

    var sprite = player.sprite;
    sprite.bringToTop();

}

function update() {

    if (!ready)return;

    player.input.left = cursors.left.isDown;
    player.input.right = cursors.right.isDown;
    player.input.jump = cursors.up.isDown;
    player.input.stop = !player.input.left && !player.input.right && !player.input.jump;

    for (var i in enemies) {
        if (!enemies[i]) continue;
        var enemy = enemies[i];
        var sprite = enemy.sprite;
        if (sprite.alive) {
            enemy.update();
        }

    }

}

Platform = function (game, x, y, length, height, sprite) {
    Phaser.TileSprite.call(this, game, x, y, length, height, sprite);
}

Platform.prototype = Object.create(Phaser.TileSprite.prototype);
Platform.prototype.constructor = Platform;

Player = function (game, x, y) {

    this.input = {
        left: false,
        right: false,
        jump: false,
        stop: false
    }

    this.cursor = {
        left: false,
        right: false,
        jump: false,
        stop: false
    }

    this.sprite = game.add.sprite(x, y, 'player');
    this.sprite.id = myId;
    this.sprite.x = x;
    this.sprite.y = y;
    game.physics.enable(this.sprite, Phaser.Physics.ARCADE);

    this.sprite.direction = 1;
    this.sprite.body.bounce.y = 0.2;
    this.sprite.body.gravity.y = 640;
    this.sprite.body.collideWorldBounds = true;
    this.sprite.animations.add('left', [5, 6, 7, 8, 9], 10, true);
    this.sprite.animations.add('right', [0, 1, 2, 3, 4], 10, true);

    // spaceBar = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    // spaceBar.onDown.add(this.attack, this);

}

Player.prototype = Object.create(Phaser.Sprite.prototype);
Player.prototype.constructor = Player;

Player.prototype.update = function () {
    game.physics.arcade.collide(this.sprite, platforms);

    var inputChanged = (
        this.cursor.left != this.input.left ||
        this.cursor.right != this.input.right ||
        this.cursor.jump != this.input.jump
        );

    if (inputChanged) {
        if (this.sprite.id == myId) {
            this.input.x = this.sprite.x;
            this.input.y = this.sprite.y;
            eurecaServer.handleKeys(this.input);
        }
    }

    if(!this.cursor.stop){
        if (this.cursor.left) {
            this.sprite.body.velocity.x = -150;
            this.sprite.direction = -1;
            this.sprite.animations.play('left');
        } else if (this.cursor.right) {
            this.sprite.body.velocity.x = 150;
            this.sprite.direction = 1;
            this.sprite.animations.play('right');
        }

        if (this.sprite.body.velocity.x == 150) {
            this.sprite.body.velocity.x -= 10;
        }

        if (this.cursor.jump && this.sprite.body.touching.down) {
            this.sprite.body.velocity.y = -350;
        }
    } else {
        this.sprite.body.velocity.x = 0;
        this.sprite.animations.stop();
    }



};

Player.prototype.attack = function () {
    if (bullets.length < 5) {
        var bullet = new Bullet(game, this.x + 10, this.y + 10, this.direction, bulletXSpeed);
        bullets.add(bullet);
    }
}

Bullet = function (game, x, y, direction, speed) {
    Phaser.Sprite.call(this, game, x, y, "bullet");
    game.physics.enable(this, Phaser.Physics.ARCADE);
    this.xSpeed = direction * speed;
};

Bullet.prototype = Object.create(Phaser.Sprite.prototype);
Bullet.prototype.constructor = Bullet;

Bullet.prototype.update = function () {

    game.physics.arcade.overlap(this, platforms, function (bullet) {
        bullet.destroy();
    });

    this.body.velocity.y = 0;
    this.body.velocity.x = this.xSpeed;
    if (this.x < 0 || this.x > 640) {
        this.destroy();
    }

};

var game = new Phaser.Game(640, 480, Phaser.AUTO, '1', {
    preload: preload, create: clientSetup, update: update
});