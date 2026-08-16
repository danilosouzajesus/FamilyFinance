import { Router } from 'express';
import {
  getConfig,
  getConnectToken,
  handleWebhook,
  syncFromPluggy,
  listPending,
  listInvestments,
  approvePending,
  reconcilePending,
  ignorePending,
  listConnections,
  createConnection,
  removeConnection,
  listAccounts,
  mapAccount,
  generateDemoPending,
  pluggyStatus,
} from '../controllers/pluggyController';

const router = Router();

router.get('/config', getConfig);
router.get('/connect-token', getConnectToken);
router.post('/webhook', handleWebhook);
router.post('/sync', syncFromPluggy);
router.get('/pending', listPending);
router.get('/investments', listInvestments);
router.post('/pending/:id/approve', approvePending);
router.post('/pending/:id/reconcile', reconcilePending);
router.post('/pending/:id/ignore', ignorePending);
router.get('/connections', listConnections);
router.post('/connections', createConnection);
router.delete('/connections/:itemId', removeConnection);
router.get('/accounts', listAccounts);
router.post('/accounts/map', mapAccount);
router.post('/demo/generate', generateDemoPending);
router.get('/status', pluggyStatus);

export default router;