import { Router } from 'express';
import { listAlerts } from '../../presentation/controllers/fulfillmentAutomationAlertController';

const fulfillmentAutomationRouter = Router();

fulfillmentAutomationRouter.get('/alerts', listAlerts);

export default fulfillmentAutomationRouter;
