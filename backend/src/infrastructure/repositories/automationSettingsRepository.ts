import { prisma } from '../prismaClient';
import {
  IAutomationSettingsRepository,
  AutomationSettingsData,
  AutomationSettingsUpdateData,
} from '../../domain/repositories/automationSettingsRepository';

function toData(row: {
  id: number;
  targetMargin: { toString(): string };
  defaultFreightDestinationCountry: string;
  carrierAllowList: string[];
}): AutomationSettingsData {
  return {
    id: row.id,
    targetMargin: Number(row.targetMargin.toString()),
    defaultFreightDestinationCountry: row.defaultFreightDestinationCountry,
    carrierAllowList: row.carrierAllowList,
  };
}

export class AutomationSettingsRepository implements IAutomationSettingsRepository {
  async get(): Promise<AutomationSettingsData> {
    const existing = await prisma.automationSettings.findFirst({ orderBy: { id: 'asc' } });
    if (existing) return toData(existing);
    // Lazily create the singleton row — all fields have schema @default()s.
    const created = await prisma.automationSettings.create({ data: {} });
    return toData(created);
  }

  async update(data: AutomationSettingsUpdateData): Promise<AutomationSettingsData> {
    const current = await this.get();
    const updated = await prisma.automationSettings.update({
      where: { id: current.id },
      data: {
        ...(data.targetMargin !== undefined && { targetMargin: data.targetMargin }),
        ...(data.defaultFreightDestinationCountry !== undefined && {
          defaultFreightDestinationCountry: data.defaultFreightDestinationCountry,
        }),
        ...(data.carrierAllowList !== undefined && { carrierAllowList: data.carrierAllowList }),
      },
    });
    return toData(updated);
  }
}
