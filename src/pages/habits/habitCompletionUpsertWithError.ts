import { habitCompletionUpsert } from '@api/habit-completion-controller/habit-completion-controller';
import type { HabitCompletionResponseDto } from '@api/model/habitCompletionResponseDto';
import type { HabitCompletionUpsertRequestDto } from '@api/model/habitCompletionUpsertRequestDto';

function messageFromUnknownBody(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) {
      return o.message.trim();
    }
    if (typeof o.detail === 'string' && o.detail.trim()) {
      return o.detail.trim();
    }
    if (typeof o.title === 'string' && o.title.trim()) {
      return o.title.trim();
    }
  }
  return fallback;
}

/** PUT completion; při chybě vyhodí Error s textem z API nebo HTTP kódem. */
export async function habitCompletionUpsertOrThrow(
  trackerId: string,
  dto: HabitCompletionUpsertRequestDto,
): Promise<HabitCompletionResponseDto | undefined> {
  const res = await habitCompletionUpsert(trackerId, dto);
  if (res.status >= 200 && res.status < 300) {
    const body = res.data as unknown;
    if (body && typeof body === 'object' && Object.keys(body as object).length > 0) {
      return body as HabitCompletionResponseDto;
    }
    return undefined;
  }
  throw new Error(messageFromUnknownBody(res.data, `HTTP ${res.status}`));
}
