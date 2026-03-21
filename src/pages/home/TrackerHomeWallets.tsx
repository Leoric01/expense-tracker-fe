import { walletCreate, walletFindAll } from '@api/wallet-controller/wallet-controller';
import type { CreateWalletRequestDto, PagedModelWalletResponseDto, WalletResponseDto } from '@api/model';
import { CreateWalletRequestDtoWalletType } from '@api/model';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useState } from 'react';
import { formatWalletAmount, walletTypeLabel, WALLET_TYPE_OPTIONS } from './walletDisplay';

type Props = {
  trackerId: string;
  trackerName: string;
};

const LIST_PARAMS = { page: 0, size: 100 } as const;

export const TrackerHomeWallets: FC<Props> = ({ trackerId, trackerName }) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<CreateWalletRequestDtoWalletType>(
    CreateWalletRequestDtoWalletType.CASH,
  );
  const [currencyCode, setCurrencyCode] = useState('CZK');
  const [initialBalance, setInitialBalance] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/wallet', trackerId, LIST_PARAMS],
    queryFn: () => walletFindAll(trackerId, LIST_PARAMS),
    enabled: Boolean(trackerId),
  });

  const paged = data?.data as PagedModelWalletResponseDto | undefined;
  const items = (paged?.content ?? []) as WalletResponseDto[];

  const resetForm = () => {
    setName('');
    setWalletType(CreateWalletRequestDtoWalletType.CASH);
    setCurrencyCode('CZK');
    setInitialBalance('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const code = currencyCode.trim().toUpperCase();
    if (!trimmedName || !code) {
      enqueueSnackbar('Vyplň název a měnu', { variant: 'warning' });
      return;
    }

    const payload: CreateWalletRequestDto = {
      name: trimmedName,
      walletType,
      currencyCode: code,
    };
    const bal = initialBalance.trim();
    if (bal !== '') {
      const n = parseFloat(bal.replace(',', '.'));
      if (!Number.isNaN(n)) payload.initialBalance = n;
    }

    setSubmitting(true);
    try {
      const res = await walletCreate(trackerId, payload);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Peněženku se nepodařilo vytvořit',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Peněženka byla vytvořena', { variant: 'success' });
      setCreateOpen(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ['/api/wallet', trackerId] });
    } catch {
      enqueueSnackbar('Peněženku se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {trackerName}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h6" component="h2" color="text.secondary" fontWeight={600}>
          Moje peněženky
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
        >
          Přidat peněženku
        </Button>
      </Stack>

      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst peněženky.
        </Typography>
      )}

      {isLoading ? (
        <Typography color="text.secondary">Načítám peněženky…</Typography>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">Zatím žádná peněženka — přidej první.</Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {items.map((w) => (
            <Card key={w.id ?? w.name} variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="h6" component="h3" sx={{ lineHeight: 1.3 }}>
                    {w.name ?? '—'}
                  </Typography>
                  {w.active === false && <Chip size="small" label="Neaktivní" variant="outlined" />}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {walletTypeLabel(w.walletType)}
                  {w.currencyCode ? ` · ${w.currencyCode}` : ''}
                </Typography>
                <Typography variant="h6" component="p" sx={{ fontWeight: 600 }}>
                  {formatWalletAmount(w.currentBalance, w.currencyCode)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nová peněženka</DialogTitle>
        <Box component="form" onSubmit={handleCreate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                autoFocus
              />
              <FormControl fullWidth required>
                <InputLabel id="wallet-type-label">Typ</InputLabel>
                <Select
                  labelId="wallet-type-label"
                  label="Typ"
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value as CreateWalletRequestDtoWalletType)}
                >
                  {WALLET_TYPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Měna (ISO)"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                required
                fullWidth
                inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
              />
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
    </Box>
  );
};
