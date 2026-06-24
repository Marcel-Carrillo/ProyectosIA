import type { TFunction } from 'i18next';

export function orderStatusLabel(t: TFunction, status: string): string {
  return t(`status.${status}`, { defaultValue: status });
}
