import { CreateWalletRequestDtoWalletType, WalletResponseDtoWalletType } from '@api/model';
import { minorUnitsToMajor } from '@utils/moneyMinorUnits';

const TYPE_LABELS: Record<string, string> = {
  [WalletResponseDtoWalletType.CASH]: 'Hotovost',
  [WalletResponseDtoWalletType.BANK_ACCOUNT]: 'Bankovní účet',
  [WalletResponseDtoWalletType.CREDIT_CARD]: 'Kreditní karta',
  [WalletResponseDtoWalletType.SAVINGS]: 'Spoření',
  [WalletResponseDtoWalletType.INVESTMENT]: 'Investice',
  [WalletResponseDtoWalletType.OTHER]: 'Jiné',
};

export function walletTypeLabel(t?: string): string {
  if (!t) return '—';
  return TYPE_LABELS[t] ?? t;
}

export const WALLET_TYPE_OPTIONS = Object.values(CreateWalletRequestDtoWalletType).map((v) => ({
  value: v,
  label: TYPE_LABELS[v] ?? v,
}));

/** `amountMinor` = hodnota z API v haléřích/centech. */
export function formatWalletAmount(amountMinor: number | undefined, currencyCode?: string): string {
  const major = minorUnitsToMajor(amountMinor);
  if (major === undefined) return '—';
  const code = (currencyCode ?? 'CZK').toUpperCase();
  try {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: code }).format(major);
  } catch {
    return `${major.toLocaleString('cs-CZ')} ${code}`;
  }
}
