const express = require('express');
const socket = require('socket.io');

const app = express();
const http = require('http').Server(app);
const io = socket(http);
const port = process.env.PORT || 3030;

app.use(express.static('public'));

io.on('connection', socket => {
    console.log(`Connected on Socket Id - ${socket.id}`);

    const currentRoom = 'DEFAULT';

    socket.on('JOIN', roomName => {
        socket.join(currentRoom);

        io.to(socket.id).emit('ROOM_JOINED', currentRoom);

        socket.broadcast.to(currentRoom).emit('NEW_CONNECTION', null);
    });

    socket.on('MESSAGE', msg => {
        console.log(`New Message - ${msg.text}`);
        socket.broadcast.to(currentRoom).emit('MESSAGE', msg);
    });

    socket.on('PUBLIC_KEY', key => {
        socket.broadcast.to(currentRoom).emit('PUBLIC_KEY', key);
    });

    socket.on('disconnect', () => {
        socket.broadcast.to(currentRoom).emit('USER_DISCONNECTED', null);
    });
});

http.listen(port, () => {
  console.log(`Chat server listening on port ${port}.`)
})
