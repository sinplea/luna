import express from 'express';
import http from 'http';
import { createRoomManager } from './lib/RoomManger';

const app: Express.Application = express();
const server: http.Server = http.createServer(app);
const port: number = 8080;

server.listen(port, () => {
  createRoomManager(server);
});
