import { Router } from 'express';
import {
  listReturnRequests,
  createReturnRequest,
  getReturnRequestById,
  updateReturnRequestStatus,
} from '../../presentation/controllers/returnRequestController';

const returnRequestRouter = Router();

returnRequestRouter.get('/', listReturnRequests);
returnRequestRouter.post('/', createReturnRequest);
returnRequestRouter.get('/:id', getReturnRequestById);
returnRequestRouter.patch('/:id/status', updateReturnRequestStatus);

export default returnRequestRouter;
