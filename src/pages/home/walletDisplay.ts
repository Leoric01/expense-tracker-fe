import { CreateAccountRequestDtoAccountType, WalletResponseDtoWalletType } from '@api/model';
import { formatAmount } from '@utils/formatAmount';
import { DEFAULT_FIAT_SCALE, minorUnitsToMajorForScale } from '@utils/moneyMinorUnits';

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

/** České popisky; klíče = backend `AccountType` / `CreateAccountRequestDto.accountType`. */
const ACCOUNT_TYPE_LABELS: Record<CreateAccountRequestDtoAccountType, string> = {
  [CreateAccountRequestDtoAccountType.CASH]: 'Hotovost',
  [CreateAccountRequestDtoAccountType.BANK_ACCOUNT]: 'Bankovní účet',
  [CreateAccountRequestDtoAccountType.CREDIT_CARD]: 'Kreditní karta',
  [CreateAccountRequestDtoAccountType.SAVINGS]: 'Spoření',
  [CreateAccountRequestDtoAccountType.INVESTMENT]: 'Investice',
  [CreateAccountRequestDtoAccountType.EXCHANGE_SPOT]: 'Spot (burza)',
  [CreateAccountRequestDtoAccountType.OTHER]: 'Jiné',
};

/** Pořadí v selectu = pořadí deklarace na backendu (`AccountType`). */
const ACCOUNT_TYPE_ORDER = [
  CreateAccountRequestDtoAccountType.CASH,
  CreateAccountRequestDtoAccountType.BANK_ACCOUNT,
  CreateAccountRequestDtoAccountType.CREDIT_CARD,
  CreateAccountRequestDtoAccountType.SAVINGS,
  CreateAccountRequestDtoAccountType.INVESTMENT,
  CreateAccountRequestDtoAccountType.EXCHANGE_SPOT,
  CreateAccountRequestDtoAccountType.OTHER,
] as const satisfies readonly CreateAccountRequestDtoAccountType[];

/** Typ účtu pro vytvoření držby (holding). */
export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPE_ORDER.map((v) => ({
  value: v,
  label: ACCOUNT_TYPE_LABELS[v],
}));

/**
 * `amountMinor` = hodnota z API v nejmenších jednotkách; `minorUnitScale` odpovídá `Asset.scale`
 * (2 = haléře u fiat, 8 = satoshi u BTC).
 */
export function formatWalletAmount(
  amountMinor: number | undefined,
  currencyCode?: string,
  minorUnitScale: number = DEFAULT_FIAT_SCALE,
): string {
  if (amountMinor == null || !Number.isFinite(amountMinor)) return '—';
  const code = (currencyCode ?? 'CZK').toUpperCase();
  return formatAmount(amountMinor, minorUnitScale, code);
}

/** Stejné jako `formatWalletAmount`, ale bez desetinných míst (zaokrouhlení dle `Intl`). */
export function formatWalletAmountWholeUnits(amountMinor: number | undefined, currencyCode?: string): string {
  const major = minorUnitsToMajorForScale(amountMinor, DEFAULT_FIAT_SCALE);
  if (major === undefined) return '—';
  const code = (currencyCode ?? 'CZK').toUpperCase();
  try {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${Math.round(major).toLocaleString('cs-CZ')} ${code}`;
  }
}
