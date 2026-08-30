import redisClient from '../config/redis.js';

const QUEUE_NAME = 'taskforge:jobs';

export const enqueueJob = async (jobId) => {
  await redisClient.lPush(QUEUE_NAME, jobId.toString());
};

export const dequeueJob = async () => {
  const result = await redisClient.brPop(QUEUE_NAME, 0);
  return result.element;
};
