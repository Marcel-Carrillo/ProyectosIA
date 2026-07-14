import { Router } from 'express';
import {
  getAutomationSettings,
  updateAutomationSettings,
} from '../../presentation/controllers/automationSettingsController';

const settingsRouter = Router();

settingsRouter.get('/automation', getAutomationSettings);
settingsRouter.patch('/automation', updateAutomationSettings);

export default settingsRouter;
