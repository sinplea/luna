import express from 'express';
import http from 'http';
import redis, { RedisClient } from 'redis';
import { handleCreated, handleJoin } from './lib/RoomManger';
import type { RoomDetails } from './lib/types/RoomDetails';

require('dotenv').config();

const SOCKET_OPTIONS: unknown = process.env.ENVIRONMENT === 'DEV' ? {
  cors: true,
  origins:[process.env.WATCH_PARTY_DEV_HOST],
} : {};

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
  console.log(`Socket connected: ${socket.id}`)
  // 1. Room Management

  socket.on('room-created', (details: RoomDetails) => {
    const newRoomId = handleCreated(client, details, socket.id);
    socket.join(newRoomId);

    // Send room id back to client to update window.location
    socket.emit('new-room-created', { room: newRoomId })
  })

  socket.on('room-joined', (roomId: string) => {
    const oldRoom =  socket.rooms[0]; // NOTE: Sockets can join more than 1 room. Need to enforce 1 room policy

    const res = handleJoin(client, [oldRoom, roomId], socket.id);

    if (res.success) {
      socket.leave(oldRoom);
      socket.join(roomId);

      socket.emit('room-join-succeeded')
    } else {
      socket.emit('room-join-failed', { message: res.msg })
    }
  })

  // 2. Chat Room Usage

  socket.on('chat-message-posted', (message) => {
    const room = socket.rooms[0];

    if (room) {
      console.log(`Socket: ${socket.id} wrote message: ${message.body} to room ${room}`)
      socket.to(room).emit('message-captured', message);
    }
  })

  socket.on('disconnect', (reason: string) => {
    // TODO: Handle disconnect
  })
})

// SERVER INITIALIZATION

server.listen(process.env.LUNA_PORT, () => {
  console.log(`Server is listening on port: ${process.env.LUNA_PORT}`);
});
