// initiate the game
// x, y, rendering context, DOM element to attach to
// followed by 4 essential Phaser functions
// these 4 are then mapped to functions below

var platforms;
var bullets;

var players;
var player;

var cursors;
var spaceBar;

var bulletXSpeed = 300;

var ready = false;
var eurecaServer;

var myId;

var enemies;

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
        enemies.forEach(function (enemy) {

            if (enemy.remoteId == id) {
                enemy.kill();
                console.log('killing ', id);
            }

        }, this);
    }

    eurecaClient.exports.spawnEnemy = function (id, x, y) {
        if (id == myId) return;

        console.log('spawning an enemy:' + id + ' ' + x + ' ' + y);

        var enemyPlayer = new Player(game, x, y);
        enemyPlayer.remoteId = id;
        enemies.add(enemyPlayer);
    }

    eurecaClient.exports.updateState = function (id, state) {
        enemies.forEach(function (enemy) {
            if (enemy.remoteId == id) {
                console.log('updating!')
                enemy.input = state;
            }
        }, this);
    }

}

function preload() {
    game.stage.disableVisibilityChange = true;
    loadAssets();
}

function loadAssets() {
    // alias, path, x, y dimension
    game.load.spritesheet('player', 'assets/sprites/hero-transparent-borderless.png', 28, 28);
    game.load.spritesheet('slime', 'assets/sprites/slime-transparent-set-withdir.png', 28, 28);

    // load images
    game.load.image('bg', 'assets/bg/wall.png');
    game.load.image('ground', 'assets/bg/ground.png');
    game.load.image('bullet', 'assets/sprites/red-square-bullet.png');
}

function create() {

    console.log('ready!');

    // activate physics engine
    game.physics.startSystem(Phaser.Physics.ARCADE);

    // set the 'bg' object and repeat it across the screen
    // start x, y, size x, y, reference
    game.add.tileSprite(0, 0, 640, 480);
    // loading of assets is sequential and determines their z-index

    enemies = game.add.group();
    enemies.enableBody = true;

    bullets = game.add.group();
    bullets.enableBody = true;

    // create a generic platform group
    platforms = game.add.group();
    // enables physics to members of group
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

    // activate arrow controls
    cursors = game.input.keyboard.createCursorKeys();

    players = game.add.group();
    players.enableBody = true;

    // player is also an object now
    player = new Player(game, 0, 0);
    player.remoteId = myId;
    enemies.add(player);

}

function update() {

    if (!ready)return;

    // all inter-object interaction has been moved to their respective prototypes with the exception of:

    player.input.left = cursors.left.isDown;
    player.input.right = cursors.right.isDown;
    player.input.jump = cursors.up.isDown;

}

Platform = function (game, x, y, length, height, sprite) {
    Phaser.TileSprite.call(this, game, x, y, length, height, sprite);
}

Platform.prototype = Object.create(Phaser.TileSprite.prototype);
Platform.prototype.constructor = Platform;

Player = function (game, x, y) {
    Phaser.Sprite.call(this, game, x, y, "player");

    this.input = {
        left: false,
        right: false,
        jump: false,
        stop: false,
        fire: false
    }
    this.recentinput = {};
    game.physics.enable(this, Phaser.Physics.ARCADE);
    this.direction = 1;
    this.body.bounce.y = 0.2;
    this.body.gravity.y = 640;
    this.body.collideWorldBounds = true;
    this.animations.add('left', [5, 6, 7, 8, 9], 10, true);
    this.animations.add('right', [0, 1, 2, 3, 4], 10, true);

    // spaceBar = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    // spaceBar.onDown.add(this.attack, this);

}

Player.prototype = Object.create(Phaser.Sprite.prototype);
Player.prototype.constructor = Player;

Player.prototype.update = function () {
    game.physics.arcade.collide(this, platforms);
    this.handleMovement();
};

Player.prototype.handleMovement = function () {

    this.body.velocity.x = 0;

    if (this.input.left) {
        //  Move to the left
        this.body.velocity.x = -150;
        this.direction = -1;
        this.animations.play('left');
    }
    else if (this.input.right) {
        //  Move to the right
        this.body.velocity.x = 150;
        this.direction = 1;
        this.animations.play('right');
    } else {
        //  Stand still
        this.animations.stop();
        // set this if you want to reset the 'stance' of the player: player.frame = 4;
    }

    //  Allow the player to jump if they are touching the ground.
    if (this.input.jump && this.body.touching.down) {
        this.body.velocity.y = -350;
    }

    this.input.y = this.y;
    this.input.x = this.x;

    eurecaServer.handleKeys(this.input);

}

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