import { CreateWalletRequestDtoWalletType, WalletResponseDtoWalletType } from '@api/model';

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

export function formatWalletAmount(amount: number | undefined, currencyCode?: string): string {
  if (amount === undefined || Number.isNaN(amount)) return '—';
  const code = (currencyCode ?? 'CZK').toUpperCase();
  try {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: code }).format(amount);
  } catch {
    return `${amount.toLocaleString('cs-CZ')} ${code}`;
  }
}
