import type { PagedModelTransactionResponseDto, TransactionResponseDto } from '@api/model';
import { TransactionResponseDtoTransactionType } from '@api/model';
import { transactionFindAll } from '@api/transaction-controller/transaction-controller';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { formatDateTimeDdMmYyyyHhMm } from '@utils/dateTimeCs';
import { formatWalletAmount } from './walletDisplay';
import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';

const TX_LIST = { page: 0, size: 25, sort: ['transactionDate,desc'] } as const;

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

export const RecentTransactionsPanel: FC<{ trackerId: string }> = ({ trackerId }) => {
  const theme = useTheme();
  const { data } = useQuery({
    queryKey: ['/api/transaction', trackerId, TX_LIST],
    queryFn: () => transactionFindAll(trackerId, TX_LIST),
    enabled: Boolean(trackerId),
  });

  const txPaged = data?.data as PagedModelTransactionResponseDto | undefined;
  const recentTx = (txPaged?.content ?? []) as TransactionResponseDto[];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Nedávné transakce
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Posledních {TX_LIST.size} záznamů, řazeno podle data.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Datum</TableCell>
            <TableCell>Typ</TableCell>
            <TableCell>Kategorie</TableCell>
            <TableCell>Popis</TableCell>
            <TableCell align="right">Částka</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {recentTx.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <Typography color="text.secondary">Zatím žádné záznamy.</Typography>
              </TableCell>
            </TableRow>
          ) : (
            recentTx.map((row) => (
              <TableRow key={row.id ?? row.transactionDate}>
                <TableCell>{formatDateTimeDdMmYyyyHhMm(row.transactionDate)}</TableCell>
                <TableCell>{txTypeLabel(row.transactionType as string | undefined)}</TableCell>
                <TableCell>{row.categoryName?.trim() ? row.categoryName : '—'}</TableCell>
                <TableCell>{row.description ?? row.note ?? '—'}</TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 600,
                    color: amountColorForType(row.transactionType as string | undefined, theme),
                  }}
                >
                  {formatWalletAmount(row.amount, row.currencyCode)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Paper>
  );
};
