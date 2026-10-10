const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidV4 } = require('uuid');

app.use(express.static('public'));

// Redireciona a página principal para uma sala com ID único
app.get('/', (req, res) => {
    res.redirect(`/${uuidV4()}`);
});

// Entrega a página HTML baseada na URL da sala
app.get('/:room', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', socket => {
    socket.on('join-room', (roomId, userId) => {
        socket.roomId = roomId;
        socket.peerId = userId;
        
        socket.join(roomId);
        // Notifica todos na sala que um novo usuário entrou
        socket.to(roomId).emit('user-connected', userId);

        // Retorna a lista de usuários atuais na sala para quem quer começar a transmitir
        socket.on('get-peers', () => {
            const clients = io.sockets.adapter.rooms.get(socket.roomId);
            const peers = [];
            if (clients) {
                for (const clientId of clients) {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    if (clientSocket && clientSocket.peerId !== socket.peerId) {
                        peers.push(clientSocket.peerId);
                    }
                }
            }
            socket.emit('peers-list', peers);
        });

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
});

server.listen(3000, () => {
    console.log('Servidor rodando. Acesse: http://localhost:3000');
});