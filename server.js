var express = require('express'), app = express(app), server = require('http').createServer(app);

app.use(express.static(__dirname));

var Eureca = require('eureca.io');
var eurecaServer = new Eureca.Server({allow: ['setId', 'spawnEnemy', 'kill', 'updateState']});
var clients = {};

var port = process.env.PORT || 8080;

eurecaServer.attach(server);

var count = 0;

eurecaServer.onConnect(function (conn) {
    console.log('New Client id=%s ', conn.id, conn.remoteAddress);

    var remote = eurecaServer.getClient(conn.id);

    clients[conn.id] = {id: conn.id, remote: remote};

    remote.setId(conn.id);

});

eurecaServer.onDisconnect(function (conn) {
    console.log('Client disconnected ', conn.id);

    var removedId = clients[conn.id].id;

    delete clients[conn.id];

    for (var c in clients) {
        var remote = clients[c].remote;
        remote.kill(conn.id);
    }

});

eurecaServer.exports.handshake = function () {
    for (var c in clients) {
        var remote = clients[c].remote;

        for (var cc in clients) {
            var x = clients[cc].lastState ? clients[cc].lastState.x : 0;
            var y = clients[cc].lastState ? clients[cc].lastState.y : 0;
            var conn = this.connection;

            var updatedClient = clients[conn.id];
            if (cc != updatedClient) {
                remote.spawnEnemy(clients[cc].id, x, y);
            }
        }
    }
}

var test = 0;

eurecaServer.exports.handleKeys = function (state) {

    var conn = this.connection;
    var updatedClient = clients[conn.id];

    for (var c in clients) {
        var remote = clients[c].remote;
        remote.updateState(updatedClient.id, state);
        clients[conn.id].lastState = state;
    }

}

server.listen(port);