import type { AssetResponseDto, HoldingResponseDto, WalletResponseDto } from '@api/model';
import {
  CreateAccountRequestDtoAccountType,
  CreateAssetRequestDtoAssetType,
  CreateInstitutionRequestDtoInstitutionType,
} from '@api/model';

/** Zda jde o často používaný krypto ticker (jinak by ISO 4217 třípísmenný kód matl FIAT vs krypto). */
const KNOWN_CRYPTO_TICKERS = new Set([
  'BTC',
  'ETH',
  'XMR',
  'LTC',
  'XRP',
  'SOL',
  'DOGE',
  'ADA',
  'DOT',
  'BCH',
  'TRX',
  'AVAX',
]);

/** Popisek v selectu aktiv (kód — název). */
export function assetSelectLabel(a: AssetResponseDto): string {
  const c = a.code?.trim().toUpperCase() ?? '';
  const n = a.name?.trim() ?? '';
  if (c && n) return `${c} — ${n}`;
  return c || n || a.id || '—';
}

type HoldingLabelInput = Pick<HoldingResponseDto, 'id' | 'institutionName' | 'accountName' | 'assetCode'>;

export function holdingLabel(h: HoldingLabelInput): string {
  const code = (h.assetCode?.trim() || '').toUpperCase();
  const parts = [h.institutionName?.trim(), h.accountName?.trim(), code || undefined].filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  return h.id ?? '—';
}

export function holdingToWalletDto(h: HoldingResponseDto): WalletResponseDto {
  const code = (h.assetCode?.trim() || 'CZK').toUpperCase();
  return {
    id: h.id,
    name: holdingLabel(h),
    currencyCode: code,
    currentBalance: h.currentAmount,
    active: h.active,
  };
}

export function institutionTypeForAccount(
  accountType: CreateAccountRequestDtoAccountType,
): CreateInstitutionRequestDtoInstitutionType {
  switch (accountType) {
    case CreateAccountRequestDtoAccountType.CASH:
      return CreateInstitutionRequestDtoInstitutionType.PERSONAL;
    case CreateAccountRequestDtoAccountType.EXCHANGE_SPOT:
      return CreateInstitutionRequestDtoInstitutionType.EXCHANGE;
    case CreateAccountRequestDtoAccountType.INVESTMENT:
      return CreateInstitutionRequestDtoInstitutionType.BROKER;
    case CreateAccountRequestDtoAccountType.BANK_ACCOUNT:
    case CreateAccountRequestDtoAccountType.CREDIT_CARD:
    case CreateAccountRequestDtoAccountType.SAVINGS:
      return CreateInstitutionRequestDtoInstitutionType.BANK;
    default:
      return CreateInstitutionRequestDtoInstitutionType.OTHER;
  }
}

/** Návrh typu a přesnosti podle kódu (CZK → fiat/2, BTC → crypto/8) — pro formulář nového aktiva. */
export function inferAssetMeta(codeUpper: string): {
  assetType: CreateAssetRequestDtoAssetType;
  scale: number;
} {
  if (KNOWN_CRYPTO_TICKERS.has(codeUpper) || codeUpper.length > 4) {
    return { assetType: CreateAssetRequestDtoAssetType.CRYPTO, scale: 8 };
  }
  return { assetType: CreateAssetRequestDtoAssetType.FIAT, scale: 2 };
}
