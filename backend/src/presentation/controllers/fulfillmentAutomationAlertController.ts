import { Request, Response, NextFunction } from 'express';
import { AutomationAlertRepository } from '../../infrastructure/repositories/automationAlertRepository';

const alertRepo = new AutomationAlertRepository();

export async function listAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, pageSize, resolved } = req.query;
    // Query param `resolved=false` (sent by the admin UI's default view)
    // means "only show unresolved alerts" — the repository's own default
    // behavior. Omitting the param (admin checked "show resolved") maps to
    // the repository's `resolvedOnly: false`, which returns every alert.
    const result = await alertRepo.findAll({
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      resolvedOnly: resolved === 'false' ? undefined : false,
    });
    res.json({ success: true, data: result, message: 'Automation alerts retrieved successfully' });
  } catch (err) {
    next(err);
  }
}
