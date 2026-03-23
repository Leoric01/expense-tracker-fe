function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Jednotná nápověda pro textová pole data (CZ). */
export const CS_DATE_FORMAT_LABEL = 'dd.MM.yyyy';

export const CS_DATE_HELPER_TEXT = `Formát ${CS_DATE_FORMAT_LABEL}`;

/** První den aktuálního kalendářního měsíce (lokální čas). */
export function startOfCurrentLocalMonthDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Lokální kalendářní datum → `dd.MM.yyyy` pro vstupní pole. */
export function formatDateDdMmYyyyFromDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Aktuální okamžik jako hodnota pro textové pole `dd.MM.yyyy HH:mm` (lokální čas). */
export function defaultDateTimeInputValue(): string {
  return formatDateTimeDdMmYyyyHhMmFromDate(new Date());
}

/** ISO z API → `dd.MM.yyyy` (lokální kalendář). */
export function formatDateDdMmYyyy(iso?: string): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** ISO z API → `dd.MM.yyyy HH:mm` (lokální čas). */
export function formatDateTimeDdMmYyyyHhMm(iso?: string): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDateTimeDdMmYyyyHhMmFromDate(d);
}

export function formatDateTimeDdMmYyyyHhMmFromDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Parsuje `dd.MM.yyyy HH:mm` nebo `dd.MM.yyyy` (čas pak 00:00).
 * Den a měsíc mohou být 1–2 číslice.
 */
export function parseCsDateTime(s: string): Date | null {
  const t = s.trim().replace(/\s+/g, ' ');
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  const yyyy = parseInt(m[3], 10);
  const hh = m[4] != null ? parseInt(m[4], 10) : 0;
  const min = m[5] != null ? parseInt(m[5], 10) : 0;
  if (hh < 0 || hh > 23 || min < 0 || min > 59) return null;
  const d = new Date(yyyy, mm, dd, hh, min, 0, 0);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm || d.getDate() !== dd) return null;
  return d;
}

/** ISO pro API z textového pole `dd.MM.yyyy HH:mm`; při neplatném vstupu `null`. */
export function toIsoFromDateTimeInput(s: string): string | null {
  const d = parseCsDateTime(s);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Začátek kalendářního dne jako UTC ISO podle lokálních Y/M/D z `d`.
 * Použití: pole jen „dd.MM.yyyy“ — bez posunu dne při `.toISOString()` (např. 1.3. → `…-03-01T00:00:00.000Z`, ne předchozí den UTC).
 */
export function calendarDayStartUtcIso(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString();
}

/** Konec kalendářního dne (23:59:59.999 UTC) pro stejné Y/M/D jako u `calendarDayStartUtcIso`. */
export function calendarDayEndUtcIso(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)).toISOString();
}
