import { Router } from 'express';
import {
  getAllJobs,
  createJob,
  getJobById,
  updateJob,
} from '../controllers/jobs.controller.js';

const jobsRouter = Router();

jobsRouter.get('/', getAllJobs);
jobsRouter.post('/', createJob);
jobsRouter.get('/:id', getJobById);
jobsRouter.put('/:id', updateJob);

export default jobsRouter;
