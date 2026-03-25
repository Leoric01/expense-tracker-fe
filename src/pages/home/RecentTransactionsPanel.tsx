import type { PagedModelTransactionResponseDto, TransactionResponseDto } from '@api/model';
import { TransactionResponseDtoTransactionType } from '@api/model';
import { transactionFindAll } from '@api/transaction-controller/transaction-controller';
import {
  Box,
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
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { formatDateTimeDdMmYyyyHhMm } from '@utils/dateTimeCs';
import { formatWalletAmount, formatWalletAmountWholeUnits } from './walletDisplay';
import { useQuery } from '@tanstack/react-query';
import { FC, Fragment, type ReactNode, useCallback, useEffect, useState } from 'react';
import { TransactionResponseDtoBalanceAdjustmentDirection } from '@api/model';
import { TransactionResponseDtoStatus } from '@api/model';

const TX_PAGE_SIZE = 25;
const TX_SORT = ['transactionDate,desc'] as string[];

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

export const RecentTransactionsPanel: FC<{ trackerId: string }> = ({ trackerId }) => {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setPage(0);
    setExpandedIds(new Set());
  }, [trackerId]);

  const toggleRow = useCallback((rowKey: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const { data } = useQuery({
    queryKey: ['/api/transaction', trackerId, page, TX_PAGE_SIZE, TX_SORT],
    queryFn: () => transactionFindAll(trackerId, { page, size: TX_PAGE_SIZE, sort: TX_SORT }),
    enabled: Boolean(trackerId),
  });

  const txPaged = data?.data as PagedModelTransactionResponseDto | undefined;
  const recentTx = (txPaged?.content ?? []) as TransactionResponseDto[];
  const totalElements = txPaged?.page?.totalElements ?? 0;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Nedávné transakce
      </Typography>
      <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={DATE_COL_SX}>Datum</TableCell>
            <TableCell sx={TYPE_COL_SX}>Typ</TableCell>
            <TableCell sx={WALLET_COL_SX}>Peněženka</TableCell>
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
              <TableCell colSpan={6}>
                <Typography color="text.secondary">Zatím žádné záznamy.</Typography>
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
                    <TableCell colSpan={6} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
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
        rowsPerPage={TX_PAGE_SIZE}
        rowsPerPageOptions={[]}
        labelDisplayedRows={({ from, to, count }) =>
          `${from}–${to} z ${count !== -1 ? count : `více než ${to}`}`
        }
      />
    </Paper>
  );
};
