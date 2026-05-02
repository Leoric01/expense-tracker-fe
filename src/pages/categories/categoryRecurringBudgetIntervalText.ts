import type { RecurringBudgetResponseDtoPeriodType } from '@api/model';

/** Český popis opakování podle `periodType` a `intervalValue` (1 = každé období, 2 = každé druhé …). */
export function recurringIntervalDescriptionCs(
  periodType: RecurringBudgetResponseDtoPeriodType | string | undefined,
  intervalValue: number | undefined,
): string {
  const n = intervalValue == null || intervalValue < 1 ? 1 : Math.floor(intervalValue);

  if (n === 1) {
    switch (periodType) {
      case 'DAILY':
        return 'každý den';
      case 'WEEKLY':
        return 'každý týden';
      case 'MONTHLY':
        return 'každý měsíc';
      case 'QUARTERLY':
        return 'každé čtvrtletí';
      case 'YEARLY':
        return 'každý rok';
      default:
        return 'každé období';
    }
  }

  const periodWord = (() => {
    switch (periodType) {
      case 'DAILY':
        return 'den';
      case 'WEEKLY':
        return 'týden';
      case 'MONTHLY':
        return 'měsíc';
      case 'QUARTERLY':
        return 'čtvrtletí';
      case 'YEARLY':
        return 'rok';
      default:
        return 'období';
    }
  })();

  return `každý ${n}. ${periodWord}`;
}
