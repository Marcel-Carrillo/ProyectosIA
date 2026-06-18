import { Router } from 'express';
import {
  listShipments,
  getShipmentById,
  createShipment,
  updateShipmentStatus,
} from '../../presentation/controllers/shipmentController';

const shipmentRouter = Router();

shipmentRouter.get('/', listShipments);
shipmentRouter.post('/', createShipment);
shipmentRouter.get('/:id', getShipmentById);
shipmentRouter.patch('/:id/status', updateShipmentStatus);

export default shipmentRouter;
