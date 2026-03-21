import { categoryFindAllActive } from '@api/category-controller/category-controller';
import type {
  CategoryResponseDto,
  CreateTransactionRequestDto,
  PagedModelCategoryResponseDto,
  PagedModelTransactionResponseDto,
  PagedModelWalletResponseDto,
  TransactionResponseDto,
  WalletResponseDto,
} from '@api/model';
import {
  CategoryResponseDtoCategoryKind,
  CreateTransactionRequestDtoTransactionType,
} from '@api/model';
import { transactionCreate, transactionFindAll } from '@api/transaction-controller/transaction-controller';
import { walletFindAll } from '@api/wallet-controller/wallet-controller';
import { PageHeading } from '@components/PageHeading';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useMemo, useState } from 'react';
import { asCategoryChildren, toCategoryTree } from '../categories/categoryTreeUtils';
import {
  defaultDatetimeLocal,
  parseAmount,
  toIsoFromDatetimeLocal,
} from './transactionFormUtils';

const WALLET_LIST = { page: 0, size: 200 } as const;
const CAT_LIST = { page: 0, size: 2000 } as const;
const TX_LIST = { page: 0, size: 25, sort: ['transactionDate,desc'] } as const;

function flattenCategories(nodes: CategoryResponseDto[]): CategoryResponseDto[] {
  const out: CategoryResponseDto[] = [];
  const walk = (n: CategoryResponseDto) => {
    out.push(n);
    asCategoryChildren(n.children).forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function txTypeLabel(t?: string): string {
  switch (t) {
    case CreateTransactionRequestDtoTransactionType.TRANSFER:
      return 'Převod';
    case CreateTransactionRequestDtoTransactionType.INCOME:
      return 'Příjem';
    case CreateTransactionRequestDtoTransactionType.EXPENSE:
      return 'Výdaj';
    case CreateTransactionRequestDtoTransactionType.BALANCE_ADJUSTMENT:
      return 'Korekce';
    default:
      return t ?? '—';
  }
}

function formatTxDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export type TransactionFormsPanelProps = {
  trackerId: string;
  trackerName: string;
  walletsFromParent?: WalletResponseDto[];
  embedded?: boolean;
};

export const TransactionFormsPanel: FC<TransactionFormsPanelProps> = ({
  trackerId,
  trackerName,
  walletsFromParent,
  embedded,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data: walletsRes } = useQuery({
    queryKey: ['/api/wallet', trackerId, WALLET_LIST],
    queryFn: () => walletFindAll(trackerId, WALLET_LIST),
    enabled: Boolean(trackerId) && walletsFromParent === undefined,
  });

  const { data: catRes } = useQuery({
    queryKey: [`/api/category/${trackerId}/active`, CAT_LIST],
    queryFn: () => categoryFindAllActive(trackerId, CAT_LIST),
    enabled: Boolean(trackerId),
  });
  const { data: txRes, refetch: refetchTx } = useQuery({
    queryKey: ['/api/transaction', trackerId, TX_LIST],
    queryFn: () => transactionFindAll(trackerId, TX_LIST),
    enabled: Boolean(trackerId),
  });

  const walletsFromApi = ((walletsRes?.data as PagedModelWalletResponseDto | undefined)?.content ??
    []) as WalletResponseDto[];
  const walletSource = walletsFromParent ?? walletsFromApi;
  const activeWallets = walletSource.filter((w) => w.active !== false && w.id);

  const catPaged = catRes?.data as PagedModelCategoryResponseDto | undefined;
  const catFlat = catPaged?.content ?? [];
  const catTree = useMemo(() => toCategoryTree(catFlat), [catFlat]);
  const categoriesFlat = useMemo(() => flattenCategories(catTree), [catTree]);
  const incomeCats = categoriesFlat.filter((c) => c.categoryKind === CategoryResponseDtoCategoryKind.INCOME);
  const expenseCats = categoriesFlat.filter(
    (c) => c.categoryKind === CategoryResponseDtoCategoryKind.EXPENSE,
  );

  const txPaged = txRes?.data as PagedModelTransactionResponseDto | undefined;
  const recentTx = (txPaged?.content ?? []) as TransactionResponseDto[];

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/transaction', trackerId] });
    await queryClient.invalidateQueries({ queryKey: ['/api/wallet', trackerId] });
  };

  const submit = async (payload: CreateTransactionRequestDto) => {
    setSubmitting(true);
    try {
      const res = await transactionCreate(trackerId, payload);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Transakci se nepodařilo uložit'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Transakce byla zaznamenána', { variant: 'success' });
      await invalidate();
      await refetchTx();
    } catch {
      enqueueSnackbar('Transakci se nepodařilo uložit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const header = embedded ? (
    <PageHeading component="h2" sx={{ mt: 4, mb: 1 }}>
      Transakce
    </PageHeading>
  ) : (
    <>
      <PageHeading component="h1" gutterBottom>
        Transakce
      </PageHeading>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Rozpočet: <strong>{trackerName}</strong>
      </Typography>
    </>
  );

  return (
    <Box>
      {header}

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Příjem / výdaj
          </Typography>
          <IncomeExpenseForm
            wallets={activeWallets}
            incomeCategories={incomeCats}
            expenseCategories={expenseCats}
            submitting={submitting}
            onSubmit={submit}
          />
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Nedávné transakce
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Datum</TableCell>
                <TableCell>Typ</TableCell>
                <TableCell>Popis</TableCell>
                <TableCell align="right">Částka</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentTx.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">Zatím žádné záznamy.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                recentTx.map((row) => (
                  <TableRow key={row.id ?? row.transactionDate}>
                    <TableCell>{formatTxDate(row.transactionDate)}</TableCell>
                    <TableCell>{txTypeLabel(row.transactionType as string | undefined)}</TableCell>
                    <TableCell>{row.description ?? row.note ?? '—'}</TableCell>
                    <TableCell align="right">
                      {row.amount != null ? row.amount : '—'}
                      {row.currencyCode ? ` ${row.currencyCode}` : ''}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      </Stack>
    </Box>
  );
};

type WalletProps = {
  wallets: WalletResponseDto[];
  submitting: boolean;
  onSubmit: (p: CreateTransactionRequestDto) => Promise<void>;
};

type IEProps = WalletProps & {
  incomeCategories: CategoryResponseDto[];
  expenseCategories: CategoryResponseDto[];
};

const IncomeExpenseForm: FC<IEProps> = ({
  wallets,
  incomeCategories,
  expenseCategories,
  submitting,
  onSubmit,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [kind, setKind] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState(defaultDatetimeLocal);
  const [description, setDescription] = useState('');

  const cats = kind === 'INCOME' ? incomeCategories : expenseCategories;

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    const amt = parseAmount(amount);
    if (!walletId || !categoryId) {
      enqueueSnackbar('Vyber peněženku a kategorii', { variant: 'warning' });
      return;
    }
    if (amt == null || amt <= 0) {
      enqueueSnackbar('Zadej kladnou částku', { variant: 'warning' });
      return;
    }
    await onSubmit({
      transactionType:
        kind === 'INCOME'
          ? CreateTransactionRequestDtoTransactionType.INCOME
          : CreateTransactionRequestDtoTransactionType.EXPENSE,
      walletId,
      categoryId,
      amount: amt,
      transactionDate: toIsoFromDatetimeLocal(when),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
  };

  return (
    <Box component="form" onSubmit={handle}>
      <Stack spacing={2} maxWidth={480}>
        <Typography variant="body2" color="text.secondary">
          Příjem nebo výdaj v jedné peněžence vůči kategorii.
        </Typography>
        <FormControl fullWidth>
          <InputLabel id="ie-kind">Typ</InputLabel>
          <Select
            labelId="ie-kind"
            label="Typ"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as 'INCOME' | 'EXPENSE');
              setCategoryId('');
            }}
          >
            <MenuItem value="EXPENSE">Výdaj</MenuItem>
            <MenuItem value="INCOME">Příjem</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth required>
          <InputLabel id="ie-w">Peněženka</InputLabel>
          <Select
            labelId="ie-w"
            label="Peněženka"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value as string)}
          >
            {wallets.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name ?? w.id} {w.currencyCode ? `(${w.currencyCode})` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth required>
          <InputLabel id="ie-cat">Kategorie</InputLabel>
          <Select
            labelId="ie-cat"
            label="Kategorie"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value as string)}
          >
            {cats.length === 0 ? (
              <MenuItem value="" disabled>
                Žádná kategorie — přidej v menu Kategorie
              </MenuItem>
            ) : (
              cats.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name ?? c.id}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
        <TextField
          label="Částka"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          inputMode="decimal"
        />
        <TextField
          label="Datum a čas"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
          InputLabelProps={{ shrink: true }}
          required
          fullWidth
        />
        <TextField label="Popis (volitelné)" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
        <Button type="submit" variant="contained" disabled={submitting}>
          Uložit
        </Button>
      </Stack>
    </Box>
  );
};
