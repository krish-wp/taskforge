// JavaScript
import { createClient } from 'redis';

let WORKER_ID;

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',

  // Keep trying to reconnect when Redis is unavailable.
  socket: {
    reconnectStrategy: (retries) => {
      console.log(
        `-->[Redis] Redis unavailable. Reconnecting... attempt ${retries}`,
      );

      return Math.min(retries * 10000, 50000);
    },
  },
});

redisClient.on('connect', () => {
  console.log('-->[Redis][worker-%s] Connecting...', WORKER_ID);
});

redisClient.on('ready', () => {
  console.log('-->[Redis][worker-%s] Ready', WORKER_ID);
});

redisClient.on('reconnecting', () => {
  console.log('-->[Redis][worker-%s] Reconnecting...', WORKER_ID);
});

redisClient.on('error', (error) => {
  console.error('-->[Redis][worker-%s] Error:', WORKER_ID, error.message);
});

redisClient.on('end', () => {
  console.log('-->[Redis][worker-%s] Connection closed', WORKER_ID);
});

export const connectRedis = async (id) => {
  try {
    WORKER_ID = id || 'unknown';
    if (redisClient.isOpen) {
      return true;
    }

    await redisClient.connect();
    console.log('-->[Redis][worker-%s] Connected to Redis', WORKER_ID);
    return true;
  } catch (error) {
    console.error(
      '-->[Redis][worker-%s] Initial connection failed:',
      WORKER_ID,
      error.message,
    );
    return false;
  }
};

export const isRedisReady = () => {
  return redisClient.isReady;
};

export default redisClient;
