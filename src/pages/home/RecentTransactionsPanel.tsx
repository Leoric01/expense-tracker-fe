import { categoryFindAllActiveTree } from '@api/category-controller/category-controller';
import type {
  CategoryActiveTreeResponseDto,
  CategoryResponseDto,
  HoldingLiteResponseDto,
  TransactionFindAllPageableParams,
  TransactionPageItemResponseDto,
  TransactionPageResponseDto,
  UpdateTransactionRequestDto,
} from '@api/model';
import {
  TransactionFindAllPageableRateMode,
  TransactionFindAllPageableStatus,
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
import { holdingFindAllLite } from '@api/holding-controller/holding-controller';
import { getInstitutionHeaderBalancesQueryKey } from '@api/institution-controller/institution-controller';
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
import { formatAssetAmount } from '@utils/formatAssetAmount';
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

function formatExchangeRateLabel(
  exchangeRate: number | undefined,
  sourceAssetCode?: string,
  targetAssetCode?: string,
  targetAssetScale?: number,
): string {
  if (exchangeRate == null || !Number.isFinite(exchangeRate)) return '—';
  const sourceCode = (sourceAssetCode?.trim() || 'SRC').toUpperCase();
  const targetCode = (targetAssetCode?.trim() || 'TGT').toUpperCase();
  const scale = Number.isFinite(targetAssetScale) && targetAssetScale != null && targetAssetScale >= 0
    ? Math.min(Math.floor(targetAssetScale), 20)
    : 2;
  const formatted = new Intl.NumberFormat('cs-CZ', {
    useGrouping: false,
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  }).format(exchangeRate);
  return `1 ${sourceCode} = ${formatted} ${targetCode}`;
}

function formatConvertedAmount(row: TransactionRow): string | null {
  if (row.convertedAmount == null || !row.convertedInto?.trim()) return null;
  return formatAssetAmount(row.convertedAmount, row.convertedInto, row.convertedAssetScale);
}

function formatConvertedAmounts(row: TransactionRow): string[] {
  const convertedInto = row.convertedInto?.trim();
  if (!convertedInto) return [];
  if (row.transactionType === TransactionPageItemResponseDtoTransactionType.TRANSFER) {
    const parts: string[] = [];
    if (row.convertedSourceAmount != null) {
      parts.push(formatAssetAmount(row.convertedSourceAmount, convertedInto, row.convertedAssetScale));
    }
    if (row.convertedTargetAmount != null) {
      parts.push(formatAssetAmount(row.convertedTargetAmount, convertedInto, row.convertedAssetScale));
    }
    if (parts.length > 0) return parts;
  }
  const convertedAmount = formatConvertedAmount(row);
  return convertedAmount ? [convertedAmount] : [];
}

function formatTransactionAmountLines(row: TransactionRow): string[] {
  if (row.transactionType !== TransactionPageItemResponseDtoTransactionType.TRANSFER) {
    return [formatAssetAmount(row.amount, row.assetCode, row.assetScale)];
  }
  const sourceAssetCode = row.sourceHoldingAssetCode ?? row.assetCode;
  const sourceAssetScale = row.sourceHoldingAssetScale ?? row.assetScale;
  const targetAssetCode = row.targetHoldingAssetCode ?? row.assetCode;
  const targetAssetScale = row.targetHoldingAssetScale ?? row.assetScale;
  return [
    formatAssetAmount(row.amount, sourceAssetCode, sourceAssetScale),
    ...(row.settledAmount != null
      ? [formatAssetAmount(row.settledAmount, targetAssetCode, targetAssetScale)]
      : []),
  ];
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
  const kv = (label: string, value: ReactNode, span: 'full' | 'half' = 'half') => (
    <Box sx={{ gridColumn: span === 'full' ? '1 / -1' : undefined }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word', fontWeight: value === '—' ? 400 : 500, lineHeight: 1.4 }}>
        {value}
      </Typography>
    </Box>
  );

  const t = row.transactionType as string | undefined;
  const attachments = row.attachments ?? [];
  const canCancel = Boolean(row.id) && row.status !== TransactionPageItemResponseDtoStatus.CANCELLED;
  const convertedAmountParts = formatConvertedAmounts(row);

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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr' },
            columnGap: 2,
            rowGap: 0.75,
          }}
        >
          {kv('ID', dash(row.id))}
          {kv('Stav', statusLabel(row.status))}
          {kv('Typ', txTypeLabel(t))}
          {kv('Datum transakce', formatDateTimeDdMmYyyyHhMm(row.transactionDate))}
          {kv(
            'Částka',
            formatAssetAmount(
              row.amount,
              t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                ? (row.sourceHoldingAssetCode ?? row.assetCode)
                : row.assetCode,
              t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                ? (row.sourceHoldingAssetScale ?? row.assetScale)
                : row.assetScale,
            ),
          )}
          {kv(
            'Vypořádaná částka',
            row.settledAmount != null
              ? formatAssetAmount(
                  row.settledAmount,
                  t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                    ? (row.targetHoldingAssetCode ?? row.assetCode)
                    : row.assetCode,
                  t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                    ? (row.targetHoldingAssetScale ?? row.assetScale)
                    : row.assetScale,
                )
              : '—',
          )}
          {kv(
            'Poplatek',
            row.feeAmount != null
              ? formatAssetAmount(
                  row.feeAmount,
                  t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                    ? (row.sourceHoldingAssetCode ?? row.assetCode)
                    : row.assetCode,
                  t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                    ? (row.sourceHoldingAssetScale ?? row.assetScale)
                    : row.assetScale,
                )
              : '—',
          )}
          {kv(
            'Kurz',
            formatExchangeRateLabel(
              row.exchangeRate,
              t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                ? (row.sourceHoldingAssetCode ?? row.assetCode)
                : row.assetCode,
              t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                ? (row.targetHoldingAssetCode ?? row.convertedInto ?? row.assetCode)
                : (row.convertedInto ?? row.assetCode),
              t === TransactionPageItemResponseDtoTransactionType.TRANSFER
                ? (row.targetHoldingAssetScale ?? row.convertedAssetScale ?? row.assetScale)
                : (row.convertedAssetScale ?? row.assetScale),
            ),
          )}
          {convertedAmountParts.length > 0
            ? kv(
                'Přepočteno',
                <Stack component="span" spacing={0.25} sx={{ display: 'inline-flex', flexDirection: 'column' }}>
                  {convertedAmountParts.map((part, idx) => (
                    <span key={`${part}-${idx}`}>{part}</span>
                  ))}
                </Stack>,
              )
            : null}
          {row.balanceAdjustmentDirection
            ? kv('Směr korekce', balanceDirectionLabel(row.balanceAdjustmentDirection))
            : null}

          {t === TransactionPageItemResponseDtoTransactionType.TRANSFER ? (
            <>
              {kv('Pozice zdroj', dash([row.sourceHoldingName || row.sourceHoldingId, row.sourceHoldingAssetCode].filter(Boolean).join(' ')))}
              {kv('ID zdrojové pozice', dash(row.sourceHoldingId))}
              {kv('Pozice cíl', dash([row.targetHoldingName || row.targetHoldingId, row.targetHoldingAssetCode].filter(Boolean).join(' ')))}
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

          {kv('Popis', dash(row.description), 'full')}
          {kv('Poznámka', dash(row.note), 'full')}
          {kv('Externí reference', dash(row.externalRef), 'full')}

          {kv('Vytvořeno', row.createdDate?.trim() ? formatDateTimeDdMmYyyyHhMm(row.createdDate) : '—')}
          {kv('Naposledy upraveno', row.lastModifiedDate?.trim() ? formatDateTimeDdMmYyyyHhMm(row.lastModifiedDate) : '—')}

          {kv(
            'Přílohy',
            attachments.length > 0
              ? (
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
                </Stack>
              )
              : '—',
            'full',
          )}
        </Box>
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
type StatusFilterValue = '' | TransactionFindAllPageableStatus;

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
  const [editSourceHoldingId, setEditSourceHoldingId] = useState('');
  const [editTargetHoldingId, setEditTargetHoldingId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editSettledAmount, setEditSettledAmount] = useState('');
  const [editCurrencyCode, setEditCurrencyCode] = useState('');
  const [editAssetScale, setEditAssetScale] = useState<number | undefined>();
  const [editSourceAssetScale, setEditSourceAssetScale] = useState<number | undefined>();
  const [editTargetAssetScale, setEditTargetAssetScale] = useState<number | undefined>();
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
  const [status, setStatus] = useState<StatusFilterValue>('');
  const [dateFilterCleared, setDateFilterCleared] = useState(false);
  const [txSort, setTxSort] = useState<TxSortState>({ field: 'date', direction: 'desc' });
  const [summaryOpen, setSummaryOpen] = useState(false);

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
    status,
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
    setStatus('');
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
    await queryClient.invalidateQueries({ queryKey: getInstitutionHeaderBalancesQueryKey(trackerId) });
  }, [queryClient, trackerId]);

  const openEditDialog = useCallback((row: TransactionRow) => {
    setEditingTx(row);
    setEditHoldingId(row.holdingId ?? '');
    setEditSourceHoldingId(row.sourceHoldingId ?? '');
    setEditTargetHoldingId(row.targetHoldingId ?? '');
    const isTransfer = row.transactionType === TransactionPageItemResponseDtoTransactionType.TRANSFER;
    const srcScale = isTransfer ? (row.sourceHoldingAssetScale ?? row.assetScale ?? DEFAULT_FIAT_SCALE) : (row.assetScale ?? DEFAULT_FIAT_SCALE);
    const tgtScale = isTransfer ? (row.targetHoldingAssetScale ?? row.assetScale ?? DEFAULT_FIAT_SCALE) : (row.assetScale ?? DEFAULT_FIAT_SCALE);
    const amountMajor = minorUnitsToMajorForScale(row.amount, srcScale);
    setEditAmount(amountMajor == null || !Number.isFinite(amountMajor) ? '' : String(amountMajor));
    const settledMajor = minorUnitsToMajorForScale(row.settledAmount, tgtScale);
    setEditSettledAmount(settledMajor != null && Number.isFinite(settledMajor) ? String(settledMajor) : '');
    const feeMajor = minorUnitsToMajorForScale(row.feeAmount, srcScale);
    setEditFeeAmount(feeMajor != null && Number.isFinite(feeMajor) ? String(feeMajor) : '');
    setEditCurrencyCode(isTransfer ? (row.sourceHoldingAssetCode ?? row.assetCode ?? '') : (row.assetCode ?? ''));
    setEditAssetScale(row.assetScale);
    setEditSourceAssetScale(srcScale);
    setEditTargetAssetScale(tgtScale);
    setEditExchangeRate(row.exchangeRate != null ? String(row.exchangeRate) : '');
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
    let feeAmountMinor: number | undefined;
    let settledAmountMinor: number | undefined;
    let exchangeRate: number | undefined;
    try {
      amount = parseAmount(editAmount);
      amountMinor =
        amount != null ? majorToMinorUnitsForScale(amount, editAssetScale ?? DEFAULT_FIAT_SCALE) : undefined;
      const feeMajor = parseOptionalNumber(editFeeAmount, 'Fee');
      feeAmountMinor = feeMajor != null ? majorToMinorUnitsForScale(feeMajor, editSourceAssetScale ?? editAssetScale ?? DEFAULT_FIAT_SCALE) : undefined;
      const settledMajor = parseOptionalNumber(editSettledAmount, 'Vypořádaná částka');
      settledAmountMinor = settledMajor != null ? majorToMinorUnitsForScale(settledMajor, editTargetAssetScale ?? editAssetScale ?? DEFAULT_FIAT_SCALE) : undefined;
      exchangeRate = parseOptionalNumber(editExchangeRate, 'Kurz');
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
        ...(editSourceHoldingId ? { sourceHoldingId: editSourceHoldingId } : {}),
        ...(editTargetHoldingId ? { targetHoldingId: editTargetHoldingId } : {}),
        ...(amountMinor != null ? { amount: amountMinor } : {}),
        ...(settledAmountMinor != null ? { settledAmount: settledAmountMinor } : {}),
        ...(editCurrencyCode.trim() ? { currencyCode: editCurrencyCode.trim().toUpperCase() } : {}),
        ...(exchangeRate != null ? { exchangeRate } : {}),
        ...(feeAmountMinor != null ? { feeAmount: feeAmountMinor } : {}),
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
    editSourceAssetScale,
    editTargetAssetScale,
    editCategoryId,
    editCurrencyCode,
    editDateCs,
    editDescription,
    editExchangeRate,
    editExternalRef,
    editFeeAmount,
    editHoldingId,
    editSourceHoldingId,
    editTargetHoldingId,
    editSettledAmount,
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
    if (status) params.status = status;

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
    status,
    dateFromCs,
    dateToCs,
    dateFilterCleared,
    dateRangeEnabled,
    txSort,
    amountRateMode,
  ]);

  const filterSelectSx = { minWidth: 140, maxWidth: 220 } as const;

  const { data: categoriesRes } = useQuery({
    queryKey: ['categoryFindAllActiveTree', trackerId, 'history-panel'] as const,
    queryFn: async () => {
      const res = await categoryFindAllActiveTree(trackerId);
      if (res.status < 200 || res.status >= 300) throw new Error('categories');
      return res.data as unknown as CategoryActiveTreeResponseDto[];
    },
    enabled: Boolean(trackerId),
    staleTime: 60_000,
  });

  const { data: holdingsRes } = useQuery({
    queryKey: ['holdingFindAllLite', trackerId, 'history-panel'] as const,
    queryFn: async () => {
      const res = await holdingFindAllLite(trackerId);
      if (res.status < 200 || res.status >= 300) throw new Error('holdings');
      return res.data as unknown as HoldingLiteResponseDto[];
    },
    enabled: Boolean(trackerId),
    staleTime: 60_000,
  });

  const categories = categoriesRes ?? [];
  const holdings = holdingsRes ?? [];

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
        .filter((h): h is HoldingLiteResponseDto & { id: string } => Boolean(h.id))
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

  const statusSelectOptions = useMemo(
    () =>
      Object.values(TransactionFindAllPageableStatus).map((v) => ({
        id: v,
        value: v,
        label: statusLabel(v),
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
  const expenseTotalsByAsset = formatTotalsByAsset('expenseAmount');
  const incomeTotalsByAsset = formatTotalsByAsset('incomeAmount');
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
  const convertedExpenseTotal = formatConvertedTotal('expenseAmount');
  const convertedIncomeTotal = formatConvertedTotal('incomeAmount');
  const convertedNetTotal = formatConvertedTotal('netAmount');

  const renderSummaryLine = (
    text: string,
    color: string,
    key = text,
    variant: 'main' | 'converted' = 'main',
  ) => (
    <Box
      component="span"
      key={key}
      sx={{
        display: 'block',
        color,
        fontWeight: variant === 'converted' ? 700 : 500,
        fontSize: variant === 'converted' ? '1.1rem' : '0.9rem',
        lineHeight: 1.25,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </Box>
  );

  const renderSummaryDivider = (key: string) => (
    <Box
      component="hr"
      key={key}
      sx={{
        width: '100%',
        m: 0,
        border: 0,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    />
  );

  const renderSummaryColumn = (
    label: string,
    labelColor: string,
    children: ReactNode,
  ) => (
    <Box
      sx={{
        minWidth: 0,
        width: { xs: '100%', md: 'max-content' },
        maxWidth: 260,
        pl: 1.25,
        pr: 1.5,
        py: 1.75,
        borderRadius: 2.25,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{ color: labelColor, fontWeight: 700, fontSize: '1.15rem', mb: 1.25, textAlign: 'right' }}
      >
        {label}
      </Typography>
      <Stack spacing={0.9} sx={{ alignItems: 'flex-end', textAlign: 'right' }}>
        {children}
      </Stack>
    </Box>
  );

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
            sm: 'auto auto minmax(0, 1fr) auto',
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

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ gridColumn: { xs: '1', sm: '2' } }}
        >
          <Typography variant="body2" component="span" sx={{ whiteSpace: 'nowrap' }}>
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
        </Stack>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, gridColumn: '3' }} aria-hidden />
        <Button
          size="small"
          variant="outlined"
          onClick={() => setSummaryOpen(true)}
          sx={{ gridColumn: { xs: '1', sm: '4' }, justifySelf: { xs: 'flex-start', sm: 'flex-end' } }}
        >
          Souhrn
        </Button>
      </Box>

      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ alignItems: 'flex-start' }}>
          <TextField
            size="small"
            label="Hledat"
            placeholder="Popis, poznámka…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ minWidth: 170, flex: '1 1 170px' }}
          />
          <Autocomplete
            size="small"
            options={statusSelectOptions}
            getOptionLabel={(o) => o.label}
            value={status ? statusSelectOptions.find((o) => o.value === status) ?? null : null}
            onChange={(_, v) => setStatus((v?.value ?? '') as StatusFilterValue)}
            isOptionEqualToValue={(a, b) => a.value === b.value}
            filterOptions={filterOptionsByQuery}
            noOptionsText="Žádná shoda"
            renderInput={(params) => <TextField {...params} label="Stav" />}
            sx={filterSelectSx}
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

      <Dialog
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        maxWidth={false}
        slotProps={{
          paper: { sx: { width: 'fit-content', maxWidth: 'calc(100vw - 32px)' } },
        }}
      >
        <DialogTitle
          sx={{
            px: 2.5,
            pb: 1.25,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box component="span">Souhrn transakcí</Box>
          <Typography variant="body2" color="text.secondary" component="span" sx={{ whiteSpace: 'nowrap' }}>
            {dateFromCs} - {dateToCs}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pb: 2.5 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, max-content)' },
              gap: 2.5,
              justifyContent: 'center',
              mx: 'auto',
              pt: 0.75,
            }}
          >
            {renderSummaryColumn(
              'Celkové výdaje',
              theme.palette.error.main,
              [
                ...(expenseTotalsByAsset.length > 0
                  ? expenseTotalsByAsset.map((part) => renderSummaryLine(part, theme.palette.error.main))
                  : [renderSummaryLine('—', theme.palette.text.secondary)]),
                ...(convertedExpenseTotal
                  ? [
                      renderSummaryDivider('converted-expense-divider'),
                      renderSummaryLine(convertedExpenseTotal, theme.palette.error.main, 'converted-expense', 'converted'),
                    ]
                  : []),
              ],
            )}
            {renderSummaryColumn(
              'Celkové příjmy',
              theme.palette.success.main,
              [
                ...(incomeTotalsByAsset.length > 0
                  ? incomeTotalsByAsset.map((part) => renderSummaryLine(part, theme.palette.success.main))
                  : [renderSummaryLine('—', theme.palette.text.secondary)]),
                ...(convertedIncomeTotal
                  ? [
                      renderSummaryDivider('converted-income-divider'),
                      renderSummaryLine(convertedIncomeTotal, theme.palette.success.main, 'converted-income', 'converted'),
                    ]
                  : []),
              ],
            )}
            {renderSummaryColumn(
              'Výsledná bilance',
              theme.palette.text.primary,
              [
                ...(netTotalsByAsset.length > 0
                  ? netTotalsByAsset.map((part) =>
                      renderSummaryLine(
                        part.text,
                        part.amount < 0
                          ? theme.palette.error.main
                          : part.amount > 0
                            ? theme.palette.success.main
                            : theme.palette.text.primary,
                        part.key,
                      ),
                    )
                  : [renderSummaryLine('—', theme.palette.text.secondary)]),
                ...(convertedNetTotal
                  ? [
                      renderSummaryDivider('converted-net-divider'),
                      renderSummaryLine(
                        convertedNetTotal,
                        convertedNetAmount == null
                          ? theme.palette.text.secondary
                          : convertedNetAmount < 0
                            ? theme.palette.error.main
                            : convertedNetAmount > 0
                              ? theme.palette.success.main
                              : theme.palette.text.primary,
                        'converted-net',
                        'converted',
                      ),
                    ]
                  : []),
              ],
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pt: 0 }}>
          <Button onClick={() => setSummaryOpen(false)}>Zavřít</Button>
        </DialogActions>
      </Dialog>

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
              const amountLines = formatTransactionAmountLines(row);
              const convertedAmountParts = formatConvertedAmounts(row);

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
                        {amountLines.map((part, idx) => (
                          <Box component="span" key={`${part}-${idx}`}>
                            {idx > 0 ? '→ ' : ''}
                            {part}
                          </Box>
                        ))}
                        {convertedAmountParts.length > 0 ? (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ lineHeight: 1.1 }}
                          >
                            {convertedAmountParts.join(' → ')}
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
        <DialogTitle sx={{ pb: 1 }}>Upravit transakci</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Stack spacing={1}>
            {editingTx?.transactionType === TransactionPageItemResponseDtoTransactionType.TRANSFER ? (
              <Stack direction="row" spacing={1}>
                <Autocomplete
                  size="small"
                  fullWidth
                  options={holdingSelectOptions}
                  getOptionLabel={(o) => o.label}
                  value={holdingSelectOptions.find((o) => o.id === editSourceHoldingId) ?? null}
                  onChange={(_, v) => {
                    setEditSourceHoldingId(v?.id ?? '');
                    setEditAssetScale(v?.assetScale);
                    setEditSourceAssetScale(v?.assetScale);
                    if (v?.assetCode) setEditCurrencyCode(v.assetCode);
                  }}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  filterOptions={filterOptionsByQuery}
                  noOptionsText="Žádná shoda"
                  renderInput={(params) => <TextField {...params} label="Zdrojová pozice" />}
                />
                <Autocomplete
                  size="small"
                  fullWidth
                  options={holdingSelectOptions}
                  getOptionLabel={(o) => o.label}
                  value={holdingSelectOptions.find((o) => o.id === editTargetHoldingId) ?? null}
                  onChange={(_, v) => {
                    setEditTargetHoldingId(v?.id ?? '');
                    setEditTargetAssetScale(v?.assetScale);
                  }}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  filterOptions={filterOptionsByQuery}
                  noOptionsText="Žádná shoda"
                  renderInput={(params) => <TextField {...params} label="Cílová pozice" />}
                />
              </Stack>
            ) : (
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
            )}
            <Stack direction="row" spacing={1}>
              <AmountTextFieldCs
                size="small"
                label="Částka"
                canonical={editAmount}
                setCanonical={setEditAmount}
                fullWidth
                error={Boolean(editError)}
                helperText=""
              />
              <AmountTextFieldCs
                size="small"
                label="Vypořádaná č."
                canonical={editSettledAmount}
                setCanonical={setEditSettledAmount}
                fullWidth
                helperText=""
              />
              <TextField
                size="small"
                label="Měna"
                value={editCurrencyCode}
                onChange={(e) => setEditCurrencyCode(e.target.value)}
                sx={{ maxWidth: 90 }}
                inputProps={{ maxLength: 16, style: { textTransform: 'uppercase' } }}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Kurz"
                value={editExchangeRate}
                onChange={(e) => setEditExchangeRate(e.target.value)}
                fullWidth
                inputMode="decimal"
              />
              <AmountTextFieldCs
                size="small"
                label="Fee"
                canonical={editFeeAmount}
                setCanonical={setEditFeeAmount}
                fullWidth
                helperText=""
              />
              <TextField
                size="small"
                label="Datum"
                value={editDateCs}
                onChange={(e) => setEditDateCs(e.target.value)}
                fullWidth
                error={Boolean(editError)}
                helperText={editError ?? undefined}
                placeholder="dd.MM.yyyy HH:mm"
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
              size="small"
              label="Popis"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Poznámka"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                size="small"
                label="Externí reference"
                value={editExternalRef}
                onChange={(e) => setEditExternalRef(e.target.value)}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ pt: 0 }}>
          <Button size="small" onClick={closeEditDialog} disabled={actionPending}>
            Zrušit
          </Button>
          <Button size="small" variant="contained" onClick={() => void handleEditSubmit()} disabled={actionPending}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
