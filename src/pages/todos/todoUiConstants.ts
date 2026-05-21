import type { TodoResponseDtoPriority, TodoResponseDtoStatus } from '@api/model';

export const TODO_STATUS_LABELS: Record<NonNullable<TodoResponseDtoStatus>, string> = {
  TODO: 'K udělání',
  IN_PROGRESS: 'Probíhá',
  BLOCKED: 'Zablokováno',
  DONE: 'Hotovo',
  CANCELLED: 'Zrušeno',
};

export const TODO_PRIORITY_LABELS: Record<NonNullable<TodoResponseDtoPriority>, string> = {
  LOW: 'Nízká',
  MEDIUM: 'Střední',
  HIGH: 'Vysoká',
  URGENT: 'Urgentní',
};

export const TODO_STATUS_COLOR: Record<
  NonNullable<TodoResponseDtoStatus>,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
  TODO: 'default',
  IN_PROGRESS: 'primary',
  BLOCKED: 'error',
  DONE: 'success',
  CANCELLED: 'default',
};

export const TODO_PRIORITY_COLOR: Record<
  NonNullable<TodoResponseDtoPriority>,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
  LOW: 'info',
  MEDIUM: 'default',
  HIGH: 'warning',
  URGENT: 'error',
};
