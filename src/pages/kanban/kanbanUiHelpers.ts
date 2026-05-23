export function priorityColor(p: number | undefined): string {
  if (!p) return 'text.disabled';
  if (p >= 8) return 'error.main';
  if (p >= 5) return 'warning.main';
  return 'success.main';
}

export function priorityLabel(p: number | undefined): string {
  if (!p) return '—';
  if (p >= 8) return 'Vysoká';
  if (p >= 5) return 'Střední';
  return 'Nízká';
}

export function formatKanbanDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatKanbanDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
