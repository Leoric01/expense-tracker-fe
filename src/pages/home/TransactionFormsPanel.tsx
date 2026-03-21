import { categoryFindAllActive } from '@api/category-controller/category-controller';
import type {
  CategoryResponseDto,
  CreateTransactionRequestDto,
  PagedModelCategoryResponseDto,
  PagedModelWalletResponseDto,
  WalletResponseDto,
} from '@api/model';
import {
  CategoryResponseDtoCategoryKind,
  CreateTransactionRequestDtoTransactionType,
} from '@api/model';
import { transactionCreate } from '@api/transaction-controller/transaction-controller';
import { walletFindAll } from '@api/wallet-controller/wallet-controller';
import { PageHeading } from '@components/PageHeading';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useDebouncedValue } from '@hooks/useDebouncedValue';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useEffect, useMemo, useState } from 'react';
import { toCategoryTree } from '../categories/categoryTreeUtils';
import { CategoryTreePicker } from './CategoryTreePicker';
import {
  defaultDatetimeLocal,
  parseAmount,
  toIsoFromDatetimeLocal,
} from './transactionFormUtils';

const WALLET_LIST = { page: 0, size: 200 } as const;

export type TransactionFormsPanelProps = {
  trackerId: string;
  trackerName: string;
  walletsFromParent?: WalletResponseDto[];
  embedded?: boolean;
  /** Skryje nadpis „Transakce“ (záložky na Domě). */
  hideTitle?: boolean;
};

export const TransactionFormsPanel: FC<TransactionFormsPanelProps> = ({
  trackerId,
  trackerName,
  walletsFromParent,
  embedded,
  hideTitle,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const debouncedCategorySearch = useDebouncedValue(categorySearch, 300);

  const catParams = useMemo(
    () => ({
      page: 0,
      size: 2000,
      ...(debouncedCategorySearch.trim() ? { search: debouncedCategorySearch.trim() } : {}),
    }),
    [debouncedCategorySearch],
  );

  const { data: walletsRes } = useQuery({
    queryKey: ['/api/wallet', trackerId, WALLET_LIST],
    queryFn: () => walletFindAll(trackerId, WALLET_LIST),
    enabled: Boolean(trackerId) && walletsFromParent === undefined,
  });

  const { data: catRes, isLoading: categoriesLoading } = useQuery({
    queryKey: [`/api/category/${trackerId}/active`, catParams],
    queryFn: () => categoryFindAllActive(trackerId, catParams),
    enabled: Boolean(trackerId),
  });

  const walletsFromApi = ((walletsRes?.data as PagedModelWalletResponseDto | undefined)?.content ??
    []) as WalletResponseDto[];
  const walletSource = walletsFromParent ?? walletsFromApi;
  const activeWallets = walletSource.filter((w) => w.active !== false && w.id);

  const catPaged = catRes?.data as PagedModelCategoryResponseDto | undefined;
  const catFlat = catPaged?.content ?? [];
  const categoryTree = useMemo(() => toCategoryTree(catFlat), [catFlat]);

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
    } catch {
      enqueueSnackbar('Transakci se nepodařilo uložit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const header =
    hideTitle && embedded ? null : embedded ? (
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
    <Box sx={hideTitle && embedded ? { mt: 1 } : undefined}>
      {header}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Příjem / výdaj
        </Typography>
        <IncomeExpenseForm
          wallets={activeWallets}
          categoryTree={categoryTree}
          categoryFlat={catFlat}
          categorySearch={categorySearch}
          categorySearchDebounced={debouncedCategorySearch}
          onCategorySearchChange={setCategorySearch}
          categoriesLoading={categoriesLoading}
          submitting={submitting}
          onSubmit={submit}
        />
      </Paper>
    </Box>
  );
};

type WalletProps = {
  wallets: WalletResponseDto[];
  submitting: boolean;
  onSubmit: (p: CreateTransactionRequestDto) => Promise<void>;
};

type IEProps = WalletProps & {
  categoryTree: CategoryResponseDto[];
  categoryFlat: CategoryResponseDto[];
  categorySearch: string;
  categorySearchDebounced: string;
  onCategorySearchChange: (v: string) => void;
  categoriesLoading: boolean;
};

const IncomeExpenseForm: FC<IEProps> = ({
  wallets,
  categoryTree,
  categoryFlat,
  categorySearch,
  categorySearchDebounced,
  onCategorySearchChange,
  categoriesLoading,
  submitting,
  onSubmit,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState(defaultDatetimeLocal);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!categoryId) return;
    if (!categoryFlat.some((c) => c.id === categoryId)) setCategoryId('');
  }, [categoryFlat, categoryId]);

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
    const cat = categoryFlat.find((c) => c.id === categoryId);
    const kind = cat?.categoryKind;
    if (kind !== CategoryResponseDtoCategoryKind.INCOME && kind !== CategoryResponseDtoCategoryKind.EXPENSE) {
      enqueueSnackbar('Kategorie nemá platný typ příjem/výdaj', { variant: 'warning' });
      return;
    }
    await onSubmit({
      transactionType:
        kind === CategoryResponseDtoCategoryKind.INCOME
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
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        <Typography variant="body2" color="text.secondary">
          Typ transakce (příjem nebo výdaj) se vezme z vybrané kategorie.
        </Typography>
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
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Kategorie
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="Hledat v kategoriích…"
            value={categorySearch}
            onChange={(e) => onCategorySearchChange(e.target.value)}
            sx={{ mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <CategoryTreePicker
            key={categorySearchDebounced}
            tree={categoryTree}
            selectedId={categoryId}
            onSelect={setCategoryId}
            emptyMessage={
              categorySearch.trim()
                ? 'Žádná kategorie neodpovídá hledání.'
                : 'Žádná kategorie — přidej v menu Kategorie'
            }
            loading={categoriesLoading}
          />
        </Box>
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
