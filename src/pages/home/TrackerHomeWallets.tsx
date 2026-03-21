import { transactionCreate } from '@api/transaction-controller/transaction-controller';
import { walletCreate, walletFindAll } from '@api/wallet-controller/wallet-controller';
import type { CreateWalletRequestDto, PagedModelWalletResponseDto, WalletResponseDto } from '@api/model';
import { CreateTransactionRequestDtoTransactionType } from '@api/model';
import { CreateWalletRequestDtoWalletType } from '@api/model';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CardContent,
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
import { PageHeading } from '@components/PageHeading';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { DragEvent, FC, FormEvent, useEffect, useRef, useState } from 'react';
import { TransactionFormsPanel } from './TransactionFormsPanel';
import {
  defaultDatetimeLocal,
  parseAmount,
  toIsoFromDatetimeLocal,
} from './transactionFormUtils';
import { formatWalletAmount, walletTypeLabel, WALLET_TYPE_OPTIONS } from './walletDisplay';

type Props = {
  trackerId: string;
  trackerName: string;
};

const LIST_PARAMS = { page: 0, size: 200 } as const;
const WALLET_DRAG_MIME = 'application/x-wallet-id';

export const TrackerHomeWallets: FC<Props> = ({ trackerId, trackerName }) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const ignoreClickUntilRef = useRef(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<CreateWalletRequestDtoWalletType>(
    CreateWalletRequestDtoWalletType.CASH,
  );
  const [currencyCode, setCurrencyCode] = useState('CZK');
  const [initialBalance, setInitialBalance] = useState('');

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHoverId, setDropHoverId] = useState<string | null>(null);
  const [transferPair, setTransferPair] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferWhen, setTransferWhen] = useState(defaultDatetimeLocal);
  const [transferDesc, setTransferDesc] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [correctionWallet, setCorrectionWallet] = useState<WalletResponseDto | null>(null);
  const [corrBalance, setCorrBalance] = useState('');
  const [corrWhen, setCorrWhen] = useState(defaultDatetimeLocal);
  const [corrNote, setCorrNote] = useState('');
  const [corrSubmitting, setCorrSubmitting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/wallet', trackerId, LIST_PARAMS],
    queryFn: () => walletFindAll(trackerId, LIST_PARAMS),
    enabled: Boolean(trackerId),
  });

  const paged = data?.data as PagedModelWalletResponseDto | undefined;
  const items = (paged?.content ?? []) as WalletResponseDto[];

  const invalidateFinance = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/transaction', trackerId] });
    await queryClient.invalidateQueries({ queryKey: ['/api/wallet', trackerId] });
  };

  useEffect(() => {
    if (transferPair) {
      setTransferAmount('');
      setTransferWhen(defaultDatetimeLocal());
      setTransferDesc('');
    }
  }, [transferPair]);

  useEffect(() => {
    if (correctionWallet) {
      setCorrBalance('');
      setCorrWhen(defaultDatetimeLocal());
      setCorrNote('');
    }
  }, [correctionWallet?.id]);

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

  const sourceWallet = transferPair ? items.find((x) => x.id === transferPair.sourceId) : undefined;
  const targetWallet = transferPair ? items.find((x) => x.id === transferPair.targetId) : undefined;
  const transferCurrenciesOk = (() => {
    if (!sourceWallet || !targetWallet) return false;
    const a = sourceWallet.currencyCode?.trim().toUpperCase() ?? '';
    const b = targetWallet.currencyCode?.trim().toUpperCase() ?? '';
    if (!a || !b) return true;
    return a === b;
  })();

  const handleTransferSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferPair || !transferCurrenciesOk) return;
    const amt = parseAmount(transferAmount);
    if (amt == null || amt <= 0) {
      enqueueSnackbar('Zadej kladnou částku', { variant: 'warning' });
      return;
    }
    setTransferSubmitting(true);
    try {
      const res = await transactionCreate(trackerId, {
        transactionType: CreateTransactionRequestDtoTransactionType.TRANSFER,
        sourceWalletId: transferPair.sourceId,
        targetWalletId: transferPair.targetId,
        amount: amt,
        transactionDate: toIsoFromDatetimeLocal(transferWhen),
        ...(transferDesc.trim() ? { description: transferDesc.trim() } : {}),
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
  };

  const handleCorrectionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!correctionWallet?.id) return;
    const bal = parseAmount(corrBalance);
    if (bal == null) {
      enqueueSnackbar('Zadej skutečný zůstatek po inventuře', { variant: 'warning' });
      return;
    }
    setCorrSubmitting(true);
    try {
      const res = await transactionCreate(trackerId, {
        transactionType: CreateTransactionRequestDtoTransactionType.BALANCE_ADJUSTMENT,
        walletId: correctionWallet.id,
        correctedBalance: bal,
        transactionDate: toIsoFromDatetimeLocal(corrWhen),
        ...(corrNote.trim() ? { note: corrNote.trim() } : {}),
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
  };

  const handleDragStart = (e: DragEvent, walletId: string) => {
    e.dataTransfer.setData(WALLET_DRAG_MIME, walletId);
    e.dataTransfer.setData('text/plain', walletId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(walletId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropHoverId(null);
  };

  const handleDragOver = (e: DragEvent, walletId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (walletId !== draggingId) {
      setDropHoverId(walletId);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDropHoverId(null);
  };

  const handleDrop = (e: DragEvent, target: WalletResponseDto) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreClickUntilRef.current = Date.now() + 500;
    setDraggingId(null);
    setDropHoverId(null);
    const sourceId = e.dataTransfer.getData(WALLET_DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!sourceId || !target.id || sourceId === target.id) return;
    setTransferPair({ sourceId, targetId: target.id });
  };

  const handleCardClick = (w: WalletResponseDto) => {
    if (Date.now() < ignoreClickUntilRef.current) return;
    if (!w.id) return;
    setCorrectionWallet(w);
  };

  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        {trackerName}
      </PageHeading>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 1 }}>
        <PageHeading component="h2">Moje peněženky</PageHeading>
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Přetáhni aktivní peněženku na jinou pro převod. Klikni na peněženku pro korekci zůstatku (inventura).
      </Typography>

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
          {items.map((w) => {
            const wid = w.id ?? '';
            const canDrag = Boolean(w.id) && w.active !== false;
            const isDragging = draggingId === w.id;
            const isDropHover = dropHoverId === w.id && draggingId && draggingId !== w.id;

            return (
              <Card
                key={w.id ?? w.name}
                draggable={canDrag}
                onDragStart={canDrag ? (e) => handleDragStart(e, w.id!) : undefined}
                onDragEnd={canDrag ? handleDragEnd : undefined}
                onDragOver={wid && w.active !== false ? (e) => handleDragOver(e, wid) : undefined}
                onDragLeave={wid ? handleDragLeave : undefined}
                onDrop={wid && w.active !== false ? (e) => handleDrop(e, w) : undefined}
                onClick={() => handleCardClick(w)}
                variant="outlined"
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  opacity: isDragging ? 0.55 : 1,
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                  outline: isDropHover ? (t) => `2px solid ${t.palette.primary.main}` : 'none',
                  outlineOffset: 2,
                }}
              >
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
                  {canDrag && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Přetáhni pro převod
                    </Typography>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <TransactionFormsPanel
        embedded
        trackerId={trackerId}
        trackerName={trackerName}
        walletsFromParent={items}
      />

      <Dialog
        open={Boolean(transferPair)}
        onClose={() => !transferSubmitting && setTransferPair(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Převod mezi peněženkami</DialogTitle>
        <Box component="form" onSubmit={handleTransferSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Z: <strong>{sourceWallet?.name ?? '—'}</strong>
                {sourceWallet?.currencyCode ? ` (${sourceWallet.currencyCode})` : ''}
                {' → '}
                Do: <strong>{targetWallet?.name ?? '—'}</strong>
                {targetWallet?.currencyCode ? ` (${targetWallet.currencyCode})` : ''}
              </Typography>
              {!transferCurrenciesOk && sourceWallet && targetWallet && (
                <Alert severity="warning">
                  Měny peněženek se liší — převod mezi nimi nelze tímto způsobem provést.
                </Alert>
              )}
              <TextField
                label="Částka"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                required
                inputMode="decimal"
                disabled={!transferCurrenciesOk}
                fullWidth
              />
              <TextField
                label="Datum a čas"
                type="datetime-local"
                value={transferWhen}
                onChange={(e) => setTransferWhen(e.target.value)}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
                disabled={!transferCurrenciesOk}
              />
              <TextField
                label="Popis (volitelné)"
                value={transferDesc}
                onChange={(e) => setTransferDesc(e.target.value)}
                fullWidth
                disabled={!transferCurrenciesOk}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setTransferPair(null)} disabled={transferSubmitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={transferSubmitting || !transferCurrenciesOk}>
              Provést převod
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(correctionWallet)}
        onClose={() => !corrSubmitting && setCorrectionWallet(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Korekce zůstatku (inventura)</DialogTitle>
        <Box component="form" onSubmit={handleCorrectionSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Peněženka: <strong>{correctionWallet?.name ?? '—'}</strong>
                {correctionWallet?.currencyCode ? ` · ${correctionWallet.currencyCode}` : ''}
              </Typography>
              <Typography variant="body2">
                Účetní zůstatek:{' '}
                <strong>{formatWalletAmount(correctionWallet?.currentBalance, correctionWallet?.currencyCode)}</strong>
              </Typography>
              <Alert severity="info" variant="outlined">
                Zadej skutečný zůstatek podle reality; rozdíl vůči systému dopočítá server.
              </Alert>
              <TextField
                label="Skutečný zůstatek po inventuře"
                value={corrBalance}
                onChange={(e) => setCorrBalance(e.target.value)}
                required
                inputMode="decimal"
                fullWidth
              />
              <TextField
                label="Datum a čas"
                type="datetime-local"
                value={corrWhen}
                onChange={(e) => setCorrWhen(e.target.value)}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
              <TextField label="Poznámka (volitelné)" value={corrNote} onChange={(e) => setCorrNote(e.target.value)} fullWidth />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setCorrectionWallet(null)} disabled={corrSubmitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={corrSubmitting}>
              Uložit korekci
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

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
