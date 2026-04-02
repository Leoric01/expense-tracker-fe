import { categoryFindAllActive } from '@api/category-controller/category-controller';
import type {
  CategoryResponseDto,
  PagedModelCategoryResponseDto,
  PagedModelTransactionResponseDto,
  PagedModelWalletResponseDto,
  TransactionFindAllPageableParams,
  TransactionResponseDto,
} from '@api/model';
import {
  TransactionFindAllPageableTransactionType,
  TransactionResponseDtoBalanceAdjustmentDirection,
  TransactionResponseDtoStatus,
  TransactionResponseDtoTransactionType,
} from '@api/model';
import {
  getTransactionFindAllPageableQueryKey,
  transactionFindAllPageable,
} from '@api/transaction-controller/transaction-controller';
import { walletFindAll } from '@api/wallet-controller/wallet-controller';
import { useDebouncedValue } from '@hooks/useDebouncedValue';
import {
  Autocomplete,
  Box,
  Button,
  Collapse,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { dateRangeDdMmYyyyToIsoParams, firstDayOfMonth, lastDayOfMonth } from '@utils/dashboardPeriod';
import {
  calendarDayEndUtcIso,
  calendarDayStartUtcIso,
  formatDateDdMmYyyyFromDate,
  formatDateTimeDdMmYyyyHhMm,
  parseCsDateTime,
} from '@utils/dateTimeCs';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FC, Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { asCategoryChildren, toCategoryTree } from '@pages/categories/categoryTreeUtils';
import { formatWalletAmount, formatWalletAmountWholeUnits } from './walletDisplay';

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
const TX_SORT = ['transactionDate,desc'] as string[];

const CATEGORY_LIST_PARAMS = { page: 0, size: 500 } as const;
const WALLET_LIST_PARAMS = { page: 0, size: 200 } as const;

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
    case TransactionResponseDtoTransactionType.TRANSFER:
      return 'Převod';
    case TransactionResponseDtoTransactionType.INCOME:
      return 'Příjem';
    case TransactionResponseDtoTransactionType.EXPENSE:
      return 'Výdaj';
    case TransactionResponseDtoTransactionType.BALANCE_ADJUSTMENT:
      return 'Korekce';
    default:
      return t ?? '—';
  }
}

function statusLabel(s?: string): string {
  switch (s) {
    case TransactionResponseDtoStatus.PENDING:
      return 'Čeká';
    case TransactionResponseDtoStatus.COMPLETED:
      return 'Dokončeno';
    case TransactionResponseDtoStatus.CANCELLED:
      return 'Zrušeno';
    default:
      return s ?? '—';
  }
}

function balanceDirectionLabel(d?: string): string {
  switch (d) {
    case TransactionResponseDtoBalanceAdjustmentDirection.DEDUCTION:
      return 'Snížení zůstatku';
    case TransactionResponseDtoBalanceAdjustmentDirection.ADDITION:
      return 'Navýšení zůstatku';
    default:
      return d ?? '—';
  }
}

/** Částka podle typu: příjem zeleně, výdaj červeně, převod neutrálně (na světlém pozadí text.primary), korekce oranžově. */
function amountColorForType(t: string | undefined, theme: Theme): string {
  switch (t) {
    case TransactionResponseDtoTransactionType.INCOME:
      return theme.palette.success.main;
    case TransactionResponseDtoTransactionType.EXPENSE:
      return theme.palette.error.main;
    case TransactionResponseDtoTransactionType.TRANSFER:
      return theme.palette.mode === 'dark' ? '#ffffff' : theme.palette.text.primary;
    case TransactionResponseDtoTransactionType.BALANCE_ADJUSTMENT:
      return theme.palette.warning.main;
    default:
      return theme.palette.text.secondary;
  }
}

function walletCellText(row: TransactionResponseDto): string {
  const t = row.transactionType as string | undefined;
  if (t === TransactionResponseDtoTransactionType.TRANSFER) {
    const from = row.sourceWalletName?.trim() || row.sourceWalletId || '';
    const to = row.targetWalletName?.trim() || row.targetWalletId || '';
    if (from && to) return `${from} → ${to}`;
    if (from) return from;
    if (to) return to;
    return '—';
  }
  const name = row.walletName?.trim();
  if (name) return name;
  if (row.walletId) return row.walletId;
  return '—';
}

function dash(s?: string | null): string {
  const t = s?.trim();
  return t ? t : '—';
}

function TransactionDetailBlock({ row }: { row: TransactionResponseDto }) {
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

  return (
    <Box sx={{ py: 1.5, px: 0.5 }}>
      <Stack spacing={0}>
        {kv('ID', dash(row.id))}
        {kv('Stav', statusLabel(row.status))}
        {kv('Typ', txTypeLabel(t))}
        {kv('Datum transakce', formatDateTimeDdMmYyyyHhMm(row.transactionDate))}
        {kv('Částka', formatWalletAmount(row.amount, row.currencyCode))}
        {row.balanceAdjustmentDirection
          ? kv('Směr korekce', balanceDirectionLabel(row.balanceAdjustmentDirection))
          : null}
        {t === TransactionResponseDtoTransactionType.TRANSFER ? (
          <>
            {kv('Peněženka zdroj', dash(row.sourceWalletName || row.sourceWalletId))}
            {kv('ID zdrojové peněženky', dash(row.sourceWalletId))}
            {kv('Peněženka cíl', dash(row.targetWalletName || row.targetWalletId))}
            {kv('ID cílové peněženky', dash(row.targetWalletId))}
          </>
        ) : (
          <>
            {kv('Peněženka', dash(row.walletName || row.walletId))}
            {kv('ID peněženky', dash(row.walletId))}
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

export const RecentTransactionsPanel: FC<{ trackerId: string }> = ({ trackerId }) => {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [transactionType, setTransactionType] = useState<TypeFilterValue>('');
  const [dateFromCs, setDateFromCs] = useState(() => formatDateDdMmYyyyFromDate(firstDayOfMonth()));
  const [dateToCs, setDateToCs] = useState(() => formatDateDdMmYyyyFromDate(lastDayOfMonth()));

  useEffect(() => {
    setDateFromCs(formatDateDdMmYyyyFromDate(firstDayOfMonth()));
    setDateToCs(formatDateDdMmYyyyFromDate(lastDayOfMonth()));
  }, [trackerId]);

  useEffect(() => {
    setPage(0);
    setExpandedIds(new Set());
  }, [
    trackerId,
    debouncedSearch,
    categoryId,
    subCategoryId,
    walletId,
    transactionType,
    dateFromCs,
    dateToCs,
    rowsPerPage,
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
    setWalletId('');
    setTransactionType('');
    setDateFromCs(formatDateDdMmYyyyFromDate(firstDayOfMonth()));
    setDateToCs(formatDateDdMmYyyyFromDate(lastDayOfMonth()));
  }, []);

  const listParams = useMemo((): TransactionFindAllPageableParams => {
    const params: TransactionFindAllPageableParams = {
      page,
      size: rowsPerPage,
      sort: TX_SORT,
    };
    const q = debouncedSearch.trim();
    if (q) params.search = q;
    if (subCategoryId) params.categoryId = subCategoryId;
    else if (categoryId) params.categoryId = categoryId;
    if (walletId) params.walletId = walletId;
    if (transactionType) params.transactionType = transactionType;

    const fromT = dateFromCs.trim();
    const toT = dateToCs.trim();
    if (fromT && toT) {
      const range = dateRangeDdMmYyyyToIsoParams(fromT, toT);
      if (range) {
        params.dateFrom = range.from;
        params.dateTo = range.to;
      }
    } else {
      const fromParsed = fromT ? parseCsDateTime(fromT) : null;
      const toParsed = toT ? parseCsDateTime(toT) : null;
      if (fromParsed) {
        params.dateFrom = calendarDayStartUtcIso(fromParsed);
      }
      if (toParsed) {
        params.dateTo = calendarDayEndUtcIso(toParsed);
      }
    }

    return params;
  }, [
    page,
    rowsPerPage,
    debouncedSearch,
    categoryId,
    subCategoryId,
    walletId,
    transactionType,
    dateFromCs,
    dateToCs,
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

  const { data: walletsRes } = useQuery({
    queryKey: ['walletFindAll', trackerId, 'history-panel'] as const,
    queryFn: async () => {
      const res = await walletFindAll(trackerId, WALLET_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('wallets');
      return res.data as PagedModelWalletResponseDto;
    },
    enabled: Boolean(trackerId),
    staleTime: 60_000,
  });

  const categories = categoriesRes?.content ?? [];
  const wallets = walletsRes?.content ?? [];

  const categoryTree = useMemo(() => toCategoryTree(categories), [categories]);
  const subCategoryMenuRows = useMemo(
    () => buildSubcategoryMenuRows(categoryTree),
    [categoryTree],
  );

  const categorySelectOptions = useMemo(
    () =>
      categories
        .filter((c): c is CategoryResponseDto & { id: string } => Boolean(c.id))
        .map((c) => ({ id: c.id, label: c.name?.trim() || c.id })),
    [categories],
  );

  const walletSelectOptions = useMemo(
    () =>
      wallets
        .filter((w): w is (typeof wallets)[number] & { id: string } => Boolean(w.id))
        .map((w) => ({ id: w.id!, label: w.name?.trim() || w.id! })),
    [wallets],
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
      return res.data as PagedModelTransactionResponseDto;
    },
    enabled: Boolean(trackerId),
    placeholderData: keepPreviousData,
  });

  const recentTx = (txPaged?.content ?? []) as TransactionResponseDto[];
  const totalElements = txPaged?.page?.totalElements ?? 0;
  const totals = txPaged?.totals;

  const totalsCurrency = useMemo(() => {
    const code = recentTx.find((r) => r.currencyCode?.trim())?.currencyCode;
    return (code ?? 'CZK').toUpperCase();
  }, [recentTx]);

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
              {totals?.expenseAmount != null
                ? formatWalletAmountWholeUnits(totals.expenseAmount, totalsCurrency)
                : '—'}
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
              {totals?.incomeAmount != null
                ? formatWalletAmountWholeUnits(totals.incomeAmount, totalsCurrency)
                : '—'}
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
                color:
                  totals?.netAmount == null
                    ? theme.palette.text.secondary
                    : totals.netAmount < 0
                      ? theme.palette.error.main
                      : totals.netAmount > 0
                        ? theme.palette.success.main
                        : theme.palette.text.primary,
              }}
            >
              {totals?.netAmount != null
                ? formatWalletAmountWholeUnits(totals.netAmount, totalsCurrency)
                : '—'}
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
            options={walletSelectOptions}
            getOptionLabel={(o) => o.label}
            value={walletSelectOptions.find((o) => o.id === walletId) ?? null}
            onChange={(_, v) => setWalletId(v?.id ?? '')}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={filterOptionsByQuery}
            noOptionsText="Žádná shoda"
            renderInput={(params) => <TextField {...params} label="Peněženka" />}
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
          <TextField
            size="small"
            label="Od"
            value={dateFromCs}
            onChange={(e) => setDateFromCs(e.target.value)}
            sx={{ width: 132 }}
          />
          <TextField
            size="small"
            label="Do"
            value={dateToCs}
            onChange={(e) => setDateToCs(e.target.value)}
            sx={{ width: 132 }}
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
            <TableCell sx={DATE_COL_SX}>Datum</TableCell>
            <TableCell sx={TYPE_COL_SX}>Typ</TableCell>
            <TableCell sx={WALLET_COL_SX}>Peněženka</TableCell>
            <TableCell sx={ROOT_CATEGORY_COL_SX}>Hlavní kategorie</TableCell>
            <TableCell>Kategorie</TableCell>
            <TableCell sx={DESCRIPTION_COL_SX}>Popis</TableCell>
            <TableCell align="right" sx={{ width: 108, whiteSpace: 'nowrap' }}>
              Částka
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {recentTx.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography color="text.secondary">
                  {isPending ? 'Načítání…' : 'Žádné záznamy pro zvolené filtry.'}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            recentTx.map((row, index) => {
              const walletLabel = walletCellText(row);
              const rowKey = row.id ?? `p${page}-i${index}`;
              const open = expandedIds.has(rowKey);

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
                        width: 108,
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        color: amountColorForType(row.transactionType as string | undefined, theme),
                      }}
                    >
                      {formatWalletAmountWholeUnits(row.amount, row.currencyCode)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
                      <Collapse in={open} timeout="auto" unmountOnExit>
                        <TransactionDetailBlock row={row} />
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
    </Paper>
  );
};
