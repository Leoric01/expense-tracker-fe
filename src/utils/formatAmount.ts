export function formatAmount(amountMinorUnits: number, scale: number, currencyCode: string): string {
  const safeScale = Number.isFinite(scale) && scale >= 0 ? Math.floor(scale) : 0;
  const realValue = amountMinorUnits / Math.pow(10, safeScale);
  const fixed = realValue.toFixed(safeScale);
  const [integerRaw, fractionRaw] = fixed.split('.');
  const isNegative = integerRaw.startsWith('-');
  const integerAbs = isNegative ? integerRaw.slice(1) : integerRaw;
  const integerWithGroups = integerAbs.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const integerPart = isNegative ? `-${integerWithGroups}` : integerWithGroups;
  const numberPart = fractionRaw != null ? `${integerPart}.${fractionRaw}` : integerPart;
  return `${numberPart} ${currencyCode}`.trim();
}
