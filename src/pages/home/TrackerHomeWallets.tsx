import { transactionCreate } from '@api/transaction-controller/transaction-controller';
import { widgetItemAdd, widgetItemReplace } from '@api/widget-item-controller/widget-item-controller';
import {
  accountCreate,
  accountFindAll,
  getAccountFindAllQueryKey,
} from '@api/account-controller/account-controller';
import {
  assetCreate,
  assetFindAll,
  getAssetFindAllQueryKey,
} from '@api/asset-controller/asset-controller';
import { holdingCreate } from '@api/holding-controller/holding-controller';
import {
  getInstitutionDashboardQueryKey,
  getInstitutionFindAllQueryKey,
  institutionDashboard,
  institutionFindAll,
} from '@api/institution-controller/institution-controller';
import {
  expenseTrackerFindById,
  expenseTrackerUpdate,
  getExpenseTrackerFindByIdQueryKey,
} from '@api/expense-tracker-controller/expense-tracker-controller';
import type {
  AccountResponseDto,
  AssetResponseDto,
  ExpenseTrackerResponseDto,
  HoldingResponseDto,
  InstitutionDashboardResponseDto,
  HoldingSummaryResponseDto,
  InstitutionResponseDto,
  InstitutionSummaryResponseDto,
  PagedModelAccountResponseDto,
  PagedModelAssetResponseDto,
  PagedModelInstitutionResponseDto,
  WalletResponseDto,
} from '@api/model';
import {
  CreateAccountRequestDtoAccountType,
  CreateAssetRequestDtoAssetType,
  CreateAssetRequestDtoMarketDataSource,
  CreateTransactionRequestDtoTransactionType,
} from '@api/model';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import {
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageHeading } from '@components/PageHeading';
import { MonthDateRangePicker } from '@components/MonthDateRangePicker';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import {
  BALANCE_AMOUNTS_VISIBILITY_EVENT,
  readShowBalanceAmountsFromStorage,
} from '@utils/balanceAmountsVisibility';
import {
  dateRangeDdMmYyyyToIsoParams,
  firstDayOfMonth,
  lastDayOfMonth,
} from '@utils/dashboardPeriod';
import { formatDateDdMmYyyyFromDate, parseCsDateTime } from '@utils/dateTimeCs';
import { formatAmount } from '@utils/formatAmount';
import {
  DEFAULT_FIAT_SCALE,
  majorToMinorUnitsForScale,
  minorUnitsToMajorForScale,
} from '@utils/moneyMinorUnits';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { DragEvent, FC, FormEvent, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TransactionsV2Panel } from './TransactionsV2Panel';
import { BalanceCorrectionDialog, type BalanceCorrectionConfirmPayload } from './BalanceCorrectionDialog';
import { TransferBetweenWalletsDialog, type TransferConfirmPayload } from './TransferBetweenWalletsDialog';
import { assetSelectLabel, inferAssetMeta } from './holdingAdapter';
import { InstitutionAccountsManageDialog } from './InstitutionAccountsManageDialog';
import { ACCOUNT_TYPE_OPTIONS, formatWalletAmount } from './walletDisplay';
import {
  globalOrderAfterInstitutionTrackerReorder,
  institutionSummariesInWidgetOrder,
  orderedWalletIdsFromWidgetPayload,
  reorderIdsInList,
} from './walletOrderUtils';

type Props = {
  trackerId: string;
  trackerName: string;
};

type HoldingSummaryRow = HoldingSummaryResponseDto & {
  institutionId?: string;
  accountId?: string;
};

type InstitutionCardModel = {
  institutionId: string;
  institutionName: string;
  totalBalance?: number;
  convertedTotalBalance?: number;
  accounts: {
    accountId?: string;
    accountName: string;
    totalBalance?: number;
    convertedTotalBalance?: number;
    holdings: { summary: HoldingSummaryRow; wallet: WalletResponseDto }[];
  }[];
};

const WALLET_DRAG_MIME = 'application/x-wallet-id';
const WALLET_REORDER_MIME = 'application/x-wallet-reorder';

const ASSET_LIST_PARAMS = { page: 0, size: 500 } as const;
const TRACKER_LIST_PARAMS = { page: 0, size: 500 } as const;

const ASSET_TYPE_LABELS: Record<CreateAssetRequestDtoAssetType, string> = {
  [CreateAssetRequestDtoAssetType.FIAT]: 'Fiat',
  [CreateAssetRequestDtoAssetType.CRYPTO]: 'Krypto',
  [CreateAssetRequestDtoAssetType.OTHER]: 'Jiné',
};

const MARKET_SOURCE_LABELS: Record<CreateAssetRequestDtoMarketDataSource, string> = {
  [CreateAssetRequestDtoMarketDataSource.NONE]: 'Žádný',
  [CreateAssetRequestDtoMarketDataSource.FRANKFURTER]: 'Frankfurter (FX)',
  [CreateAssetRequestDtoMarketDataSource.COINGECKO]: 'CoinGecko',
  [CreateAssetRequestDtoMarketDataSource.MANUAL]: 'Ruční',
};

function filterAssetOptions(
  options: AssetResponseDto[],
  { inputValue }: { inputValue: string },
): AssetResponseDto[] {
  const q = inputValue.trim().toLowerCase();
  if (!q) return options;
  return options.filter((a) => {
    const code = a.code?.toLowerCase() ?? '';
    const name = a.name?.toLowerCase() ?? '';
    return code.includes(q) || name.includes(q) || (a.id?.toLowerCase().includes(q) ?? false);
  });
}

function filterInstitutionOptions(
  options: InstitutionResponseDto[],
  { inputValue }: { inputValue: string },
): InstitutionResponseDto[] {
  const q = inputValue.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (i) =>
      (i.name?.toLowerCase().includes(q) ?? false) || (i.id?.toLowerCase().includes(q) ?? false),
  );
}

function filterAccountOptions(
  options: AccountResponseDto[],
  { inputValue }: { inputValue: string },
): AccountResponseDto[] {
  const q = inputValue.trim().toLowerCase();
  if (!q) return options;
  return options.filter((a) => {
    const name = a.name?.toLowerCase() ?? '';
    return name.includes(q) || (a.id?.toLowerCase().includes(q) ?? false);
  });
}

function accountAutocompleteLabel(a: AccountResponseDto): string {
  const nm = a.name?.trim() || a.id || '—';
  const typeOpt = ACCOUNT_TYPE_OPTIONS.find((o) => o.value === a.accountType);
  const t = typeOpt?.label ?? a.accountType;
  return t ? `${nm} (${t})` : nm;
}

function holdingSummaryToWallet(s: HoldingSummaryResponseDto): WalletResponseDto {
  const code = (s.assetCode?.trim() || 'CZK').toUpperCase();
  const parts = [s.institutionName?.trim(), s.accountName?.trim(), code].filter(Boolean);
  return {
    id: s.holdingId,
    name: parts.length > 0 ? parts.join(' · ') : code,
    currencyCode: code,
    currentBalance: s.endBalance,
    active: true,
  };
}

/** Plochý seznam holdingů ve stejném pořadí jako již seřazené instituce v dashboardu. */
function flattenOrderedInstitutionHoldings(
  institutions: InstitutionSummaryResponseDto[],
): HoldingSummaryRow[] {
  const out: HoldingSummaryRow[] = [];
  for (const inst of institutions) {
    const instId = inst.institutionId;
    const instName = inst.institutionName;
    for (const acc of inst.accounts ?? []) {
      const accId = acc.accountId;
      const accName = acc.accountName;
      for (const h of acc.holdings ?? []) {
        out.push({
          ...h,
          institutionId: instId,
          institutionName: h.institutionName ?? instName,
          accountId: accId,
          accountName: h.accountName ?? accName,
        });
      }
    }
  }
  return out;
}

function buildInstitutionCards(orderedInstitutions: InstitutionSummaryResponseDto[]): InstitutionCardModel[] {
  return orderedInstitutions
    .map((inst) => {
      const institutionId = inst.institutionId?.trim();
      if (!institutionId) return null;
      const institutionName = inst.institutionName?.trim() || '—';
      const totalBalance = inst.totalBalance;
      const convertedTotalBalance = inst.convertedTotalBalance;
      const accounts = (inst.accounts ?? [])
        .map((acc) => {
          const accountName = acc.accountName?.trim() || '—';
          const accountTotalBalance = acc.totalBalance;
          const accountConvertedTotalBalance = acc.convertedTotalBalance;
          const holdings = (acc.holdings ?? [])
            .map((h) => {
              const summary: HoldingSummaryRow = {
                ...h,
                institutionId,
                institutionName: h.institutionName ?? inst.institutionName,
                accountId: acc.accountId,
                accountName: h.accountName ?? acc.accountName,
              };
              const wallet = holdingSummaryToWallet(summary);
              return wallet.id ? { summary, wallet } : null;
            })
            .filter((x): x is { summary: HoldingSummaryRow; wallet: WalletResponseDto } => Boolean(x));
          return holdings.length
            ? {
                accountId: acc.accountId,
                accountName,
                totalBalance: accountTotalBalance,
                convertedTotalBalance: accountConvertedTotalBalance,
                holdings,
              }
            : null;
        })
        .filter((x): x is InstitutionCardModel['accounts'][number] => Boolean(x));
      return accounts.length
        ? {
            institutionId,
            institutionName,
            totalBalance,
            convertedTotalBalance,
            accounts,
          }
        : null;
    })
    .filter((x): x is InstitutionCardModel => Boolean(x));
}

/**
 * Pravá strana kurzu „1 zdroj ≈ … cíl“ — počet desetinných míst podle měřítka cílového activa (display),
 * aby šly zobrazit i velmi malé hodnoty (např. BTC), včetně čísla z API ve vědecké notaci.
 */
function formatExchangeRateValue(rate: number, targetAssetScale: number): string {
  const n = typeof rate === 'number' ? rate : Number(rate);
  if (!Number.isFinite(n)) return '—';
  const scale = Math.min(
    Math.max(0, Math.floor(Number.isFinite(targetAssetScale) ? targetAssetScale : DEFAULT_FIAT_SCALE)),
    18,
  );
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: scale,
    useGrouping: true,
  }).format(n);
}

/** Převod částky v nejmenších jednotkách měny holdingu do display měny; stejný kurz jako u řádku (1 nativ ≈ rate display). */
function nativeMinorToDisplayMinorApprox(
  nativeMinor: number | undefined,
  nativeScale: number,
  exchangeRate: number | null | undefined,
  displayScale: number,
): number | null {
  if (nativeMinor == null || !Number.isFinite(nativeMinor)) return null;
  if (exchangeRate == null || !Number.isFinite(exchangeRate)) return null;
  const nativeMajor = minorUnitsToMajorForScale(nativeMinor, nativeScale);
  if (nativeMajor === undefined || !Number.isFinite(nativeMajor)) return null;
  const displayMajor = nativeMajor * exchangeRate;
  return majorToMinorUnitsForScale(displayMajor, displayScale);
}

export const TrackerHomeWallets: FC<Props> = ({ trackerId, trackerName }) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const ignoreClickUntilRef = useRef(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const prevodyTab = tabParam === 'prevody';

  const sectionNavBtnSx = (active: boolean) => ({
    borderRadius: 1,
    px: 0.5,
    py: 0.25,
    typography: 'h6' as const,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: active ? 'primary.main' : 'text.secondary',
    textDecoration: active ? 'underline' : 'none',
    textUnderlineOffset: 6,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [manageStructureOpen, setManageStructureOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionResponseDto | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountResponseDto | null>(null);
  const [quickAccountOpen, setQuickAccountOpen] = useState(false);
  const [quickAccName, setQuickAccName] = useState('');
  const [quickAccType, setQuickAccType] = useState<CreateAccountRequestDtoAccountType>(
    CreateAccountRequestDtoAccountType.CASH,
  );
  const [quickAccSubmitting, setQuickAccSubmitting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetResponseDto | null>(null);
  const [initialBalance, setInitialBalance] = useState('');

  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetSubmitting, setAssetSubmitting] = useState(false);
  const [newAssetCode, setNewAssetCode] = useState('');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetType, setNewAssetType] = useState(CreateAssetRequestDtoAssetType.FIAT);
  const [newAssetScale, setNewAssetScale] = useState('2');
  const [newMarketSource, setNewMarketSource] = useState(CreateAssetRequestDtoMarketDataSource.NONE);
  const [newMarketKey, setNewMarketKey] = useState('');

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHoverId, setDropHoverId] = useState<string | null>(null);
  const [reorderDraggingId, setReorderDraggingId] = useState<string | null>(null);
  const [reorderDropHoverId, setReorderDropHoverId] = useState<string | null>(null);
  const [transferPair, setTransferPair] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [correctionWallet, setCorrectionWallet] = useState<WalletResponseDto | null>(null);
  const [corrSubmitting, setCorrSubmitting] = useState(false);

  const [rangeFrom, setRangeFrom] = useState(() => formatDateDdMmYyyyFromDate(firstDayOfMonth()));
  const [rangeTo, setRangeTo] = useState(() => formatDateDdMmYyyyFromDate(lastDayOfMonth()));
  const [explicitDisplayAssetId, setExplicitDisplayAssetId] = useState('');
  const [explicitDisplayAssetCode, setExplicitDisplayAssetCode] = useState('');
  const [showBalanceAmounts, setShowBalanceAmounts] = useState(true);

  const dashboardParams = useMemo(
    () => dateRangeDdMmYyyyToIsoParams(rangeFrom, rangeTo),
    [rangeFrom, rangeTo],
  );

  const parsedFrom = useMemo(() => parseCsDateTime(rangeFrom.trim()), [rangeFrom]);
  const parsedTo = useMemo(() => parseCsDateTime(rangeTo.trim()), [rangeTo]);
  const bothDatesParsed = Boolean(parsedFrom && parsedTo);
  const rangeOrderInvalid =
    bothDatesParsed && parsedFrom!.getTime() > parsedTo!.getTime();
  const rangeParamsOk = Boolean(dashboardParams);

  const {
    data: dashboardRes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: dashboardParams
      ? getInstitutionDashboardQueryKey(trackerId, dashboardParams)
      : ['institution-dashboard', trackerId, 'invalid-range', rangeFrom, rangeTo],
    queryFn: async () => {
      if (!dashboardParams) throw new Error('dashboard');
      const res = await institutionDashboard(trackerId, dashboardParams);
      if (res.status < 200 || res.status >= 300) {
        throw new Error('dashboard');
      }
      return res.data as InstitutionDashboardResponseDto;
    },
    enabled: Boolean(trackerId) && rangeParamsOk,
    staleTime: 30_000,
  });

  const { data: assetsPaged } = useQuery({
    queryKey: getAssetFindAllQueryKey(ASSET_LIST_PARAMS),
    queryFn: async () => {
      const res = await assetFindAll(ASSET_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('assets');
      return res.data as PagedModelAssetResponseDto;
    },
    enabled: createOpen || assetDialogOpen,
    staleTime: 60_000,
  });

  const assetOptions = useMemo(() => {
    const rows = assetsPaged?.content ?? [];
    return [...rows]
      .filter((a) => a.active !== false && a.id)
      .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { sensitivity: 'base' }));
  }, [assetsPaged]);

  const structureQueriesEnabled = Boolean(trackerId) && (createOpen || manageStructureOpen);

  const { data: institutionsPaged } = useQuery({
    queryKey: getInstitutionFindAllQueryKey(trackerId, TRACKER_LIST_PARAMS),
    queryFn: async () => {
      const res = await institutionFindAll(trackerId, TRACKER_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('institutions');
      return res.data as PagedModelInstitutionResponseDto;
    },
    enabled: structureQueriesEnabled,
    staleTime: 30_000,
  });

  const { data: accountsPagedTracker } = useQuery({
    queryKey: getAccountFindAllQueryKey(trackerId, TRACKER_LIST_PARAMS),
    queryFn: async () => {
      const res = await accountFindAll(trackerId, TRACKER_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('accounts');
      return res.data as PagedModelAccountResponseDto;
    },
    enabled: structureQueriesEnabled,
    staleTime: 30_000,
  });

  const institutionOptions = useMemo(() => {
    const rows = institutionsPaged?.content ?? [];
    return [...rows]
      .filter((i) => i.active !== false && i.id)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'cs', { sensitivity: 'base' }));
  }, [institutionsPaged]);

  const accountsForSelectedInstitution = useMemo(() => {
    const iid = selectedInstitution?.id;
    if (!iid) return [];
    const rows = accountsPagedTracker?.content ?? [];
    return [...rows]
      .filter((a) => a.institutionId === iid && a.active !== false && a.id)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'cs', { sensitivity: 'base' }));
  }, [accountsPagedTracker, selectedInstitution?.id]);

  const dashboard = dashboardRes;
  const displayAssetCode = dashboard?.displayAssetCode?.trim().toUpperCase() ?? '';
  const displayAssetScale = dashboard?.displayAssetScale ?? DEFAULT_FIAT_SCALE;
  const dashboardMatchesExplicitSelection =
    !explicitDisplayAssetId ||
    !explicitDisplayAssetCode ||
    displayAssetCode === explicitDisplayAssetCode;
  const hasDisplayCurrency =
    Boolean(
      explicitDisplayAssetId &&
      displayAssetCode &&
      dashboard?.displayAssetScale != null &&
      dashboardMatchesExplicitSelection,
    );

  useEffect(() => {
    if (!trackerId) {
      setExplicitDisplayAssetId('');
      setExplicitDisplayAssetCode('');
      setShowBalanceAmounts(true);
      return;
    }
    const key = `tracker-${trackerId}-display-currency-selection`;
    const codeKey = `tracker-${trackerId}-display-currency-selection-code`;
    setExplicitDisplayAssetId(localStorage.getItem(key) ?? '');
    setExplicitDisplayAssetCode(localStorage.getItem(codeKey) ?? '');
    setShowBalanceAmounts(readShowBalanceAmountsFromStorage(trackerId));
  }, [trackerId]);

  useEffect(() => {
    const handleDisplaySelectionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ trackerId?: string; assetId?: string; assetCode?: string }>).detail;
      if (!detail || detail.trackerId !== trackerId) return;
      setExplicitDisplayAssetId(detail.assetId ?? '');
      setExplicitDisplayAssetCode(detail.assetCode ?? '');
    };
    window.addEventListener('display-currency-selection-changed', handleDisplaySelectionChanged);
    return () => {
      window.removeEventListener('display-currency-selection-changed', handleDisplaySelectionChanged);
    };
  }, [trackerId]);

  useEffect(() => {
    const onVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ trackerId?: string; visible?: boolean }>).detail;
      if (!detail || detail.trackerId !== trackerId) return;
      if (typeof detail.visible === 'boolean') {
        setShowBalanceAmounts(detail.visible);
      }
    };
    window.addEventListener(BALANCE_AMOUNTS_VISIBILITY_EVENT, onVisibility);
    return () => window.removeEventListener(BALANCE_AMOUNTS_VISIBILITY_EVENT, onVisibility);
  }, [trackerId]);

  const globalWalletOrder = useMemo(
    () => orderedWalletIdsFromWidgetPayload(dashboard?.widgetOrder),
    [dashboard?.widgetOrder],
  );

  const orderedInstitutions = useMemo(
    () => institutionSummariesInWidgetOrder(globalWalletOrder, dashboard?.institutions ?? []),
    [globalWalletOrder, dashboard?.institutions],
  );

  const institutionCards = useMemo(
    () => buildInstitutionCards(orderedInstitutions),
    [orderedInstitutions],
  );

  const summaries = useMemo(
    () => flattenOrderedInstitutionHoldings(orderedInstitutions),
    [orderedInstitutions],
  );

  /** Pro převody/korekce podle holdingId — měřítko z dashboardu (`HoldingSummaryResponseDto.assetScale`). */
  const holdingScaleById = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of summaries) {
      if (s.holdingId && s.assetScale != null && Number.isFinite(s.assetScale)) {
        m.set(s.holdingId, s.assetScale);
      }
    }
    return m;
  }, [summaries]);

  const orderedHoldingsForCategories = useMemo(
    () =>
      institutionCards.flatMap((c) =>
        c.accounts.flatMap((a) =>
          a.holdings.map((h) => ({ ...h.wallet, assetScale: h.summary.assetScale })),
        ),
      ),
    [institutionCards],
  );

  const hasAnyHoldings = summaries.length > 0;
  const amountMaskSx = showBalanceAmounts
    ? undefined
    : { filter: 'blur(7px)', userSelect: 'none' as const, WebkitUserSelect: 'none' as const };

  const replaceWidgetOrder = useMutation({
    mutationFn: async (nextGlobal: string[]) => {
      const res = await widgetItemReplace('INSTITUTION', nextGlobal);
      if (res.status < 200 || res.status >= 300) {
        throw new Error('Nepodařilo se uložit pořadí');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/institution/${trackerId}/dashboard`] });
    },
  });

  const invalidateFinance = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [`/api/transaction/${trackerId}`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/holding/${trackerId}`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/institution/${trackerId}/dashboard`] });
  }, [queryClient, trackerId]);

  const resetForm = () => {
    setSelectedInstitution(null);
    setSelectedAccount(null);
    setQuickAccountOpen(false);
    setQuickAccName('');
    setQuickAccType(CreateAccountRequestDtoAccountType.CASH);
    setSelectedAsset(null);
    setInitialBalance('');
  };

  const resetNewAssetForm = () => {
    setNewAssetCode('');
    setNewAssetName('');
    setNewAssetType(CreateAssetRequestDtoAssetType.FIAT);
    setNewAssetScale('2');
    setNewMarketSource(CreateAssetRequestDtoMarketDataSource.NONE);
    setNewMarketKey('');
  };

  const handleNewAssetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = newAssetCode.trim().toUpperCase();
    const nm = newAssetName.trim() || code;
    if (!code || !nm) {
      enqueueSnackbar('Vyplň kód a název aktiva', { variant: 'warning' });
      return;
    }
    const scale = Number.parseInt(newAssetScale, 10);
    if (!Number.isFinite(scale) || scale < 0) {
      enqueueSnackbar('Zadej platné scale (např. 2 u fiat, 8 u krypta)', { variant: 'warning' });
      return;
    }

    setAssetSubmitting(true);
    try {
      const res = await assetCreate({
        code,
        name: nm,
        assetType: newAssetType,
        scale,
        marketDataSource: newMarketSource,
        ...(newMarketKey.trim() ? { marketDataKey: newMarketKey.trim() } : {}),
      });
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Aktivum se nepodařilo vytvořit',
          { variant: 'error' },
        );
        return;
      }
      const created = res.data as unknown as AssetResponseDto | undefined;
      if (!created?.id) {
        enqueueSnackbar('Aktivum se nepodařilo vytvořit', { variant: 'error' });
        return;
      }
      setSelectedAsset(created);
      setAssetDialogOpen(false);
      resetNewAssetForm();
      await queryClient.invalidateQueries({ queryKey: getAssetFindAllQueryKey(ASSET_LIST_PARAMS) });
      enqueueSnackbar('Aktivum bylo vytvořeno a je vybrané v poli výše.', { variant: 'success' });
    } catch {
      enqueueSnackbar('Aktivum se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setAssetSubmitting(false);
    }
  };

  const handleQuickAccountCreate = async () => {
    const iid = selectedInstitution?.id;
    if (!iid) {
      enqueueSnackbar('Nejprve vyber instituci', { variant: 'warning' });
      return;
    }
    const nm = quickAccName.trim();
    if (!nm) {
      enqueueSnackbar('Zadej název účtu', { variant: 'warning' });
      return;
    }
    setQuickAccSubmitting(true);
    try {
      const res = await accountCreate(trackerId, {
        institutionId: iid,
        name: nm,
        accountType: quickAccType,
      });
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Účet se nepodařilo vytvořit'), { variant: 'error' });
        return;
      }
      const acc = res.data as unknown as AccountResponseDto | undefined;
      if (!acc?.id) {
        enqueueSnackbar('Účet se nepodařilo vytvořit', { variant: 'error' });
        return;
      }
      setSelectedAccount(acc);
      setQuickAccountOpen(false);
      setQuickAccName('');
      setQuickAccType(CreateAccountRequestDtoAccountType.CASH);
      await queryClient.invalidateQueries({ queryKey: [`/api/account/${trackerId}`] });
      enqueueSnackbar('Účet byl vytvořen a je vybraný', { variant: 'success' });
    } catch {
      enqueueSnackbar('Účet se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setQuickAccSubmitting(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedInstitution?.id) {
      enqueueSnackbar('Vyber instituci', { variant: 'warning' });
      return;
    }
    const accountId = selectedAccount?.id;
    const assetId = selectedAsset?.id;
    if (!accountId || !assetId) {
      enqueueSnackbar('Vyber účet a aktivum', { variant: 'warning' });
      return;
    }

    const bal = initialBalance.trim();
    let initialAmount: number | undefined;
    if (bal !== '') {
      const n = parseFloat(bal.replace(',', '.'));
      if (!Number.isNaN(n)) {
        const scale = selectedAsset?.scale ?? DEFAULT_FIAT_SCALE;
        initialAmount = majorToMinorUnitsForScale(n, scale);
      }
    }

    setSubmitting(true);
    try {
      const holdRes = await holdingCreate(trackerId, {
        accountId,
        assetId,
        ...(initialAmount != null ? { initialAmount } : {}),
      });
      if (holdRes.status < 200 || holdRes.status >= 300) {
        const err = holdRes.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Pozici (holding) se nepodařilo vytvořit',
          { variant: 'error' },
        );
        return;
      }

      enqueueSnackbar('Pozice byla vytvořena', { variant: 'success' });
      const created = holdRes.data as unknown as HoldingResponseDto | undefined;
      const instIdForWidget = created?.institutionId?.trim() ?? selectedInstitution?.id?.trim();
      setCreateOpen(false);
      resetForm();
      if (instIdForWidget) {
        try {
          const addRes = await widgetItemAdd('INSTITUTION', instIdForWidget);
          if (addRes.status >= 200 && addRes.status < 300) {
            await queryClient.invalidateQueries({ queryKey: [`/api/institution/${trackerId}/dashboard`] });
          }
        } catch {
          /* widget seznam je volitelný */
        }
      }
      await queryClient.invalidateQueries({ queryKey: [`/api/institution/${trackerId}/dashboard`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/holding/${trackerId}`] });
    } catch {
      enqueueSnackbar('Pozici se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const sourceWallet = transferPair
    ? orderedHoldingsForCategories.find((x) => x.id === transferPair.sourceId)
    : undefined;
  const targetWallet = transferPair
    ? orderedHoldingsForCategories.find((x) => x.id === transferPair.targetId)
    : undefined;
  const transferCurrenciesOk = (() => {
    if (!sourceWallet || !targetWallet) return false;
    const a = sourceWallet.currencyCode?.trim().toUpperCase() ?? '';
    const b = targetWallet.currencyCode?.trim().toUpperCase() ?? '';
    if (!a || !b) return true;
    return a === b;
  })();

  const handleTransferConfirm = useCallback(
    async (payload: TransferConfirmPayload) => {
      if (!transferPair || !transferCurrenciesOk) return;
      setTransferSubmitting(true);
      try {
        const transferScale =
          holdingScaleById.get(transferPair.sourceId) ?? DEFAULT_FIAT_SCALE;
        const res = await transactionCreate(trackerId, {
          transactionType: CreateTransactionRequestDtoTransactionType.TRANSFER,
          sourceHoldingId: transferPair.sourceId,
          targetHoldingId: transferPair.targetId,
          amount: majorToMinorUnitsForScale(payload.amountMajor, transferScale),
          transactionDate: payload.transactionDateIso,
          ...(payload.description ? { description: payload.description } : {}),
        });
        if (res.status < 200 || res.status >= 300) {
          enqueueSnackbar(apiErrorMessage(res.data, 'Převod se nepodařil'), { variant: 'error' });
          return;
        }
        enqueueSnackbar('Převod byl zaznamenán', { variant: 'success' });
        setTransferPair(null);
        await invalidateFinance();
      } catch {
        enqueueSnackbar('Převod se nepodařil', { variant: 'error' });
      } finally {
        setTransferSubmitting(false);
      }
    },
    [transferPair, transferCurrenciesOk, trackerId, enqueueSnackbar, invalidateFinance, holdingScaleById],
  );

  const handleCorrectionConfirm = useCallback(
    async (payload: BalanceCorrectionConfirmPayload) => {
      if (!correctionWallet?.id) return;
      setCorrSubmitting(true);
      try {
        const corrScale = holdingScaleById.get(correctionWallet.id) ?? DEFAULT_FIAT_SCALE;
        const res = await transactionCreate(trackerId, {
          transactionType: CreateTransactionRequestDtoTransactionType.BALANCE_ADJUSTMENT,
          holdingId: correctionWallet.id,
          correctedBalance: majorToMinorUnitsForScale(payload.correctedBalanceMajor, corrScale),
          transactionDate: payload.transactionDateIso,
          ...(payload.note ? { note: payload.note } : {}),
        });
        if (res.status < 200 || res.status >= 300) {
          enqueueSnackbar(apiErrorMessage(res.data, 'Korekci se nepodařilo uložit'), { variant: 'error' });
          return;
        }
        enqueueSnackbar('Korekce byla zaznamenána', { variant: 'success' });
        setCorrectionWallet(null);
        await invalidateFinance();
      } catch {
        enqueueSnackbar('Korekci se nepodařilo uložit', { variant: 'error' });
      } finally {
        setCorrSubmitting(false);
      }
    },
    [correctionWallet?.id, trackerId, enqueueSnackbar, invalidateFinance, holdingScaleById],
  );

  const clearDragVisual = () => {
    setDraggingId(null);
    setDropHoverId(null);
    setReorderDraggingId(null);
    setReorderDropHoverId(null);
  };

  const applyInstitutionReorderFromDrop = useCallback(
    (reorderSource: string, targetInstitutionId: string) => {
      clearDragVisual();
      if (replaceWidgetOrder.isPending) return;
      const currentInstitutionOrder = institutionCards.map((c) => c.institutionId);
      const trackerInstitutionIds = new Set(currentInstitutionOrder);
      const newInstOrder = reorderIdsInList(currentInstitutionOrder, reorderSource, targetInstitutionId);
      const nextGlobal = globalOrderAfterInstitutionTrackerReorder(
        globalWalletOrder,
        trackerInstitutionIds,
        newInstOrder,
      );
      replaceWidgetOrder.mutate(nextGlobal, {
        onError: () => enqueueSnackbar('Pořadí se nepodařilo uložit', { variant: 'error' }),
      });
    },
    [enqueueSnackbar, globalWalletOrder, institutionCards, replaceWidgetOrder],
  );

  const handleReorderDragStart = (e: DragEvent, institutionId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData(WALLET_REORDER_MIME, institutionId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(null);
    setDropHoverId(null);
    setReorderDraggingId(institutionId);
  };

  const handleDragStart = (e: DragEvent, walletId: string) => {
    setReorderDraggingId(null);
    setReorderDropHoverId(null);
    e.dataTransfer.setData(WALLET_DRAG_MIME, walletId);
    e.dataTransfer.setData('text/plain', walletId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(walletId);
  };

  const handleDragEnd = () => {
    clearDragVisual();
  };

  const handleDragOverInstitutionCard = (e: DragEvent, institutionId: string) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.includes(WALLET_REORDER_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (institutionId !== reorderDraggingId) setReorderDropHoverId(institutionId);
      setDropHoverId(null);
      return;
    }
    if (types.includes(WALLET_DRAG_MIME) || types.includes('text/plain')) {
      setReorderDropHoverId(null);
    }
  };

  const handleDragOverHoldingRow = (
    e: DragEvent,
    parentInstitutionId: string,
    holdingId: string,
    canReceiveTransfer: boolean,
  ) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.includes(WALLET_REORDER_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (parentInstitutionId !== reorderDraggingId) setReorderDropHoverId(parentInstitutionId);
      setDropHoverId(null);
      return;
    }
    if (
      canReceiveTransfer &&
      (types.includes(WALLET_DRAG_MIME) || types.includes('text/plain'))
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (holdingId !== draggingId) setDropHoverId(holdingId);
      setReorderDropHoverId(null);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDropHoverId(null);
    setReorderDropHoverId(null);
  };

  const handleInstitutionCardDrop = (e: DragEvent, targetInstitutionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreClickUntilRef.current = Date.now() + 500;
    const reorderSource = e.dataTransfer.getData(WALLET_REORDER_MIME);
    if (reorderSource && targetInstitutionId) {
      applyInstitutionReorderFromDrop(reorderSource, targetInstitutionId);
      return;
    }
    setReorderDraggingId(null);
    setReorderDropHoverId(null);
    setDraggingId(null);
    setDropHoverId(null);
  };

  const handleHoldingRowDrop = (e: DragEvent, parentInstitutionId: string, target: WalletResponseDto) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreClickUntilRef.current = Date.now() + 500;
    const reorderSource = e.dataTransfer.getData(WALLET_REORDER_MIME);
    if (reorderSource && parentInstitutionId) {
      applyInstitutionReorderFromDrop(reorderSource, parentInstitutionId);
      return;
    }
    setReorderDraggingId(null);
    setReorderDropHoverId(null);
    setDraggingId(null);
    setDropHoverId(null);
    if (target.active === false) return;
    const sourceId = e.dataTransfer.getData(WALLET_DRAG_MIME) || e.dataTransfer.getData('text/plain');
    const targetId = target.id;
    if (!sourceId || !targetId || sourceId === targetId) return;
    startTransition(() => setTransferPair({ sourceId, targetId }));
  };

  const handleHoldingRowClick = (w: WalletResponseDto) => {
    if (Date.now() < ignoreClickUntilRef.current) return;
    if (!w.id) return;
    setCorrectionWallet(w);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        useFlexGap
        sx={{ mb: 2, width: '100%', mt: 0.5 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <PageHeading component="h2">Moje pozice</PageHeading>
          <Box sx={{ flex: { sm: '0 1 auto' }, minWidth: 0 }}>
            <MonthDateRangePicker
              from={rangeFrom}
              to={rangeTo}
              onChangeFrom={setRangeFrom}
              onChangeTo={setRangeTo}
              onChangeRange={({ from, to }) => {
                setRangeFrom(from);
                setRangeTo(to);
              }}
            />
          </Box>
        </Stack>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { xs: 'stretch', sm: 'center' }, width: { xs: '100%', sm: 'auto' } }}
        >
          <Button
            variant="outlined"
            startIcon={<AccountBalanceOutlinedIcon />}
            onClick={() => setManageStructureOpen(true)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Instituce a účty
          </Button>
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Přidat pozici
          </Button>
        </Stack>
      </Stack>
      {rangeOrderInvalid && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          Datum „od“ musí být před nebo stejné jako „do“.
        </Typography>
      )}
      {!rangeParamsOk && !rangeOrderInvalid && (rangeFrom.trim() || rangeTo.trim()) && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          Zadej obě platná data.
        </Typography>
      )}
      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst pozice.
        </Typography>
      )}

      {isLoading && rangeParamsOk ? (
        <Typography color="text.secondary">Načítám pozice…</Typography>
      ) : !hasAnyHoldings ? (
        rangeParamsOk ? (
          <Typography color="text.secondary">Zatím žádná pozice — přidej první.</Typography>
        ) : null
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {institutionCards.map((card) => {
            const iid = card.institutionId;
            const canReorderGrip = !replaceWidgetOrder.isPending;
            const isInstDragReorder = reorderDraggingId === iid;
            const isInstDropHoverReorder =
              reorderDropHoverId === iid && Boolean(reorderDraggingId) && reorderDraggingId !== iid;

            return (
              <Card
                key={iid}
                variant="outlined"
                sx={{
                  height: '100%',
                  opacity: isInstDragReorder ? 0.55 : 1,
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                  outline: isInstDropHoverReorder ? (t) => `2px solid ${t.palette.primary.main}` : 'none',
                  outlineOffset: 2,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="stretch"
                  onDragOver={(e) => handleDragOverInstitutionCard(e, iid)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleInstitutionCardDrop(e, iid)}
                >
                  <Tooltip title="Změnit pořadí instituce (uloží se na server)">
                    <Box
                      data-wallet-reorder-grip
                      component="span"
                      onClick={(e) => e.stopPropagation()}
                      draggable={canReorderGrip}
                      onDragStart={(e) => handleReorderDragStart(e, iid)}
                      onDragEnd={handleDragEnd}
                      sx={{
                        cursor: canReorderGrip ? 'grab' : 'default',
                        display: 'flex',
                        alignItems: 'flex-start',
                        pt: 2,
                        pl: 1,
                        pr: 0.5,
                        flexShrink: 0,
                      }}
                      aria-label="Změnit pořadí instituce"
                    >
                      <DragIndicatorIcon fontSize="small" color="action" />
                    </Box>
                  </Tooltip>
                  <CardContent
                    component="div"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      pb: '16px !important',
                      '&:last-child': { pb: '16px !important' },
                    }}
                  >
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      alignItems="baseline"
                      justifyContent="space-between"
                      columnGap={2}
                      rowGap={0.5}
                      sx={{ mb: 1.5 }}
                    >
                      <Typography variant="h6" component="h3" sx={{ lineHeight: 1.3 }}>
                        {card.institutionName}
                      </Typography>
                      {hasDisplayCurrency && card.convertedTotalBalance != null && (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                          Celkem instituce:{' '}
                          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', ...amountMaskSx }}>
                            {formatAmount(card.convertedTotalBalance, displayAssetScale, displayAssetCode)}
                          </Box>
                        </Typography>
                      )}
                    </Stack>
                    <Stack spacing={2}>
                      {card.accounts.map((acc, accIdx) => (
                        <Stack key={acc.accountId ?? `${iid}-acc-${accIdx}`} spacing={1}>
                          <Stack
                            direction="row"
                            flexWrap="wrap"
                            alignItems="baseline"
                            columnGap={1.5}
                            rowGap={0.25}
                            sx={{ width: '100%' }}
                          >
                            <Typography
                              variant="subtitle2"
                              color="text.secondary"
                              sx={{ fontWeight: 600, minWidth: 0, flex: '1 1 auto' }}
                            >
                              Účet: {acc.accountName}
                            </Typography>
                            {hasDisplayCurrency && acc.convertedTotalBalance != null && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ flexShrink: 0, ml: 'auto', textAlign: 'right' }}
                              >
                                Celkem účet:{' '}
                                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', ...amountMaskSx }}>
                                  {formatAmount(acc.convertedTotalBalance, displayAssetScale, displayAssetCode)}
                                </Box>
                              </Typography>
                            )}
                          </Stack>
                          <Stack spacing={1} sx={{ pl: 0.5, borderLeft: 2, borderColor: 'divider' }}>
                            {acc.holdings.map(({ summary: sm, wallet: w }) => {
                              const hid = w.id ?? '';
                              const rowScale = sm.assetScale ?? DEFAULT_FIAT_SCALE;
                              const rowNativeCode = (w.currencyCode?.trim() || '').toUpperCase();
                              const shouldUseDisplayConversion =
                                hasDisplayCurrency && rowNativeCode !== displayAssetCode;
                              const convertedUnavailable =
                                shouldUseDisplayConversion && sm.convertedEndBalance == null;
                              const shouldShowConvertedHolding =
                                shouldUseDisplayConversion && sm.convertedEndBalance != null;
                              const hasConvertedPeriodValues =
                                shouldUseDisplayConversion &&
                                sm.convertedStartBalance != null &&
                                sm.convertedEndBalance != null;
                              const convertedPeriodDiff = hasConvertedPeriodValues
                                ? (sm.convertedEndBalance ?? 0) - (sm.convertedStartBalance ?? 0)
                                : null;
                              const netMinor = sm.difference;
                              const netColorSx =
                                netMinor == null || !Number.isFinite(netMinor) || netMinor === 0
                                  ? { color: 'text.secondary' }
                                  : netMinor > 0
                                    ? { color: 'success.main' }
                                    : { color: 'error.main' };
                              const periodDiffVal = hasConvertedPeriodValues ? convertedPeriodDiff : null;
                              const periodDiffColorSx =
                                periodDiffVal == null ||
                                !Number.isFinite(periodDiffVal) ||
                                periodDiffVal === 0
                                  ? { color: 'text.secondary' }
                                  : periodDiffVal > 0
                                    ? { color: 'success.main' }
                                    : { color: 'error.main' };
                              const displayCode = displayAssetCode || '—';
                              const convertedIncomeDisplayMinor = shouldUseDisplayConversion
                                ? nativeMinorToDisplayMinorApprox(
                                    sm.totalIncome,
                                    rowScale,
                                    sm.exchangeRate,
                                    displayAssetScale,
                                  )
                                : null;
                              const convertedExpenseDisplayMinor = shouldUseDisplayConversion
                                ? nativeMinorToDisplayMinorApprox(
                                    sm.totalExpense,
                                    rowScale,
                                    sm.exchangeRate,
                                    displayAssetScale,
                                  )
                                : null;
                              const exchangeRateTooltipText =
                                sm.exchangeRate != null
                                  ? `1 ${rowNativeCode || sm.assetCode || '—'} ≈ ${formatExchangeRateValue(
                                      sm.exchangeRate,
                                      displayAssetScale,
                                    )} ${displayAssetCode || displayCode}`
                                  : 'Kurz nedostupný';
                              const canDragTransfer = Boolean(w.id) && w.active !== false;
                              const isRowDragging = draggingId === w.id;
                              const isRowDropHoverTransfer =
                                dropHoverId === hid && Boolean(draggingId) && draggingId !== hid;

                              return (
                                <Box
                                  key={hid}
                                  onDragOver={(e) =>
                                    handleDragOverHoldingRow(e, iid, hid, w.active !== false)
                                  }
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleHoldingRowDrop(e, iid, w)}
                                  onClick={(ev) => {
                                    if ((ev.target as HTMLElement).closest('[data-wallet-reorder-grip]')) return;
                                    handleHoldingRowClick(w);
                                  }}
                                  draggable={canDragTransfer}
                                  onDragStart={
                                    canDragTransfer ? (e) => handleDragStart(e, w.id!) : undefined
                                  }
                                  onDragEnd={handleDragEnd}
                                  sx={{
                                    cursor: 'pointer',
                                    pl: 1,
                                    pr: 0.5,
                                    py: 0.75,
                                    borderRadius: 1,
                                    opacity: isRowDragging ? 0.55 : 1,
                                    outline: isRowDropHoverTransfer
                                      ? (t) => `2px solid ${t.palette.primary.main}`
                                      : 'none',
                                    outlineOffset: 0,
                                    '&:hover': { bgcolor: 'action.hover' },
                                  }}
                                >
                                  <Stack spacing={0.35} sx={{ minWidth: 0, width: '100%' }}>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'baseline',
                                        gap: 1,
                                        flexWrap: 'wrap',
                                        width: '100%',
                                      }}
                                    >
                                      <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
                                        <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(w.currentBalance, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                        {w.active === false && (
                                          <Chip size="small" label="Neaktivní" variant="outlined" />
                                        )}
                                      </Stack>
                                      {shouldUseDisplayConversion && shouldShowConvertedHolding && (
                                        <Tooltip title={exchangeRateTooltipText} describeChild>
                                          <Box
                                            component="span"
                                            sx={{
                                              ml: 'auto',
                                              textAlign: 'right',
                                              display: 'inline-block',
                                              cursor: 'help',
                                              maxWidth: '100%',
                                            }}
                                          >
                                            <Typography
                                              component="span"
                                              variant="body1"
                                              sx={{
                                                fontWeight: 600,
                                                lineHeight: 1.25,
                                                display: 'block',
                                              }}
                                            >
                                              <Box component="span" sx={amountMaskSx}>
                                                {formatAmount(
                                                  sm.convertedEndBalance,
                                                  displayAssetScale,
                                                  displayAssetCode,
                                                )}
                                              </Box>
                                            </Typography>
                                          </Box>
                                        </Tooltip>
                                      )}
                                      {shouldUseDisplayConversion && convertedUnavailable && (
                                        <Tooltip
                                          title={
                                            sm.exchangeRate != null ? (
                                              <>
                                                Konvertovaný zůstatek není k dispozici.
                                                <br />
                                                {exchangeRateTooltipText}
                                              </>
                                            ) : (
                                              'Konvertovaný zůstatek není k dispozici. Kurz také chybí.'
                                            )
                                          }
                                          describeChild
                                        >
                                          <Box
                                            component="span"
                                            sx={{
                                              ml: 'auto',
                                              textAlign: 'right',
                                              display: 'inline-block',
                                              cursor: 'help',
                                              maxWidth: '100%',
                                            }}
                                          >
                                            <Typography
                                              component="span"
                                              variant="caption"
                                              color="text.secondary"
                                              sx={{ lineHeight: 1.35, display: 'block' }}
                                            >
                                              Konvertovaný zůstatek není k dispozici.
                                            </Typography>
                                          </Box>
                                        </Tooltip>
                                      )}
                                    </Box>

                                    {shouldUseDisplayConversion ? (
                                      <Box
                                        sx={{
                                          display: 'grid',
                                          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                                          columnGap: 2,
                                          rowGap: 0.25,
                                          alignItems: 'baseline',
                                          width: '100%',
                                        }}
                                      >
                                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                          Začátek{' '}
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(sm.startBalance, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                        {sm.convertedStartBalance != null ? (
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ lineHeight: 1.35, textAlign: 'right' }}
                                          >
                                            Začátek v {displayCode}:{' '}
                                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', ...amountMaskSx }}>
                                              {formatAmount(
                                                sm.convertedStartBalance,
                                                displayAssetScale,
                                                displayAssetCode,
                                              )}
                                            </Box>
                                          </Typography>
                                        ) : (
                                          <Box sx={{ minHeight: '1.35em' }} aria-hidden />
                                        )}

                                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                          Příjem{' '}
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(sm.totalIncome, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                        {convertedIncomeDisplayMinor != null ? (
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ lineHeight: 1.35, textAlign: 'right' }}
                                          >
                                            Příjem v {displayCode}:{' '}
                                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', ...amountMaskSx }}>
                                              {formatAmount(
                                                convertedIncomeDisplayMinor,
                                                displayAssetScale,
                                                displayAssetCode,
                                              )}
                                            </Box>
                                          </Typography>
                                        ) : sm.exchangeRate == null ? (
                                          <Tooltip title="Bez kurzu nelze odhadnout částku v display měně.">
                                            <Typography
                                              component="span"
                                              variant="caption"
                                              color="text.secondary"
                                              sx={{ lineHeight: 1.35, textAlign: 'right', display: 'block' }}
                                            >
                                              Příjem v {displayCode}:{' '}
                                              <Box component="span" sx={amountMaskSx}>
                                                —
                                              </Box>
                                            </Typography>
                                          </Tooltip>
                                        ) : (
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ lineHeight: 1.35, textAlign: 'right' }}
                                          >
                                            Příjem v {displayCode}:{' '}
                                            <Box component="span" sx={amountMaskSx}>
                                              —
                                            </Box>
                                          </Typography>
                                        )}

                                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                          Výdaj{' '}
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(sm.totalExpense, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                        {convertedExpenseDisplayMinor != null ? (
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ lineHeight: 1.35, textAlign: 'right' }}
                                          >
                                            Výdaj v {displayCode}:{' '}
                                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', ...amountMaskSx }}>
                                              {formatAmount(
                                                convertedExpenseDisplayMinor,
                                                displayAssetScale,
                                                displayAssetCode,
                                              )}
                                            </Box>
                                          </Typography>
                                        ) : sm.exchangeRate == null ? (
                                          <Tooltip title="Bez kurzu nelze odhadnout částku v display měně.">
                                            <Typography
                                              component="span"
                                              variant="caption"
                                              color="text.secondary"
                                              sx={{ lineHeight: 1.35, textAlign: 'right', display: 'block' }}
                                            >
                                              Výdaj v {displayCode}:{' '}
                                              <Box component="span" sx={amountMaskSx}>
                                                —
                                              </Box>
                                            </Typography>
                                          </Tooltip>
                                        ) : (
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ lineHeight: 1.35, textAlign: 'right' }}
                                          >
                                            Výdaj v {displayCode}:{' '}
                                            <Box component="span" sx={amountMaskSx}>
                                              —
                                            </Box>
                                          </Typography>
                                        )}

                                        <Divider sx={{ gridColumn: '1 / -1', my: 0.35 }} />

                                        <Typography variant="caption" display="block" sx={{ lineHeight: 1.35, ...netColorSx }}>
                                          Net:{' '}
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(sm.difference, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                        {hasConvertedPeriodValues ? (
                                          <Typography
                                            variant="caption"
                                            display="block"
                                            sx={{ lineHeight: 1.35, textAlign: 'right', ...periodDiffColorSx }}
                                          >
                                            Δ {displayCode}:{' '}
                                            <Box component="span" sx={{ fontWeight: 600, ...amountMaskSx }}>
                                              {formatAmount(
                                                convertedPeriodDiff,
                                                displayAssetScale,
                                                displayAssetCode,
                                              )}
                                            </Box>
                                          </Typography>
                                        ) : (
                                          <Box sx={{ minHeight: '1.35em' }} aria-hidden />
                                        )}
                                      </Box>
                                    ) : (
                                      <Stack alignItems="flex-start" spacing={0.25} sx={{ width: '100%' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                          Začátek{' '}
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(sm.startBalance, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                          Příjem{' '}
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(sm.totalIncome, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                          Výdaj{' '}
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(sm.totalExpense, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                        <Divider sx={{ alignSelf: 'stretch', width: '100%', my: 0.35 }} />
                                        <Typography variant="caption" display="block" sx={{ lineHeight: 1.35, ...netColorSx }}>
                                          Net:{' '}
                                          <Box component="span" sx={amountMaskSx}>
                                            {formatWalletAmount(sm.difference, w.currencyCode, rowScale)}
                                          </Box>
                                        </Typography>
                                      </Stack>
                                    )}
                                  </Stack>
                                </Box>
                              );
                            })}
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Stack>
              </Card>
            );
          })}
        </Box>
      )}

      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 4, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}
        component="nav"
        aria-label="Přepnout sekci"
      >
        <ButtonBase
          disableRipple
          onClick={() => setSearchParams({ tab: 'prevody' })}
          sx={sectionNavBtnSx(prevodyTab)}
        >
          Převody V2
        </ButtonBase>
      </Stack>

      {prevodyTab && <TransactionsV2Panel trackerId={trackerId} />}

      <TransferBetweenWalletsDialog
        open={Boolean(transferPair)}
        sourceWallet={sourceWallet}
        targetWallet={targetWallet}
        transferCurrenciesOk={transferCurrenciesOk}
        submitting={transferSubmitting}
        onClose={() => !transferSubmitting && setTransferPair(null)}
        onConfirm={handleTransferConfirm}
        onInvalidAmount={() => enqueueSnackbar('Zadej kladnou částku', { variant: 'warning' })}
        onInvalidDate={() =>
          enqueueSnackbar('Neplatné datum a čas — použij formát dd.MM.yyyy HH:mm', {
            variant: 'warning',
          })
        }
      />

      <BalanceCorrectionDialog
        open={Boolean(correctionWallet)}
        wallet={correctionWallet}
        amountMinorUnitScale={
          correctionWallet?.id
            ? holdingScaleById.get(correctionWallet.id) ?? DEFAULT_FIAT_SCALE
            : DEFAULT_FIAT_SCALE
        }
        submitting={corrSubmitting}
        onClose={() => !corrSubmitting && setCorrectionWallet(null)}
        onConfirm={handleCorrectionConfirm}
        onInvalidAmount={() =>
          enqueueSnackbar('Zadej skutečný zůstatek po inventuře', { variant: 'warning' })
        }
        onInvalidDate={() =>
          enqueueSnackbar('Neplatné datum a čas — použij formát dd.MM.yyyy HH:mm', {
            variant: 'warning',
          })
        }
      />

      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nová pozice</DialogTitle>
        <Box component="form" onSubmit={handleCreate} noValidate>
          <DialogContent>
            <Stack spacing={2}>
              <Button
                type="button"
                variant="text"
                size="small"
                onClick={() => {
                  setManageStructureOpen(true);
                }}
                sx={{ alignSelf: 'flex-start' }}
              >
                Spravovat instituce a účty…
              </Button>
              <Autocomplete
                options={institutionOptions}
                getOptionLabel={(o) => o.name?.trim() || o.id || '—'}
                value={selectedInstitution}
                onChange={(_, v) => {
                  setSelectedInstitution(v);
                  setSelectedAccount(null);
                  setQuickAccountOpen(false);
                }}
                isOptionEqualToValue={(a, b) => Boolean(a.id && b.id && a.id === b.id)}
                filterOptions={filterInstitutionOptions}
                noOptionsText="Žádná instituce — přidej ji v „Instituce a účty“"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Instituce"
                    helperText="Instituce sdružuje více účtů (např. jedna banka, více produktů)"
                  />
                )}
              />
              <Autocomplete
                options={accountsForSelectedInstitution}
                getOptionLabel={(o) => accountAutocompleteLabel(o)}
                value={selectedAccount}
                onChange={(_, v) => setSelectedAccount(v)}
                disabled={!selectedInstitution}
                isOptionEqualToValue={(a, b) => Boolean(a.id && b.id && a.id === b.id)}
                filterOptions={filterAccountOptions}
                noOptionsText={
                  selectedInstitution ? 'U této instituce zatím nic není — přidej účet níže' : 'Nejprve vyber instituci'
                }
                renderInput={(params) => (
                  <TextField {...params} label="Účet" helperText="Účet u vybrané instituce" />
                )}
              />
              <Button
                type="button"
                size="small"
                variant="outlined"
                disabled={!selectedInstitution || submitting}
                onClick={() => setQuickAccountOpen((v) => !v)}
              >
                {quickAccountOpen ? 'Skrýt' : 'Nový účet u této instituci…'}
              </Button>
              <Collapse in={quickAccountOpen && Boolean(selectedInstitution)} unmountOnExit>
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="caption" color="text.secondary">
                      Účet se uloží pod institucí „{selectedInstitution?.name ?? '—'}“.
                    </Typography>
                    <TextField
                      label="Název účtu"
                      value={quickAccName}
                      onChange={(e) => setQuickAccName(e.target.value)}
                      size="small"
                      fullWidth
                    />
                    <FormControl fullWidth size="small">
                      <InputLabel id="quick-acc-type">Typ účtu</InputLabel>
                      <Select
                        labelId="quick-acc-type"
                        label="Typ účtu"
                        value={quickAccType}
                        onChange={(e) => setQuickAccType(e.target.value as CreateAccountRequestDtoAccountType)}
                      >
                        {ACCOUNT_TYPE_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Stack direction="row" spacing={1}>
                      <Button
                        type="button"
                        variant="contained"
                        size="small"
                        disabled={quickAccSubmitting}
                        onClick={() => void handleQuickAccountCreate()}
                      >
                        Vytvořit účet
                      </Button>
                      <Button
                        type="button"
                        size="small"
                        onClick={() => {
                          setQuickAccountOpen(false);
                          setQuickAccName('');
                        }}
                        disabled={quickAccSubmitting}
                      >
                        Zrušit
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              </Collapse>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
                <Autocomplete
                  sx={{ flex: 1, minWidth: 0 }}
                  options={assetOptions}
                  getOptionLabel={(o) => assetSelectLabel(o)}
                  value={selectedAsset}
                  onChange={(_, v) => setSelectedAsset(v)}
                  isOptionEqualToValue={(a, b) => Boolean(a.id && b.id && a.id === b.id)}
                  filterOptions={filterAssetOptions}
                  noOptionsText={createOpen && !assetDialogOpen ? 'Žádná shoda — založ aktivum' : 'Žádná shoda'}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Aktivum"
                      helperText="Globální seznam z /api/asset (měna, krypto, …)"
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => {
                    resetNewAssetForm();
                    setAssetDialogOpen(true);
                  }}
                  disabled={submitting}
                  sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}
                >
                  Nové aktivum…
                </Button>
              </Stack>
              <TextField
                label="Počáteční zůstatek (volitelné)"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                fullWidth
                type="text"
                inputMode="decimal"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Vytvořit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <InstitutionAccountsManageDialog
        trackerId={trackerId}
        open={manageStructureOpen}
        onClose={() => setManageStructureOpen(false)}
      />

      <Dialog
        open={assetDialogOpen}
        onClose={() => !assetSubmitting && setAssetDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nové aktivum</DialogTitle>
        <Box component="form" onSubmit={handleNewAssetSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Kód"
                value={newAssetCode}
                onChange={(e) => setNewAssetCode(e.target.value)}
                onBlur={() => {
                  const c = newAssetCode.trim().toUpperCase();
                  if (!c) return;
                  const m = inferAssetMeta(c);
                  setNewAssetType(m.assetType);
                  setNewAssetScale(String(m.scale));
                }}
                required
                fullWidth
                autoFocus
                inputProps={{ maxLength: 32, style: { textTransform: 'uppercase' } }}
                helperText="Po opuštění pole: návrh typu a scale (CZK→fiat/2, BTC→crypto/8)"
              />
              <TextField
                label="Název"
                value={newAssetName}
                onChange={(e) => setNewAssetName(e.target.value)}
                fullWidth
                helperText="Volitelné — výchozí je shodný s kódem"
              />
              <FormControl fullWidth required>
                <InputLabel id="new-asset-type-label">Typ aktiva</InputLabel>
                <Select
                  labelId="new-asset-type-label"
                  label="Typ aktiva"
                  value={newAssetType}
                  onChange={(e) => setNewAssetType(e.target.value as CreateAssetRequestDtoAssetType)}
                >
                  {(Object.values(CreateAssetRequestDtoAssetType) as CreateAssetRequestDtoAssetType[]).map(
                    (v) => (
                      <MenuItem key={v} value={v}>
                        {ASSET_TYPE_LABELS[v]}
                      </MenuItem>
                    ),
                  )}
                </Select>
              </FormControl>
              <TextField
                label="Scale (des. místa)"
                value={newAssetScale}
                onChange={(e) => setNewAssetScale(e.target.value)}
                required
                fullWidth
                inputMode="numeric"
              />
              <FormControl fullWidth required>
                <InputLabel id="new-market-label">Zdroj tržních dat</InputLabel>
                <Select
                  labelId="new-market-label"
                  label="Zdroj tržních dat"
                  value={newMarketSource}
                  onChange={(e) =>
                    setNewMarketSource(e.target.value as CreateAssetRequestDtoMarketDataSource)
                  }
                >
                  {(
                    Object.values(
                      CreateAssetRequestDtoMarketDataSource,
                    ) as CreateAssetRequestDtoMarketDataSource[]
                  ).map((v) => (
                    <MenuItem key={v} value={v}>
                      {MARKET_SOURCE_LABELS[v]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Klíč u zdroje (volitelné)"
                value={newMarketKey}
                onChange={(e) => setNewMarketKey(e.target.value)}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setAssetDialogOpen(false)} disabled={assetSubmitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={assetSubmitting}>
              Vytvořit aktivum
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};
