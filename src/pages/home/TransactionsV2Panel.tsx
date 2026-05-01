import {
  useCreateAssetExchange,
  useCreateWalletTransfer,
} from '@api/transaction-v-2-controller/transaction-v-2-controller';
import type {
  CreateAssetExchangeV2RequestDto,
  CreateAssetExchangeV2ResponseDto,
  CreateWalletTransferV2RequestDto,
  CreateWalletTransferV2ResponseDto,
  HoldingResponseDto,
  PagedModelHoldingResponseDto,
} from '@api/model';
import { holdingFindAll } from '@api/holding-controller/holding-controller';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DEFAULT_FIAT_SCALE, majorToMinorUnitsForScale, minorUnitsToMajorForScale } from '@utils/moneyMinorUnits';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useState } from 'react';
import { defaultDatetimeLocal, toIsoFromDatetimeLocal } from './transactionFormUtils';

const HOLDING_LIST_PARAMS = { page: 0, size: 200 } as const;

type FormMode = 'wallet-transfer' | 'asset-exchange';

type Props = {
  trackerId: string;
};

function holdingLabel(h: HoldingResponseDto): string {
  const parts: string[] = [];
  if (h.accountName) parts.push(h.accountName);
  if (h.assetCode) parts.push(h.assetCode);
  if (h.institutionName) parts.push(h.institutionName);
  const label = parts.join(' / ') || h.id || '—';
  return h.assetScale != null ? `${label} (scale ${h.assetScale})` : label;
}

const EMPTY_FORM = {
  sourceHoldingId: '',
  targetHoldingId: '',
  amount: '',
  settledAmount: '',
  feeAmount: '',
  exchangeRate: '',
  transactionDate: '',
  description: '',
  note: '',
  externalRef: '',
};

type FormState = typeof EMPTY_FORM;
type TransactionV2Result = CreateWalletTransferV2ResponseDto | CreateAssetExchangeV2ResponseDto;

function parseOptionalNumber(s: string): number | undefined {
  const t = s.trim().replace(',', '.');
  if (!t) return undefined;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}

function formatMajor(minor: number | undefined, scale: number | undefined): string {
  const val = minorUnitsToMajorForScale(minor, scale ?? DEFAULT_FIAT_SCALE);
  if (val == null) return '—';
  return val.toLocaleString('cs-CZ', { maximumFractionDigits: scale ?? DEFAULT_FIAT_SCALE });
}

export const TransactionsV2Panel: FC<Props> = ({ trackerId }) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<FormMode>('wallet-transfer');
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    transactionDate: defaultDatetimeLocal(),
  }));
  const [lastResult, setLastResult] = useState<TransactionV2Result | null>(null);

  const { data: holdingsRes } = useQuery({
    queryKey: ['holdingFindAll', trackerId, 'v2-panel'] as const,
    enabled: !!trackerId,
    queryFn: async () => {
      const res = await holdingFindAll(trackerId, HOLDING_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as PagedModelHoldingResponseDto;
    },
    staleTime: 60_000,
  });

  const holdings: HoldingResponseDto[] = holdingsRes?.content ?? [];

  const walletTransferMutation = useCreateWalletTransfer({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: [`/api/transaction/${trackerId}`] });
        const dto = res.data as unknown as CreateWalletTransferV2ResponseDto;
        setLastResult(dto);
        enqueueSnackbar('Převod peněženek byl vytvořen', { variant: 'success' });
        setForm({ ...EMPTY_FORM, transactionDate: defaultDatetimeLocal() });
      },
      onError: () => {
        enqueueSnackbar('Vytvoření převodu se nezdařilo', { variant: 'error' });
      },
    },
  });

  const assetExchangeMutation = useCreateAssetExchange({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: [`/api/transaction/${trackerId}`] });
        const dto = res.data as unknown as CreateAssetExchangeV2ResponseDto;
        setLastResult(dto);
        enqueueSnackbar('Výměna aktiv byla vytvořena', { variant: 'success' });
        setForm({ ...EMPTY_FORM, transactionDate: defaultDatetimeLocal() });
      },
      onError: () => {
        enqueueSnackbar('Vytvoření výměny se nezdařilo', { variant: 'error' });
      },
    },
  });

  const saving = walletTransferMutation.isPending || assetExchangeMutation.isPending;

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLastResult(null);

    if (!form.sourceHoldingId) {
      enqueueSnackbar('Vyber zdrojový holding', { variant: 'warning' });
      return;
    }
    if (!form.targetHoldingId) {
      enqueueSnackbar('Vyber cílový holding', { variant: 'warning' });
      return;
    }
    if (form.sourceHoldingId === form.targetHoldingId) {
      enqueueSnackbar('Zdrojový a cílový holding musí být různé', { variant: 'warning' });
      return;
    }

    const amountVal = parseOptionalNumber(form.amount);
    const settledAmountVal = parseOptionalNumber(form.settledAmount);

    if ((amountVal == null || amountVal <= 0) && (settledAmountVal == null || settledAmountVal <= 0)) {
      enqueueSnackbar('Vyplň alespoň Částku nebo Vypořádanou částku', { variant: 'warning' });
      return;
    }
    if (amountVal != null && amountVal <= 0) {
      enqueueSnackbar('Částka musí být kladná', { variant: 'warning' });
      return;
    }
    if (settledAmountVal != null && settledAmountVal <= 0) {
      enqueueSnackbar('Vypořádaná částka musí být kladná', { variant: 'warning' });
      return;
    }

    const transactionDateIso = form.transactionDate.trim()
      ? toIsoFromDatetimeLocal(form.transactionDate)
      : undefined;
    if (form.transactionDate.trim() && !transactionDateIso) {
      enqueueSnackbar('Neplatné datum a čas — použij formát dd.MM.yyyy HH:mm', { variant: 'warning' });
      return;
    }

    const sourceHolding = holdings.find((h) => h.id === form.sourceHoldingId);
    const targetHolding = holdings.find((h) => h.id === form.targetHoldingId);
    const sourceScale = sourceHolding?.assetScale ?? DEFAULT_FIAT_SCALE;
    const targetScale = targetHolding?.assetScale ?? DEFAULT_FIAT_SCALE;

    const feeAmountVal = parseOptionalNumber(form.feeAmount);

    const commonFields = {
      sourceHoldingId: form.sourceHoldingId,
      targetHoldingId: form.targetHoldingId,
      ...(amountVal != null ? { amount: majorToMinorUnitsForScale(amountVal, sourceScale) } : {}),
      ...(settledAmountVal != null ? { settledAmount: majorToMinorUnitsForScale(settledAmountVal, targetScale) } : {}),
      ...(transactionDateIso ? { transactionDate: transactionDateIso } : {}),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
      ...(form.externalRef.trim() ? { externalRef: form.externalRef.trim() } : {}),
    };

    if (mode === 'wallet-transfer') {
      const payload: CreateWalletTransferV2RequestDto = commonFields;
      walletTransferMutation.mutate({ trackerId, data: payload });
    } else {
      const payload: CreateAssetExchangeV2RequestDto = {
        ...commonFields,
        ...(feeAmountVal != null ? { feeAmount: majorToMinorUnitsForScale(feeAmountVal, sourceScale) } : {}),
        ...(parseOptionalNumber(form.exchangeRate) != null ? { exchangeRate: parseOptionalNumber(form.exchangeRate) } : {}),
      };
      assetExchangeMutation.mutate({ trackerId, data: payload });
    }
  };

  const isExchange = mode === 'asset-exchange';

  return (
    <Box sx={{ mt: 2 }}>
      <Tabs
        value={mode}
        onChange={(_, v: FormMode) => { setMode(v); setLastResult(null); }}
        sx={{ mb: 3 }}
      >
        <Tab value="wallet-transfer" label="Převod peněženek" />
        <Tab value="asset-exchange" label="Výměna aktiv" />
      </Tabs>

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {isExchange ? 'Nová výměna aktiv (V2)' : 'Nový převod peněženek (V2)'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isExchange
            ? 'Zaznamená výměnu aktiv mezi dvěma holdingy (různé měny / aktiva).'
            : 'Přesune částku z jednoho holdingu do druhého.'}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth disabled={saving || !holdingsRes}>
                <InputLabel id="source-holding-label">Zdrojový holding *</InputLabel>
                <Select
                  labelId="source-holding-label"
                  label="Zdrojový holding *"
                  value={form.sourceHoldingId}
                  onChange={(e) => setForm((prev) => ({ ...prev, sourceHoldingId: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>— nevybráno —</em>
                  </MenuItem>
                  {holdings.map((h) => (
                    <MenuItem key={h.id} value={h.id}>
                      {holdingLabel(h)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={saving || !holdingsRes}>
                <InputLabel id="target-holding-label">Cílový holding *</InputLabel>
                <Select
                  labelId="target-holding-label"
                  label="Cílový holding *"
                  value={form.targetHoldingId}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetHoldingId: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>— nevybráno —</em>
                  </MenuItem>
                  {holdings.map((h) => (
                    <MenuItem key={h.id} value={h.id}>
                      {holdingLabel(h)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Divider />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Částka"
                value={form.amount}
                onChange={set('amount')}
                inputMode="decimal"
                fullWidth
                disabled={saving}
                placeholder="volitelné"
                helperText="alespoň jedno z Částka / Vypořádaná"
              />
              <TextField
                label="Vypořádaná částka"
                value={form.settledAmount}
                onChange={set('settledAmount')}
                inputMode="decimal"
                fullWidth
                disabled={saving}
                placeholder="volitelné"
                helperText="alespoň jedno z Částka / Vypořádaná"
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Datum a čas"
                value={form.transactionDate}
                onChange={set('transactionDate')}
                fullWidth
                disabled={saving}
                placeholder="dd.MM.yyyy HH:mm"
                helperText="formát dd.MM.yyyy HH:mm"
              />
            </Stack>

            {isExchange && (
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Poplatek"
                    value={form.feeAmount}
                    onChange={set('feeAmount')}
                    inputMode="decimal"
                    fullWidth
                    disabled={saving}
                    placeholder="volitelné"
                  />
                  <TextField
                    label="Kurz"
                    value={form.exchangeRate}
                    onChange={set('exchangeRate')}
                    inputMode="decimal"
                    fullWidth
                    disabled={saving}
                    placeholder="volitelné"
                  />
                </Stack>
              </Stack>
            )}

            <Divider />

            <TextField
              label="Popis"
              value={form.description}
              onChange={set('description')}
              fullWidth
              disabled={saving}
            />
            <TextField
              label="Poznámka"
              value={form.note}
              onChange={set('note')}
              fullWidth
              multiline
              minRows={2}
              disabled={saving}
            />
            <TextField
              label="Externí reference"
              value={form.externalRef}
              onChange={set('externalRef')}
              fullWidth
              disabled={saving}
              placeholder="volitelné"
            />

            <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {saving ? 'Ukládám…' : isExchange ? 'Vytvořit výměnu' : 'Vytvořit převod'}
              </Button>
              <Button
                type="button"
                variant="outlined"
                disabled={saving}
                onClick={() => { setForm({ ...EMPTY_FORM, transactionDate: defaultDatetimeLocal() }); setLastResult(null); }}
              >
                Vymazat
              </Button>
            </Stack>
          </Stack>
        </Box>

        {lastResult && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Výsledek — {lastResult.operationType ?? '—'} · {lastResult.calculationMode ?? '—'}
            </Typography>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Box>
                <Typography variant="caption" color="text.secondary">Odečteno ze zdroje</Typography>
                <Typography variant="body2">
                  {formatMajor(lastResult.sourceDeduction, lastResult.sourceAssetScale)} {lastResult.sourceAssetCode ?? ''}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Připsáno na cíl</Typography>
                <Typography variant="body2">
                  {formatMajor(lastResult.targetAddition, lastResult.targetAssetScale)} {lastResult.targetAssetCode ?? ''}
                </Typography>
              </Box>
              {lastResult.feeAmount != null && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Poplatek</Typography>
                  <Typography variant="body2">
                    {formatMajor(lastResult.feeAmount, lastResult.sourceAssetScale)} {lastResult.sourceAssetCode ?? ''}
                  </Typography>
                </Box>
              )}
              {lastResult.feeOverridden && (
                <Box>
                  <Typography variant="caption" color="warning.main">Poplatek byl přepočítán</Typography>
                </Box>
              )}
            </Stack>
          </Alert>
        )}
      </Paper>
    </Box>
  );
};
