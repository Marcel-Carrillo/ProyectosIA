import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { AutomationAlert } from '../../domain/models/automationAlert';
import {
  IAutomationAlertRepository,
  AutomationAlertCreateData,
  AutomationAlertListFilters,
  AutomationAlertListResult,
} from '../../domain/repositories/automationAlertRepository';

export class AutomationAlertRepository implements IAutomationAlertRepository {
  async create(data: AutomationAlertCreateData): Promise<AutomationAlert> {
    const row = await prisma.automationAlert.create({
      data: {
        type: data.type,
        customerOrderId: data.customerOrderId ?? null,
        supplierOrderId: data.supplierOrderId ?? null,
        message: data.message,
      },
    });
    return new AutomationAlert(row);
  }

  async findAll(filters: AutomationAlertListFilters = {}): Promise<AutomationAlertListResult> {
    const page = filters.page != null && Number.isFinite(filters.page) && filters.page >= 1 ? filters.page : 1;
    const pageSize =
      filters.pageSize != null && Number.isFinite(filters.pageSize) && filters.pageSize >= 1
        ? Math.min(filters.pageSize, 100)
        : 20;
    const skip = (page - 1) * pageSize;

    // Defaults to unresolved-only unless the caller explicitly asks for all.
    const where: Prisma.AutomationAlertWhereInput =
      filters.resolvedOnly === false ? {} : { resolvedAt: null };

    const [rows, total] = await prisma.$transaction([
      prisma.automationAlert.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.automationAlert.count({ where }),
    ]);

    return { items: rows.map((r) => new AutomationAlert(r)), total, page, pageSize };
  }
}
