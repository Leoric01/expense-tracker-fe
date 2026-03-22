export {
  defaultDateTimeInputValue as defaultDatetimeLocal,
  toIsoFromDateTimeInput as toIsoFromDatetimeLocal,
} from '@utils/dateTimeCs';

export function parseAmount(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '.') return undefined;
  const n = parseFloat(t);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Hodnota z inputu → kanonický řetězec (číslice, max jedna desetinná tečka), bez mezer.
 * Mezery z formátování tisíců i čárka jako desetinný oddělovač se zpracují.
 */
export function canonicalAmountFromUserInput(s: string): string {
  const t = s.replace(/\s/g, '');
  if (t === '') return '';

  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  let decPos = -1;
  if (lastComma >= 0 && lastDot >= 0) decPos = Math.max(lastComma, lastDot);
  else if (lastComma >= 0) decPos = lastComma;
  else if (lastDot >= 0) decPos = lastDot;

  if (decPos >= 0) {
    const intRaw = t.slice(0, decPos).replace(/\D/g, '');
    const after = t.slice(decPos + 1);
    const fracRaw = after.replace(/\D/g, '').slice(0, 10);
    if (fracRaw !== '') return `${intRaw || '0'}.${fracRaw}`;
    if (after === '') return intRaw === '' ? '.' : `${intRaw}.`;
    return intRaw;
  }

  return t.replace(/\D/g, '');
}

/** Zobrazení: mezery po třech číslicích v celé části, desetinná čárka (jen UI). */
export function formatAmountDisplayCs(canonical: string): string {
  if (!canonical) return '';
  const trailingDot = canonical.endsWith('.');
  const dotIdx = canonical.indexOf('.');
  const intPart = dotIdx >= 0 ? canonical.slice(0, dotIdx) : canonical;
  const fracPart = dotIdx >= 0 ? canonical.slice(dotIdx + 1) : undefined;

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (trailingDot && (fracPart === undefined || fracPart === '')) {
    return `${grouped},`;
  }
  if (fracPart !== undefined) {
    return `${grouped},${fracPart}`;
  }
  return grouped;
}
