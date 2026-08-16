import { Router } from 'express';
import { advisorHandler } from '../controllers/aiController';

const router = Router();
router.post('/advisor', advisorHandler);

export default router;