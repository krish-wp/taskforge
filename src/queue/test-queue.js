import { enqueueJob, dequeueJob } from './queue.js';

await enqueueJob(101);
await enqueueJob(102);
await enqueueJob(103);

console.log('Jobs added');

const job = await dequeueJob();

console.log('Received job:', job);

process.exit(0);
