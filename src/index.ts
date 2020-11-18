import express from 'express';
import http from 'http';
import redis, { RedisClient } from 'redis';
import { handleCreated, handleJoin } from './lib/RoomManger';
import type { RoomDetails } from './lib/types/RoomDetails';

const SOCKET_OPTIONS: unknown = {
  cors: true,
  origins:["http://127.0.0.1:5000"],
};
const PORT: number = 8080;

const app: express.Application = express();
const server: http.Server = http.createServer(app);
const io: SocketIO.Server = require('socket.io')(server, SOCKET_OPTIONS);
const client: RedisClient = redis.createClient();

// SETUP REDIS
client.on('error', (err): void => {
  console.log(`Redis error: ${err}`);
})

// HANDLE SOCKETS
io.on('connection', (socket: SocketIO.Socket) => {
  let room: string = "";

  console.log(`Socket connected: ${socket.id}`)

  // 1. Room Management

  socket.on('room-created', (details: RoomDetails) => {
    room = handleCreated(client, details);
    socket.join(room);
    socket.emit('new-room-created', { room })
  })

  socket.on('room-joined', (roomId: string) => {
    const success = handleJoin(client, roomId, socket.id);

    if (success) {
      socket.join(roomId);
      socket.emit('room-join-succeeded')
    } else {
      socket.emit('room-join-failed')
    }
  })

  // 2. Chat Room Usage

  socket.on('chat-message-posted', (message) => {
    if (room) {
      console.log(`Socket: ${socket.id} wrote message: ${message.body} to room ${room}`)
      socket.to(room).emit('message-captured', message);
    }
  })

  socket.on('disconnect', (reason: string) => {

  })
})

// SERVER INITIALIZATION

server.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
