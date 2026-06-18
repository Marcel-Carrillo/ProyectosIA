import { Router } from 'express';
import {
  listRefunds,
  getRefundById,
  createRefund,
  updateRefundStatus,
} from '../../presentation/controllers/refundController';

const refundRouter = Router();

refundRouter.get('/', listRefunds);
refundRouter.post('/', createRefund);
refundRouter.get('/:id', getRefundById);
refundRouter.patch('/:id/status', updateRefundStatus);

export default refundRouter;
