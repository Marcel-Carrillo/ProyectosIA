export interface AutomationSettingsData {
  id: number;
  targetMargin: number;
  defaultFreightDestinationCountry: string;
  carrierAllowList: string[];
}

export interface AutomationSettingsUpdateData {
  targetMargin?: number;
  defaultFreightDestinationCountry?: string;
  carrierAllowList?: string[];
}

export interface IAutomationSettingsRepository {
  /** Lazily creates the singleton row with schema defaults if none exists yet. */
  get(): Promise<AutomationSettingsData>;
  update(data: AutomationSettingsUpdateData): Promise<AutomationSettingsData>;
}
