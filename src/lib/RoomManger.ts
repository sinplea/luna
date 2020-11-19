/**
 * RoomManager.ts
 * Manages the use of redis data structures for room creation via
 * a socket.io connection. Handles incoming events from socket.io and
 * manages domain-specific queries concerning redis.
 * 
 * NOTE: Why the use of 3 redis data structures for the same data?
 * Set -> Allows us to track the population of a given room and query for a viewer count
 * Sorted Set -> Lets us easily track public, popular rooms for querying purposes
 * Hash -> Let's us store details concerning each room. 
 * 
 * The motivation to use Redis for all of this can come into question, but I believe
 * Redis is a suitable solution for room management. Rooms are easily created on a whim
 * by a user. They are also destroyed as soon as soon as they are empty. 
 * The ephemeral nature of a "room" seems to make more sense, to me, on Redis than 
 * it does in a document store like MongoDB or a relational database like MYSQL
 * 
 * Don't know for the sure; still learning Redis. (That's why there's a lot of comments).
 */
import winston from 'winston';
import { nanoid } from 'nanoid';
import { RedisClient } from 'redis';
import type { RoomDetails } from './types/RoomDetails';

const ROOM_POPULATION_SET_NAME: string = 'watch-party:room_population';
const PUBLIC_ROOMS_ZSET_NAME: string = 'watch-party:public_rooms';
const ROOM_DETAILS_HASH_NAME: string = 'watch-party:room_details';

const logger = winston.createLogger({
  transports: [
      new winston.transports.Console()
  ]
});

// I) PRIVATE HELPER FUNCTIONS

function cleanup_extraneous_rooms(client: RedisClient, rooms: [string]) {
  // Get the population of a room.
  rooms.forEach(room => {
    client.scard(`${ROOM_POPULATION_SET_NAME}:${room}`, (err, cardinality: number) => {
      if (cardinality <= 0) {
        client.del(`${ROOM_POPULATION_SET_NAME}:${room}`);
        client.del(`${ROOM_DETAILS_HASH_NAME}:${room}`);
        client.zrem(PUBLIC_ROOMS_ZSET_NAME, room); // If room doesn't exist, aka private, command is ignored
      };
    });
  })
}

// II) HANDLING WEBSOCKET EVENTS

export function handleCreated(client: RedisClient, details: RoomDetails, socket: string): string {
  // Create a new nanoid
  const roomId = nanoid(12);

  // Assign room details to fields
  // NOTE: These fields change infrequently.
  const hashmapFields = [
    "isPublic", details.isPublic,
    "currentlyWatching", details.currentlyWatching,
    "previewThumbnail", details.previewThumbnail,
    "leader", socket,
  ]

  // Create a new set. Relationship. (1) room -> (N) sockets
  client.sadd(`${ROOM_POPULATION_SET_NAME}:${roomId}`, socket);
  logger.info(`Set ${ROOM_POPULATION_SET_NAME}:${roomId} created.`)

  // Create a new sorted set if room is listed as public. Sorted by population.
  // Useful for querying popular, publicly available rooms.
  if (details.isPublic) {
    client.zadd(`${PUBLIC_ROOMS_ZSET_NAME}`, 1, roomId);
    logger.info(`Sorted Set ${PUBLIC_ROOMS_ZSET_NAME} added ${roomId} to the set.`)
  }

  // Creates a hash to store room details which can be looked up when needed.
  // Helps to display visual UI elements to a user on the client.
  client.hmset(`${ROOM_DETAILS_HASH_NAME}:${roomId}`, hashmapFields)
  logger.info(`Details added to ${ROOM_DETAILS_HASH_NAME}:${roomId} hash.`)


  logger.info(`Finished handling room creation.`)
  return roomId;
}

export function handleJoin(client: RedisClient, rooms: [string, string], socketId: string): { success: boolean, msg: string } {
  // First check to see if the client is connecting to an already created room.
  const exists = client.exists(`${ROOM_POPULATION_SET_NAME}:${rooms[1]}`)

  if (exists) {
    // If it does exist, it should have a corresponding hashmap. to determine if the room
    // is public
    const isPublic = client.hmget(`${ROOM_DETAILS_HASH_NAME}:${rooms[1]}`, "isPublic");

    if (isPublic) {
      // Update existing caches.
      client.srem(`${ROOM_POPULATION_SET_NAME}:${rooms[0]}`, socketId);
      client.zincrby(PUBLIC_ROOMS_ZSET_NAME, -1, rooms[0]);
      logger.info(`Socket ${socketId} has left: ${rooms[0]}.`)

      // Add socket id to the room set
      client.sadd(`${ROOM_POPULATION_SET_NAME}:${rooms[1]}`, socketId);
      logger.info(`${ROOM_POPULATION_SET_NAME}:${rooms[1]} added socket: ${socketId}.`)

      // Increment the public room score.
      client.zincrby(`${PUBLIC_ROOMS_ZSET_NAME}`, 1, rooms[1]);
      logger.info(`${PUBLIC_ROOMS_ZSET_NAME} at ${rooms[1]} population score updated.`)

      // Clean up old room.
      cleanup_extraneous_rooms(client, [rooms[0]]);

      return {
        success: true,
        msg: '',
      }
    } else {
      logger.notice(`Room ${rooms[1]} is not public. User requires permissions to join.`)
      return {
        success: false,
        msg: 'Room is not public.'
      }
    }
  } else {
    logger.notice(`Room ${rooms[1]} does not exist. User should be notified.`)
    return {
      success: false,
      msg: 'Room does not exist.',
    }
  }
}

// III) DOMAIN SPECIFIC QUERIES