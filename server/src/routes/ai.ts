import { Router } from 'express';
import { advisorHandler, parseStatementHandler } from '../controllers/aiController';

const router = Router();
router.post('/advisor', advisorHandler);
router.post('/parse-statement', parseStatementHandler);

export default router;