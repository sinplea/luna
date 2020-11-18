import { nanoid } from 'nanoid';
import { RedisClient } from 'redis';
import type { RoomDetails } from './types/RoomDetails';

const ROOM_POPULATION_SET_NAME: string = 'watch-party:room_population';
const PUBLIC_ROOMS_ZSET_NAME: string = 'watch-party:public_rooms';
const ROOM_DETAILS_HASH_NAME: string = 'watch-party:room_details';

export function handleCreated(client: RedisClient, details: RoomDetails): string {
  const roomId = nanoid(12);

  const hashmapFields = [
    "isPublic", details.isPublic,
    "currentlyWatching", details.currentlyWatching,
    "previewThumbnail", details.previewThumbnail,
    "leader", details.leader,
  ]

  client.sadd(`${ROOM_POPULATION_SET_NAME}:${roomId}`, details.leader);
  client.zadd(`${PUBLIC_ROOMS_ZSET_NAME}`, 1, roomId);
  client.hmset(`${ROOM_DETAILS_HASH_NAME}:${roomId}`, hashmapFields)

  return roomId;
}

export function handleJoin(client: RedisClient, roomId: string, socketId: string): boolean {
  const exists = client.exists(`${ROOM_POPULATION_SET_NAME}:${roomId}`)

  if (exists) {
    const isPublic = client.hmget(`${ROOM_DETAILS_HASH_NAME}:${roomId}`, "isPublic");

    if (isPublic) {
      client.sadd(`${ROOM_POPULATION_SET_NAME}:${roomId}`, socketId);
      client.zincrby(`${PUBLIC_ROOMS_ZSET_NAME}`, 1, roomId);
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}