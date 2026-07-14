import { Request, Response, NextFunction } from 'express';
import { AutomationSettingsRepository } from '../../infrastructure/repositories/automationSettingsRepository';
import { AutomationSettingsUpdateData } from '../../domain/repositories/automationSettingsRepository';
import { validateAutomationSettingsData } from '../../application/validator';

const settingsRepo = new AutomationSettingsRepository();

export async function getAutomationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await settingsRepo.get();
    res.json({ success: true, data: settings, message: 'Automation settings retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateAutomationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    validateAutomationSettingsData(req.body as Record<string, unknown>);
    const settings = await settingsRepo.update(req.body as AutomationSettingsUpdateData);
    res.json({ success: true, data: settings, message: 'Automation settings updated successfully' });
  } catch (err) {
    next(err);
  }
}
