/**
 * Stejná logika jako u detailu transakce na /transactions/history (`RecentTransactionsPanel`):
 * minor jednotky + kód aktiva + scale → `Intl.NumberFormat` (bez zbytečných nul vpravo).
 */
export function formatAssetAmount(
  amountMinor: number | undefined,
  assetCode?: string,
  assetScale?: number,
): string {
  if (amountMinor == null || !Number.isFinite(amountMinor)) return '—';
  const code = (assetCode?.trim() || 'CZK').toUpperCase();
  const scale =
    Number.isFinite(assetScale) && assetScale != null && assetScale >= 0
      ? Math.min(Math.floor(assetScale), 20)
      : 2;
  const major = amountMinor / 10 ** scale;
  const formatted = new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: scale,
  }).format(major);
  return `${formatted} ${code}`;
}
