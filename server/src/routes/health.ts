import { Router } from 'express';
import { healthHandler } from '../controllers/healthController';

const router = Router();
router.get('/', healthHandler);

export default router;