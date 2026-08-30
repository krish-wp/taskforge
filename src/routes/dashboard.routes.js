import { Router } from 'express';
import {
  getStats,
  getMetrics,
  getRecentJobs,
} from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/stats', getStats);
router.get('/metrics', getMetrics);
router.get('/recent', getRecentJobs);

export default router;
