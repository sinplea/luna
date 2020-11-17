import express from 'express';
import http from 'http';

const app: Express.Application = express();
const server: http.Server = http.createServer(app);
const options = {
  cors: true,
  origins:["http://127.0.0.1:5000"],
};
const io: SocketIO.Server = require('socket.io')(server, options);
const port: number = 8080;

const room: string = 'room_code';

io.on('connection', (socket: SocketIO.Socket) => {
  console.log(`Socket connected: ${socket.id}`)
  socket.join(room);

  console.log(`Socket: ${socket.id} joined room: ${room} \n`)

  socket.on('chat-message-posted', (message) => {
    console.log(`Socket: ${socket.id} wrote message: ${message.body}`)

    socket.to(room).emit('message-captured', message);
  })
})

server.listen(port, () => {
  console.log(`Server is running on port ${port} \n`)
});
