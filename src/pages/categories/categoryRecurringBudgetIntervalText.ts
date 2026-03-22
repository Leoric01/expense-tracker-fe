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

/** Text pod pole interval (krátká nápověda). */
export function intervalFieldHelperCs(
  periodType: RecurringBudgetResponseDtoPeriodType | string | undefined,
): string {
  switch (periodType) {
    case 'DAILY':
      return '1 = každý den, 2 = každý druhý den';
    case 'WEEKLY':
      return '1 = každý týden, 2 = každý druhý týden';
    case 'MONTHLY':
      return '1 = každý měsíc, 2 = každý druhý měsíc';
    case 'QUARTERLY':
      return '1 = každé čtvrtletí, 2 = každé druhé čtvrtletí';
    case 'YEARLY':
      return '1 = každý rok, 2 = každý druhý rok';
    default:
      return 'Kolik období přeskočit mezi běhy (min. 1).';
  }
}
