// JavaScript
import { createClient } from 'redis';

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
  console.log('-->[Redis] Connecting...');
});

redisClient.on('ready', () => {
  console.log('-->[Redis] Ready');
});

redisClient.on('reconnecting', () => {
  console.log('-->[Redis] Reconnecting...');
});

redisClient.on('error', (error) => {
  console.error('-->[Redis] Error:', error.message);
});

redisClient.on('end', () => {
  console.log('-->[Redis] Connection closed');
});

export const connectRedis = async () => {
  try {
    if (redisClient.isOpen) {
      return true;
    }

    await redisClient.connect();
    return true;
  } catch (error) {
    console.error('-->[Redis] Initial connection failed:', error.message);
    return false;
  }
};

export const isRedisReady = () => {
  return redisClient.isReady;
};

export default redisClient;
