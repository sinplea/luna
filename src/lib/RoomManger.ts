import { nanoid } from 'nanoid';
import { RedisClient } from 'redis';
import type { RoomDetails } from './types/RoomDetails';

const ROOM_SOCKETS_SET_NAME: string = 'watch-party:room_sockets';
const PUBLIC_ROOMS_ZSET_NAME: string = 'watch-party:public_rooms';
const ROOM_DETAILS_HASH_NAME: string = 'watch-party:room_details';

export function handleNewRoomCreated(client: RedisClient, details: RoomDetails): string {
  const id = nanoid(12);
  return id;
}