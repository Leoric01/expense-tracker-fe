import { HabitCompletionStateDtoStatus } from '@api/model/habitCompletionStateDtoStatus';
import { HabitCompletionUpsertRequestDtoStatus } from '@api/model/habitCompletionUpsertRequestDtoStatus';

export type HabitCompletionDialogStatus =
  (typeof HabitCompletionUpsertRequestDtoStatus)[keyof typeof HabitCompletionUpsertRequestDtoStatus];

export function completionStateToDialogStatus(status: string | undefined): HabitCompletionDialogStatus {
  if (status === HabitCompletionStateDtoStatus.SKIPPED) {
    return HabitCompletionUpsertRequestDtoStatus.SKIPPED;
  }
  if (status === HabitCompletionStateDtoStatus.MISSED) {
    return HabitCompletionUpsertRequestDtoStatus.MISSED;
  }
  if (status === HabitCompletionStateDtoStatus.PARTIALLY_COMPLETED) {
    return HabitCompletionUpsertRequestDtoStatus.PARTIALLY_COMPLETED;
  }
  return HabitCompletionUpsertRequestDtoStatus.DONE;
}
