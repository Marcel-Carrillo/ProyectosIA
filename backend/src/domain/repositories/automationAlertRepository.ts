import { AutomationAlert } from '../models/automationAlert';

export interface AutomationAlertCreateData {
  type: string;
  customerOrderId?: number;
  supplierOrderId?: number;
  message: string;
}

export interface AutomationAlertListFilters {
  resolvedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AutomationAlertListResult {
  items: AutomationAlert[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IAutomationAlertRepository {
  create(data: AutomationAlertCreateData): Promise<AutomationAlert>;
  findAll(filters?: AutomationAlertListFilters): Promise<AutomationAlertListResult>;
}
