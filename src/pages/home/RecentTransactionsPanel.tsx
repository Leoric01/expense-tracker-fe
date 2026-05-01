import { categoryFindAllActive } from '@api/category-controller/category-controller';
import type {
  CategoryResponseDto,
  HoldingResponseDto,
  PagedModelCategoryResponseDto,
  PagedModelHoldingResponseDto,
  TransactionFindAllPageableParams,
  TransactionPageItemResponseDto,
  TransactionPageResponseDto,
  UpdateTransactionRequestDto,
} from '@api/model';
import {
  TransactionFindAllPageableRateMode,
  TransactionFindAllPageableTransactionType,
  TransactionPageItemResponseDtoBalanceAdjustmentDirection,
  TransactionPageItemResponseDtoStatus,
  TransactionPageItemResponseDtoTransactionType,
} from '@api/model';
import {
  getTransactionFindAllPageableQueryKey,
  transactionCancel,
  transactionFindAllPageable,
  transactionUpdate,
  transactionUploadAttachment,
} from '@api/transaction-controller/transaction-controller';
import { holdingFindAll } from '@api/holding-controller/holding-controller';
import { useDebouncedValue } from '@hooks/useDebouncedValue';
import {
  Autocomplete,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { dateRangeDdMmYyyyToIsoParams } from '@utils/dashboardPeriod';
import {
  formatDateTimeDdMmYyyyHhMm,
  toIsoFromDateTimeInput,
} from '@utils/dateTimeCs';
import { DEFAULT_FIAT_SCALE, majorToMinorUnitsForScale, minorUnitsToMajorForScale } from '@utils/moneyMinorUnits';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, Fragment, type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { asCategoryChildren, toCategoryTree } from '@pages/categories/categoryTreeUtils';
import { holdingLabel } from './holdingAdapter';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import { useSnackbar } from 'notistack';
import { AmountTextFieldCs } from './AmountTextFieldCs';
import { parseAmount } from './transactionFormUtils';

/** Všechny podkategorie (ne kořeny) v pořadí stromu DFS s hloubkou pro odsazení v menu. */
function buildSubcategoryMenuRows(tree: CategoryResponseDto[]): { id: string; label: string; depth: number }[] {
  const rows: { id: string; label: string; depth: number }[] = [];
  const walk = (node: CategoryResponseDto, depth: number) => {
    const ch = asCategoryChildren(node.children);
    for (const c of ch) {
      if (!c.id) continue;
      rows.push({ id: c.id, label: c.name?.trim() || c.id, depth });
      walk(c, depth + 1);
    }
  };
  for (const r of tree) walk(r, 0);
  return rows;
}

/** Všechny kategorie v pořadí stromu DFS; label drží celou cestu kvůli duplicitním názvům. */
function buildCategoryMenuRows(
  tree: CategoryResponseDto[],
): { id: string; label: string; depth: number }[] {
  const rows: { id: string; label: string; depth: number }[] = [];
  const walk = (node: CategoryResponseDto, depth: number, path: string[]) => {
    if (!node.id) return;
    const name = node.name?.trim() || node.id;
    const nextPath = [...path, name];
    rows.push({ id: node.id, label: nextPath.join(' / '), depth });
    for (const child of asCategoryChildren(node.children)) {
      walk(child, depth + 1, nextPath);
    }
  };
  for (const root of tree) walk(root, 0, []);
  return rows;
}

/** Lokální filtrování položek v Autocomplete (název nebo id). */
function filterOptionsByQuery<T extends { label: string; id?: string }>(
  options: T[],
  { inputValue }: { inputValue: string },
): T[] {
  const q = inputValue.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => {
    if (o.label.toLowerCase().includes(q)) return true;
    if (o.id && o.id.toLowerCase().includes(q)) return true;
    return false;
  });
}

const DEFAULT_ROWS = 25;
const CATEGORY_LIST_PARAMS = { page: 0, size: 500 } as const;
const WALLET_LIST_PARAMS = { page: 0, size: 200 } as const;
const TX_SORT_FIELDS = {
  date: 'transactionDate',
  type: 'transactionType',
  holding: 'holdingName',
  amount: 'amount',
} as const;

type SortField = keyof typeof TX_SORT_FIELDS;
type SortDirection = 'asc' | 'desc';
type TxSortState = { field: SortField; direction: SortDirection } | null;
type TransactionRow = TransactionPageItemResponseDto;
type AmountRateMode = TransactionFindAllPageableRateMode;

/** Sloupec data; při nouzi tooltip v řádku. */
const DATE_COL_SX = {
  width: 150,
  minWidth: 150,
  maxWidth: 150,
  boxSizing: 'border-box' as const,
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  pr: 0.5,
};

/** Užší sloupec typu; celý text v title. */
const TYPE_COL_SX = {
  width: 76,
  minWidth: 76,
  maxWidth: 76,
  boxSizing: 'border-box' as const,
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  pr: 0.5,
};

const STATUS_COL_SX = {
  width: 84,
  minWidth: 84,
  maxWidth: 84,
  boxSizing: 'border-box' as const,
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  pl: 0,
  pr: 0.5,
};

const WALLET_COL_SX = {
  maxWidth: 214,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

const ROOT_CATEGORY_COL_SX = {
  maxWidth: 160,
  minWidth: 96,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

/** Širší sloupec popisu (+60px oproti původnímu chování). */
const DESCRIPTION_COL_SX = {
  minWidth: 300,
  width: '36%',
  maxWidth: '100%',
  wordBreak: 'break-word' as const,
};

function txTypeLabel(t?: string): string {
  switch (t) {
    case TransactionPageItemResponseDtoTransactionType.TRANSFER:
      return 'Převod';
    case TransactionPageItemResponseDtoTransactionType.INCOME:
      return 'Příjem';
    case TransactionPageItemResponseDtoTransactionType.EXPENSE:
      return 'Výdaj';
    case TransactionPageItemResponseDtoTransactionType.BALANCE_ADJUSTMENT:
      return 'Korekce';
    default:
      return t ?? '—';
  }
}

function statusLabel(s?: string): string {
  switch (s) {
    case TransactionPageItemResponseDtoStatus.PENDING:
      return 'Čeká';
    case TransactionPageItemResponseDtoStatus.COMPLETED:
      return 'Dokončeno';
    case TransactionPageItemResponseDtoStatus.CANCELLED:
      return 'Zrušeno';
    default:
      return s ?? '—';
  }
}

function statusColor(s: string | undefined, theme: Theme): string {
  switch (s) {
    case TransactionPageItemResponseDtoStatus.COMPLETED:
      return theme.palette.success.main;
    case TransactionPageItemResponseDtoStatus.CANCELLED:
      return theme.palette.error.main;
    case TransactionPageItemResponseDtoStatus.PENDING:
      return theme.palette.warning.main;
    default:
      return theme.palette.text.secondary;
  }
}

function balanceDirectionLabel(d?: string): string {
  switch (d) {
    case TransactionPageItemResponseDtoBalanceAdjustmentDirection.DEDUCTION:
      return 'Snížení zůstatku';
    case TransactionPageItemResponseDtoBalanceAdjustmentDirection.ADDITION:
      return 'Navýšení zůstatku';
    default:
      return d ?? '—';
  }
}

/** Částka podle typu: příjem zeleně, výdaj červeně, převod neutrálně (na světlém pozadí text.primary), korekce oranžově. */
function amountColorForType(t: string | undefined, theme: Theme): string {
  switch (t) {
    case TransactionPageItemResponseDtoTransactionType.INCOME:
      return theme.palette.success.main;
    case TransactionPageItemResponseDtoTransactionType.EXPENSE:
      return theme.palette.error.main;
    case TransactionPageItemResponseDtoTransactionType.TRANSFER:
      return theme.palette.mode === 'dark' ? '#ffffff' : theme.palette.text.primary;
    case TransactionPageItemResponseDtoTransactionType.BALANCE_ADJUSTMENT:
      return theme.palette.warning.main;
    default:
      return theme.palette.text.secondary;
  }
}

function formatAssetAmount(
  amountMinor: number | undefined,
  assetCode?: string,
  assetScale?: number,
): string {
  if (amountMinor == null || !Number.isFinite(amountMinor)) return '—';
  const code = (assetCode?.trim() || 'CZK').toUpperCase();
  const scale = Number.isFinite(assetScale) && assetScale != null && assetScale >= 0
    ? Math.min(Math.floor(assetScale), 20)
    : 2;
  const major = amountMinor / 10 ** scale;
  const formatted = new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  }).format(major);
  return `${formatted} ${code}`;
}

function formatConvertedAmount(row: TransactionRow): string | null {
  if (row.convertedAmount == null || !row.convertedInto?.trim()) return null;
  return formatAssetAmount(row.convertedAmount, row.convertedInto, row.convertedAssetScale);
}

function holdingCellText(row: TransactionRow): string {
  const t = row.transactionType as string | undefined;
  if (t === TransactionPageItemResponseDtoTransactionType.TRANSFER) {
    const from = row.sourceHoldingName?.trim() || row.sourceHoldingId || '';
    const to = row.targetHoldingName?.trim() || row.targetHoldingId || '';
    if (from && to) return `${from} → ${to}`;
    if (from) return from;
    if (to) return to;
    return '—';
  }
  const name = row.holdingName?.trim();
  if (name) return name;
  if (row.holdingId) return row.holdingId;
  return '—';
}

function dash(s?: string | null): string {
  const t = s?.trim();
  return t ? t : '—';
}

function TransactionDetailBlock({
  row,
  actionPending,
  onEdit,
  onCancel,
  onUploadAttachment,
}: {
  row: TransactionRow;
  actionPending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onUploadAttachment: (file: File) => void;
}) {
  const kv = (label: string, value: ReactNode) => (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0, sm: 1 }}
      sx={{ py: 0.35, alignItems: { sm: 'baseline' } }}
    >
      <Typography
        component="span"
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: { sm: 180 }, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography component="span" variant="body2" sx={{ wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Stack>
  );

  const t = row.transactionType as string | undefined;
  const attachments = row.attachments ?? [];
  const canCancel = Boolean(row.id) && row.status !== TransactionPageItemResponseDtoStatus.CANCELLED;
  const convertedAmountText = formatConvertedAmount(row);

  return (
    <Box sx={{ py: 1.5, px: 0.5 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" onClick={onEdit} disabled={!row.id || actionPending}>
            Upravit
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={onCancel}
            disabled={!canCancel || actionPending}
          >
            Zrušit transakci
          </Button>
          <Button size="small" variant="outlined" component="label" disabled={!row.id || actionPending}>
            Nahrát přílohu
            <input
              hidden
              type="file"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onUploadAttachment(file);
              }}
            />
          </Button>
        </Stack>
        <Stack spacing={0}>
        {kv('ID', dash(row.id))}
        {kv('Stav', statusLabel(row.status))}
        {kv('Typ', txTypeLabel(t))}
        {kv('Datum transakce', formatDateTimeDdMmYyyyHhMm(row.transactionDate))}
        {kv('Částka', formatAssetAmount(row.amount, row.assetCode, row.assetScale))}
        {convertedAmountText ? kv('Přepočteno', convertedAmountText) : null}
        {row.balanceAdjustmentDirection
          ? kv('Směr korekce', balanceDirectionLabel(row.balanceAdjustmentDirection))
          : null}
        {t === TransactionPageItemResponseDtoTransactionType.TRANSFER ? (
          <>
            {kv('Pozice zdroj', dash(row.sourceHoldingName || row.sourceHoldingId))}
            {kv('ID zdrojové pozice', dash(row.sourceHoldingId))}
            {kv('Pozice cíl', dash(row.targetHoldingName || row.targetHoldingId))}
            {kv('ID cílové pozice', dash(row.targetHoldingId))}
          </>
        ) : (
          <>
            {kv('Pozice', dash(row.holdingName || row.holdingId))}
            {kv('ID pozice', dash(row.holdingId))}
          </>
        )}
        {kv('Hlavní kategorie', dash(row.rootCategoryName || row.rootCategoryId))}
        {kv('ID hlavní kategorie', dash(row.rootCategoryId))}
        {kv('Kategorie', dash(row.categoryName || row.categoryId))}
        {kv('ID kategorie', dash(row.categoryId))}
        {kv('Popis', dash(row.description))}
        {kv('Poznámka', dash(row.note))}
        {kv('Externí reference', dash(row.externalRef))}
        {kv(
          'Vytvořeno',
          row.createdDate?.trim() ? formatDateTimeDdMmYyyyHhMm(row.createdDate) : '—',
        )}
        {kv(
          'Naposledy upraveno',
          row.lastModifiedDate?.trim() ? formatDateTimeDdMmYyyyHhMm(row.lastModifiedDate) : '—',
        )}
        {attachments.length > 0
          ? kv(
              'Přílohy',
              <Stack component="span" spacing={0.5} sx={{ display: 'inline-flex', flexDirection: 'column' }}>
                {attachments.map((a, i) => (
                  <span key={a.id ?? `${a.fileName}-${i}`}>
                    {a.fileUrl ? (
                      <Link href={a.fileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        {dash(a.fileName) !== '—' ? a.fileName : a.fileUrl}
                      </Link>
                    ) : (
                      dash(a.fileName)
                    )}
                    {a.contentType ? (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        ({a.contentType}
                        {a.fileSize != null ? `, ${a.fileSize} B` : ''})
                      </Typography>
                    ) : null}
                  </span>
                ))}
              </Stack>,
            )
          : kv('Přílohy', '—')}
        </Stack>
      </Stack>
    </Box>
  );
}

const TX_TYPE_ORDER = [
  TransactionFindAllPageableTransactionType.EXPENSE,
  TransactionFindAllPageableTransactionType.INCOME,
  TransactionFindAllPageableTransactionType.TRANSFER,
  TransactionFindAllPageableTransactionType.BALANCE_ADJUSTMENT,
] as const;

type TypeFilterValue = '' | TransactionFindAllPageableTransactionType;

function nextSortState(current: TxSortState, field: SortField): TxSortState {
  if (!current || current.field !== field) return { field, direction: 'desc' };
  if (current.direction === 'desc') return { field, direction: 'asc' };
  return null;
}

type RecentTransactionsPanelProps = {
  trackerId: string;
  dateFromCs: string;
  dateToCs: string;
  dateRangeEnabled: boolean;
  amountRateMode: AmountRateMode;
};

export const RecentTransactionsPanel: FC<RecentTransactionsPanelProps> = ({
  trackerId,
  dateFromCs,
  dateToCs,
  dateRangeEnabled,
  amountRateMode,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null);
  const [editHoldingId, setEditHoldingId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrencyCode, setEditCurrencyCode] = useState('');
  const [editAssetScale, setEditAssetScale] = useState<number | undefined>();
  const [editExchangeRate, setEditExchangeRate] = useState('');
  const [editFeeAmount, setEditFeeAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDateCs, setEditDateCs] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editExternalRef, setEditExternalRef] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [holdingId, setHoldingId] = useState('');
  const [transactionType, setTransactionType] = useState<TypeFilterValue>('');
  const [dateFilterCleared, setDateFilterCleared] = useState(false);
  const [txSort, setTxSort] = useState<TxSortState>({ field: 'date', direction: 'desc' });

  useEffect(() => {
    setDateFilterCleared(false);
  }, [dateFromCs, dateToCs]);

  useEffect(() => {
    setPage(0);
    setExpandedIds(new Set());
  }, [
    trackerId,
    debouncedSearch,
    categoryId,
    subCategoryId,
    holdingId,
    transactionType,
    dateFromCs,
    dateToCs,
    rowsPerPage,
    txSort,
    amountRateMode,
  ]);

  const toggleRow = useCallback((rowKey: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setCategoryId('');
    setSubCategoryId('');
    setHoldingId('');
    setTransactionType('');
    setDateFilterCleared(true);
    setRowsPerPage(100);
    setPage(0);
  }, []);

  const handleSortClick = useCallback((field: SortField) => {
    setTxSort((current) => nextSortState(current, field));
    setPage(0);
    setExpandedIds(new Set());
  }, []);

  const invalidateTransactions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [`/api/transaction/${trackerId}`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/holding/${trackerId}`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/institution/${trackerId}/dashboard`] });
  }, [queryClient, trackerId]);

  const openEditDialog = useCallback((row: TransactionRow) => {
    setEditingTx(row);
    setEditHoldingId(row.holdingId ?? '');
    const amountMajor = minorUnitsToMajorForScale(row.amount, row.assetScale ?? DEFAULT_FIAT_SCALE);
    setEditAmount(amountMajor == null || !Number.isFinite(amountMajor) ? '' : String(amountMajor));
    setEditCurrencyCode(row.assetCode ?? '');
    setEditAssetScale(row.assetScale);
    setEditExchangeRate(row.exchangeRate != null ? String(row.exchangeRate) : '');
    setEditFeeAmount(row.feeAmount != null ? String(row.feeAmount) : '');
    setEditCategoryId(row.categoryId ?? '');
    setEditDateCs(formatDateTimeDdMmYyyyHhMm(row.transactionDate));
    setEditDescription(row.description ?? '');
    setEditNote(row.note ?? '');
    setEditExternalRef(row.externalRef ?? '');
    setEditError(null);
  }, []);

  const closeEditDialog = useCallback(() => {
    if (actionPending) return;
    setEditingTx(null);
    setEditError(null);
  }, [actionPending]);

  const handleEditSubmit = useCallback(async () => {
    const transactionId = editingTx?.id;
    if (!transactionId) return;
    const transactionDate = toIsoFromDateTimeInput(editDateCs);
    if (!transactionDate) {
      setEditError('Neplatné datum a čas — použij formát dd.MM.yyyy HH:mm.');
      return;
    }
    const parseOptionalNumber = (value: string, label: string): number | undefined => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed.replace(',', '.'));
      if (!Number.isFinite(parsed)) {
        throw new Error(`${label} musí být číslo.`);
      }
      return parsed;
    };

    let amount: number | undefined;
    let amountMinor: number | undefined;
    let exchangeRate: number | undefined;
    let feeAmount: number | undefined;
    try {
      amount = parseAmount(editAmount);
      amountMinor =
        amount != null ? majorToMinorUnitsForScale(amount, editAssetScale ?? DEFAULT_FIAT_SCALE) : undefined;
      exchangeRate = parseOptionalNumber(editExchangeRate, 'Kurz');
      feeAmount = parseOptionalNumber(editFeeAmount, 'Fee');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Neplatná číselná hodnota.');
      return;
    }
    if (amount != null && (amount <= 0 || amountMinor == null || amountMinor <= 0)) {
      setEditError('Částka musí být kladná a alespoň jedna nejmenší jednotka vybrané měny.');
      return;
    }

    setActionPending(true);
    setEditError(null);
    try {
      const payload: UpdateTransactionRequestDto = {
        ...(editHoldingId ? { holdingId: editHoldingId } : {}),
        ...(amountMinor != null ? { amount: amountMinor } : {}),
        ...(editCurrencyCode.trim() ? { currencyCode: editCurrencyCode.trim().toUpperCase() } : {}),
        ...(exchangeRate != null ? { exchangeRate } : {}),
        ...(feeAmount != null ? { feeAmount } : {}),
        ...(editCategoryId ? { categoryId: editCategoryId } : {}),
        transactionDate,
        description: editDescription.trim(),
        note: editNote.trim(),
        externalRef: editExternalRef.trim(),
      };
      const res = await transactionUpdate(trackerId, transactionId, payload);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Transakci se nepodařilo upravit'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Transakce byla upravena', { variant: 'success' });
      setEditingTx(null);
      await invalidateTransactions();
    } catch {
      enqueueSnackbar('Transakci se nepodařilo upravit', { variant: 'error' });
    } finally {
      setActionPending(false);
    }
  }, [
    editAmount,
    editAssetScale,
    editCategoryId,
    editCurrencyCode,
    editDateCs,
    editDescription,
    editExchangeRate,
    editExternalRef,
    editFeeAmount,
    editHoldingId,
    editNote,
    editingTx?.id,
    enqueueSnackbar,
    invalidateTransactions,
    trackerId,
  ]);

  const handleCancelTransaction = useCallback(
    async (row: TransactionRow) => {
      const transactionId = row.id;
      if (!transactionId || actionPending) return;
      if (!window.confirm('Opravdu zrušit tuto transakci?')) return;
      setActionPending(true);
      try {
        const res = await transactionCancel(trackerId, transactionId);
        if (res.status < 200 || res.status >= 300) {
          enqueueSnackbar(apiErrorMessage(res.data, 'Transakci se nepodařilo zrušit'), { variant: 'error' });
          return;
        }
        enqueueSnackbar('Transakce byla zrušena', { variant: 'success' });
        await invalidateTransactions();
      } catch {
        enqueueSnackbar('Transakci se nepodařilo zrušit', { variant: 'error' });
      } finally {
        setActionPending(false);
      }
    },
    [actionPending, enqueueSnackbar, invalidateTransactions, trackerId],
  );

  const handleUploadAttachment = useCallback(
    async (row: TransactionRow, file: File) => {
      const transactionId = row.id;
      if (!transactionId || actionPending) return;
      setActionPending(true);
      try {
        const res = await transactionUploadAttachment(trackerId, transactionId, { file });
        if (res.status < 200 || res.status >= 300) {
          enqueueSnackbar(apiErrorMessage(res.data, 'Přílohu se nepodařilo nahrát'), { variant: 'error' });
          return;
        }
        enqueueSnackbar('Příloha byla nahrána', { variant: 'success' });
        await invalidateTransactions();
      } catch {
        enqueueSnackbar('Přílohu se nepodařilo nahrát', { variant: 'error' });
      } finally {
        setActionPending(false);
      }
    },
    [actionPending, enqueueSnackbar, invalidateTransactions, trackerId],
  );

  const listParams = useMemo((): TransactionFindAllPageableParams => {
    const params: TransactionFindAllPageableParams = {
      page,
      size: rowsPerPage,
      rateMode: amountRateMode,
    };
    if (txSort) {
      params.sort = [`${TX_SORT_FIELDS[txSort.field]},${txSort.direction}`];
    }
    const q = debouncedSearch.trim();
    if (q) params.search = q;
    if (subCategoryId) params.categoryId = subCategoryId;
    else if (categoryId) params.categoryId = categoryId;
    if (holdingId) params.holdingId = holdingId;
    if (transactionType) params.transactionType = transactionType;

    if (!dateFilterCleared && dateRangeEnabled) {
      const range = dateRangeDdMmYyyyToIsoParams(dateFromCs.trim(), dateToCs.trim());
      if (range) {
        params.dateFrom = range.from;
        params.dateTo = range.to;
      }
    }

    return params;
  }, [
    page,
    rowsPerPage,
    debouncedSearch,
    categoryId,
    subCategoryId,
    holdingId,
    transactionType,
    dateFromCs,
    dateToCs,
    dateFilterCleared,
    dateRangeEnabled,
    txSort,
    amountRateMode,
  ]);

  const filterSelectSx = { minWidth: 140, maxWidth: 220 } as const;

  const { data: categoriesRes } = useQuery({
    queryKey: ['categoryFindAllActive', trackerId, 'history-panel'] as const,
    queryFn: async () => {
      const res = await categoryFindAllActive(trackerId, CATEGORY_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('categories');
      return res.data as PagedModelCategoryResponseDto;
    },
    enabled: Boolean(trackerId),
    staleTime: 60_000,
  });

  const { data: holdingsRes } = useQuery({
    queryKey: ['holdingFindAll', trackerId, 'history-panel'] as const,
    queryFn: async () => {
      const res = await holdingFindAll(trackerId, WALLET_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('holdings');
      return res.data as PagedModelHoldingResponseDto;
    },
    enabled: Boolean(trackerId),
    staleTime: 60_000,
  });

  const categories = categoriesRes?.content ?? [];
  const holdings = holdingsRes?.content ?? [];

  const categoryTree = useMemo(() => toCategoryTree(categories), [categories]);
  const subCategoryMenuRows = useMemo(
    () => buildSubcategoryMenuRows(categoryTree),
    [categoryTree],
  );
  const allCategorySelectOptions = useMemo(
    () => buildCategoryMenuRows(categoryTree),
    [categoryTree],
  );

  const categorySelectOptions = useMemo(
    () =>
      categories
        .filter((c): c is CategoryResponseDto & { id: string } => Boolean(c.id))
        .map((c) => ({ id: c.id, label: c.name?.trim() || c.id })),
    [categories],
  );

  const holdingSelectOptions = useMemo(
    () =>
      holdings
        .filter((h): h is HoldingResponseDto & { id: string } => Boolean(h.id))
        .map((h) => ({
          id: h.id!,
          label: holdingLabel(h),
          assetCode: h.assetCode,
          assetScale: h.assetScale,
        })),
    [holdings],
  );

  const typeSelectOptions = useMemo(
    () =>
      TX_TYPE_ORDER.map((v) => ({
        id: v,
        value: v,
        label: txTypeLabel(v),
      })),
    [],
  );

  const {
    data: txPaged,
    isPending,
    isError,
    isPlaceholderData,
  } = useQuery({
    queryKey: getTransactionFindAllPageableQueryKey(trackerId, listParams),
    queryFn: async ({ signal }) => {
      const res = await transactionFindAllPageable(trackerId, listParams, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error('transactions');
      return res.data as TransactionPageResponseDto;
    },
    enabled: Boolean(trackerId),
    placeholderData: keepPreviousData,
  });

  const recentTx = (txPaged?.content ?? []) as TransactionRow[];
  const totalElements = txPaged?.page?.totalElements ?? 0;
  const totals = txPaged?.totals;

  const convertedScaleByCode = useMemo(() => {
    const scales = new Map<string, number>();
    for (const row of recentTx) {
      const code = row.convertedInto?.trim().toUpperCase();
      if (code && row.convertedAssetScale != null && Number.isFinite(row.convertedAssetScale)) {
        scales.set(code, row.convertedAssetScale);
      }
    }
    return scales;
  }, [recentTx]);

  const formatTotalsByAsset = (
    key: 'incomeAmount' | 'expenseAmount' | 'netAmount',
  ): string[] => {
    return (totals?.byAsset ?? [])
      .filter((row) => row[key] != null)
      .map((row) => {
        const code = row.assetCode?.trim().toUpperCase() || 'CZK';
        return formatAssetAmount(row[key], code, row.assetScale);
      });
  };

  const formatConvertedTotal = (
    key: 'incomeAmount' | 'expenseAmount' | 'netAmount',
  ): string | null => {
    const converted = totals?.converted;
    if (converted?.[key] == null || !converted.convertedInto?.trim()) return null;
    const code = converted.convertedInto.trim().toUpperCase();
    return formatAssetAmount(converted[key], code, convertedScaleByCode.get(code));
  };

  const convertedNetAmount = totals?.converted?.netAmount;
  const netTotalsByAsset = (totals?.byAsset ?? [])
    .filter((row) => row.netAmount != null)
    .map((row) => {
      const code = row.assetCode?.trim().toUpperCase() || 'CZK';
      return {
        key: `${code}-${row.netAmount}`,
        amount: row.netAmount ?? 0,
        text: formatAssetAmount(row.netAmount, code, row.assetScale),
      };
    });

  const sortDirectionFor = (field: SortField): SortDirection => {
    return txSort?.field === field ? txSort.direction : 'asc';
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'auto auto minmax(0, 1fr)',
          },
          alignItems: 'baseline',
          columnGap: 2,
          rowGap: 1,
          width: '100%',
          mb: 2,
          opacity: isPending || isPlaceholderData ? 0.6 : 1,
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{ gridColumn: { xs: '1', sm: '1' }, whiteSpace: 'nowrap', mb: 0 }}
        >
          Historie transakcí
        </Typography>

        <Typography
          variant="body2"
          component="span"
          sx={{ gridColumn: { xs: '1', sm: '2' }, whiteSpace: 'nowrap' }}
        >
          <Box component="span" sx={{ color: 'text.secondary' }}>
            Počet záznamů:
          </Box>{' '}
          <Box
            component="span"
            sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}
          >
            {totalElements.toLocaleString('cs-CZ')}
          </Box>
        </Typography>

        <Box
          sx={{
            gridColumn: { xs: '1', sm: '3' },
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'flex-end',
            gap: { xs: 1.5, sm: 2, md: 3 },
            minWidth: 0,
          }}
        >
          <Typography variant="body2" component="span" sx={{ whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              Celkové výdaje:
            </Box>{' '}
            <Box
              component="span"
              sx={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: theme.palette.error.main,
              }}
            >
              <Stack component="span" spacing={0.25}>
                {formatTotalsByAsset('expenseAmount').length > 0 ? (
                  formatTotalsByAsset('expenseAmount').map((part) => (
                    <Box component="span" key={part}>
                      {part}
                    </Box>
                  ))
                ) : (
                  <Box component="span">—</Box>
                )}
                {formatConvertedTotal('expenseAmount') ? (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {formatConvertedTotal('expenseAmount')}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          </Typography>
          <Typography variant="body2" component="span" sx={{ whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              Celkové příjmy:
            </Box>{' '}
            <Box
              component="span"
              sx={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: theme.palette.success.main,
              }}
            >
              <Stack component="span" spacing={0.25}>
                {formatTotalsByAsset('incomeAmount').length > 0 ? (
                  formatTotalsByAsset('incomeAmount').map((part) => (
                    <Box component="span" key={part}>
                      {part}
                    </Box>
                  ))
                ) : (
                  <Box component="span">—</Box>
                )}
                {formatConvertedTotal('incomeAmount') ? (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {formatConvertedTotal('incomeAmount')}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          </Typography>
          <Typography variant="body2" component="span" sx={{ whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Výsledná bilance:
            </Box>{' '}
            <Box
              component="span"
              sx={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Stack component="span" spacing={0.25}>
                {netTotalsByAsset.length > 0 ? (
                  netTotalsByAsset.map((part) => (
                    <Box
                      component="span"
                      key={part.key}
                      sx={{
                        color:
                          part.amount < 0
                            ? theme.palette.error.main
                            : part.amount > 0
                              ? theme.palette.success.main
                              : theme.palette.text.primary,
                      }}
                    >
                      {part.text}
                    </Box>
                  ))
                ) : (
                  <Box component="span" sx={{ color: theme.palette.text.secondary }}>
                    —
                  </Box>
                )}
                {formatConvertedTotal('netAmount') ? (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      color:
                        convertedNetAmount == null
                          ? theme.palette.text.secondary
                          : convertedNetAmount < 0
                            ? theme.palette.error.main
                            : convertedNetAmount > 0
                              ? theme.palette.success.main
                              : theme.palette.text.primary,
                    }}
                  >
                    {formatConvertedTotal('netAmount')}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          </Typography>
        </Box>
      </Box>

      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ alignItems: 'flex-start' }}>
          <TextField
            size="small"
            label="Hledat"
            placeholder="Popis, poznámka…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ minWidth: 200, flex: '1 1 200px' }}
          />
          <Autocomplete
            size="small"
            options={categorySelectOptions}
            getOptionLabel={(o) => o.label}
            value={categorySelectOptions.find((o) => o.id === categoryId) ?? null}
            onChange={(_, v) => setCategoryId(v?.id ?? '')}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={filterOptionsByQuery}
            noOptionsText="Žádná shoda"
            renderInput={(params) => <TextField {...params} label="Kategorie" />}
            sx={filterSelectSx}
          />
          <Autocomplete
            size="small"
            options={subCategoryMenuRows}
            getOptionLabel={(o) => o.label}
            value={subCategoryMenuRows.find((o) => o.id === subCategoryId) ?? null}
            onChange={(_, v) => setSubCategoryId(v?.id ?? '')}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={filterOptionsByQuery}
            noOptionsText="Žádná shoda"
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id} sx={{ pl: 2 + option.depth * 2 }}>
                {option.label}
              </Box>
            )}
            renderInput={(params) => <TextField {...params} label="Podkategorie" />}
            sx={{ minWidth: 180, maxWidth: 280 }}
          />
          <Autocomplete
            size="small"
            options={holdingSelectOptions}
            getOptionLabel={(o) => o.label}
            value={holdingSelectOptions.find((o) => o.id === holdingId) ?? null}
            onChange={(_, v) => setHoldingId(v?.id ?? '')}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={filterOptionsByQuery}
            noOptionsText="Žádná shoda"
            renderInput={(params) => <TextField {...params} label="Pozice" />}
            sx={filterSelectSx}
          />
          <Autocomplete
            size="small"
            options={typeSelectOptions}
            getOptionLabel={(o) => o.label}
            value={
              transactionType
                ? typeSelectOptions.find((o) => o.value === transactionType) ?? null
                : null
            }
            onChange={(_, v) => setTransactionType((v?.value ?? '') as TypeFilterValue)}
            isOptionEqualToValue={(a, b) => a.value === b.value}
            filterOptions={filterOptionsByQuery}
            noOptionsText="Žádná shoda"
            renderInput={(params) => <TextField {...params} label="Typ" />}
            sx={filterSelectSx}
          />
          <Button size="small" variant="outlined" onClick={clearFilters} sx={{ alignSelf: 'center' }}>
            Vymazat filtry
          </Button>
        </Stack>
        {isError ? (
          <Typography variant="body2" color="error">
            Nepodařilo se načíst transakce.
          </Typography>
        ) : null}
      </Stack>

      <Table
        size="small"
        sx={{
          tableLayout: 'fixed',
          width: '100%',
          opacity: isPending || isPlaceholderData ? 0.6 : 1,
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={DATE_COL_SX}>
              <TableSortLabel
                active={txSort?.field === 'date'}
                direction={sortDirectionFor('date')}
                onClick={() => handleSortClick('date')}
              >
                Datum
              </TableSortLabel>
            </TableCell>
            <TableCell sx={TYPE_COL_SX}>
              <TableSortLabel
                active={txSort?.field === 'type'}
                direction={sortDirectionFor('type')}
                onClick={() => handleSortClick('type')}
              >
                Typ
              </TableSortLabel>
            </TableCell>
            <TableCell sx={STATUS_COL_SX}>Stav</TableCell>
            <TableCell sx={WALLET_COL_SX}>
              <TableSortLabel
                active={txSort?.field === 'holding'}
                direction={sortDirectionFor('holding')}
                onClick={() => handleSortClick('holding')}
              >
                Pozice
              </TableSortLabel>
            </TableCell>
            <TableCell sx={ROOT_CATEGORY_COL_SX}>Hlavní kategorie</TableCell>
            <TableCell>Kategorie</TableCell>
            <TableCell sx={DESCRIPTION_COL_SX}>Popis</TableCell>
            <TableCell align="right" sx={{ width: 165, whiteSpace: 'nowrap' }}>
              <TableSortLabel
                active={txSort?.field === 'amount'}
                direction={sortDirectionFor('amount')}
                onClick={() => handleSortClick('amount')}
              >
                Částka
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {recentTx.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8}>
                <Typography color="text.secondary">
                  {isPending ? 'Načítání…' : 'Žádné záznamy pro zvolené filtry.'}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            recentTx.map((row, index) => {
              const walletLabel = holdingCellText(row);
              const rowKey = row.id ?? `p${page}-i${index}`;
              const open = expandedIds.has(rowKey);
              const convertedAmountText = formatConvertedAmount(row);

              return (
                <Fragment key={rowKey}>
                  <TableRow
                    hover
                    selected={open}
                    onClick={() => toggleRow(rowKey)}
                    sx={{ cursor: 'pointer' }}
                    aria-expanded={open}
                  >
                    <TableCell
                      sx={DATE_COL_SX}
                      title={formatDateTimeDdMmYyyyHhMm(row.transactionDate)}
                    >
                      {formatDateTimeDdMmYyyyHhMm(row.transactionDate)}
                    </TableCell>
                    <TableCell
                      sx={TYPE_COL_SX}
                      title={txTypeLabel(row.transactionType as string | undefined)}
                    >
                      {txTypeLabel(row.transactionType as string | undefined)}
                    </TableCell>
                    <TableCell
                      sx={{
                        ...STATUS_COL_SX,
                        fontWeight: 600,
                        color: statusColor(row.status, theme),
                      }}
                      title={statusLabel(row.status)}
                    >
                      {statusLabel(row.status)}
                    </TableCell>
                    <TableCell sx={WALLET_COL_SX} title={walletLabel}>
                      {walletLabel}
                    </TableCell>
                    <TableCell
                      sx={ROOT_CATEGORY_COL_SX}
                      title={row.rootCategoryName?.trim() || row.rootCategoryId || undefined}
                    >
                      {row.rootCategoryName?.trim() ? row.rootCategoryName : '—'}
                    </TableCell>
                    <TableCell>{row.categoryName?.trim() ? row.categoryName : '—'}</TableCell>
                    <TableCell sx={DESCRIPTION_COL_SX}>{row.description ?? row.note ?? '—'}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        width: 165,
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        color: amountColorForType(row.transactionType as string | undefined, theme),
                      }}
                    >
                      <Stack spacing={0.25} alignItems="flex-end">
                        <Box component="span">
                          {formatAssetAmount(row.amount, row.assetCode, row.assetScale)}
                        </Box>
                        {convertedAmountText ? (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ lineHeight: 1.1 }}
                          >
                            {convertedAmountText}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
                      <Collapse in={open} timeout="auto" unmountOnExit>
                        <TransactionDetailBlock
                          row={row}
                          actionPending={actionPending}
                          onEdit={() => openEditDialog(row)}
                          onCancel={() => void handleCancelTransaction(row)}
                          onUploadAttachment={(file) => void handleUploadAttachment(row, file)}
                        />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={totalElements}
        page={page}
        onPageChange={(_, newPage) => {
          setPage(newPage);
          setExpandedIds(new Set());
        }}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(Number.parseInt(e.target.value, 10));
          setPage(0);
          setExpandedIds(new Set());
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelDisplayedRows={({ from, to, count }) =>
          `${from}–${to} z ${count !== -1 ? count : `více než ${to}`}`
        }
      />
      <Dialog open={Boolean(editingTx)} onClose={closeEditDialog} fullWidth maxWidth="sm">
        <DialogTitle>Upravit transakci</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              size="small"
              options={holdingSelectOptions}
              getOptionLabel={(o) => o.label}
              value={holdingSelectOptions.find((o) => o.id === editHoldingId) ?? null}
              onChange={(_, v) => {
                setEditHoldingId(v?.id ?? '');
                setEditAssetScale(v?.assetScale);
                if (v?.assetCode) setEditCurrencyCode(v.assetCode);
              }}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={filterOptionsByQuery}
              noOptionsText="Žádná shoda"
              renderInput={(params) => <TextField {...params} label="Pozice" />}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <AmountTextFieldCs
                label="Částka"
                canonical={editAmount}
                setCanonical={setEditAmount}
                fullWidth
                error={Boolean(editError)}
                helperText="Částka v hlavních jednotkách vybrané měny"
              />
              <TextField
                label="Měna"
                value={editCurrencyCode}
                onChange={(e) => setEditCurrencyCode(e.target.value)}
                fullWidth
                inputProps={{ maxLength: 16, style: { textTransform: 'uppercase' } }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Kurz"
                value={editExchangeRate}
                onChange={(e) => setEditExchangeRate(e.target.value)}
                fullWidth
                inputMode="decimal"
              />
              <TextField
                label="Fee"
                value={editFeeAmount}
                onChange={(e) => setEditFeeAmount(e.target.value)}
                fullWidth
                inputMode="decimal"
              />
            </Stack>
            <Autocomplete
              size="small"
              options={allCategorySelectOptions}
              getOptionLabel={(o) => o.label}
              value={allCategorySelectOptions.find((o) => o.id === editCategoryId) ?? null}
              onChange={(_, v) => setEditCategoryId(v?.id ?? '')}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={filterOptionsByQuery}
              noOptionsText="Žádná shoda"
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id} sx={{ pl: 2 + option.depth * 2 }}>
                  {option.label}
                </Box>
              )}
              renderInput={(params) => <TextField {...params} label="Kategorie" />}
            />
            <TextField
              label="Datum transakce"
              value={editDateCs}
              onChange={(e) => setEditDateCs(e.target.value)}
              fullWidth
              error={Boolean(editError)}
              helperText={editError ?? 'Formát dd.MM.yyyy HH:mm'}
            />
            <TextField
              label="Popis"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              fullWidth
            />
            <TextField
              label="Poznámka"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Externí reference"
              value={editExternalRef}
              onChange={(e) => setEditExternalRef(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} disabled={actionPending}>
            Zrušit
          </Button>
          <Button variant="contained" onClick={() => void handleEditSubmit()} disabled={actionPending}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
