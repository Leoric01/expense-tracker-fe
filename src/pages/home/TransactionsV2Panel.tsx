import {
  useAssetExchangeRateQuote,
  useCreateAssetExchange,
  useCreateWalletTransfer,
} from '@api/transaction-v-2-controller/transaction-v-2-controller';
import type {
  AssetExchangeRateQuoteResponseDto,
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
  FormControl,
  IconButton,
  InputAdornment,
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
type RateQuoteLabel = {
  sourceHoldingId?: string;
  targetHoldingId?: string;
  sourceAssetCode?: string;
  targetAssetCode?: string;
};

function parseOptionalNumber(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return undefined;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}

function groupIntegerPart(integerPart: string): string {
  const sign = integerPart.startsWith('-') ? '-' : '';
  const digits = sign ? integerPart.slice(1) : integerPart;
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

function groupDecimalText(value: string): string {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return '';
  const normalized = trimmed.replace(',', '.');
  const [integerPart, decimalPart] = normalized.split('.');
  const groupedInteger = groupIntegerPart(integerPart || '0');
  return decimalPart != null ? `${groupedInteger}.${decimalPart}` : groupedInteger;
}

function formatMajor(minor: number | undefined, scale: number | undefined): string {
  const val = minorUnitsToMajorForScale(minor, scale ?? DEFAULT_FIAT_SCALE);
  if (val == null) return '—';
  return val.toLocaleString('cs-CZ', { maximumFractionDigits: scale ?? DEFAULT_FIAT_SCALE });
}

function formatMajorInput(minor: number, scale: number | undefined): string {
  const safeScale = Math.max(0, Math.min(Math.floor(scale ?? DEFAULT_FIAT_SCALE), 20));
  const major = minor / 10 ** safeScale;
  if (!Number.isFinite(major)) return '';
  return major
    .toFixed(safeScale)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
    .replace(/^(.+)$/, groupDecimalText);
}

function formatDecimalInput(value: number, maxFractionDigits: number): string {
  if (!Number.isFinite(value)) return '';
  const digits = Math.max(0, Math.min(Math.floor(maxFractionDigits), 20));
  return value
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
    .replace(/^(.+)$/, groupDecimalText);
}

function formatFixedDecimalInput(value: number, fractionDigits: number): string {
  if (!Number.isFinite(value)) return '';
  const digits = Math.max(0, Math.min(Math.floor(fractionDigits), 20));
  return groupDecimalText(value.toFixed(digits));
}

function formatRateInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumSignificantDigits: 15,
  }).format(value);
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
  const [rateQuoteLabel, setRateQuoteLabel] = useState<RateQuoteLabel | null>(null);

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
  const selectedSourceHolding = holdings.find((h) => h.id === form.sourceHoldingId);
  const selectedTargetHolding = holdings.find((h) => h.id === form.targetHoldingId);
  const sourceBalanceMinor = selectedSourceHolding?.currentAmount;
  const canUseSourceBalance = sourceBalanceMinor != null && Number.isFinite(sourceBalanceMinor) && sourceBalanceMinor > 0;
  const amountValue = parseOptionalNumber(form.amount);
  const rawFeeValue = parseOptionalNumber(form.feeAmount);
  const feeValue = rawFeeValue ?? 0;
  const exchangeRateValue = parseOptionalNumber(form.exchangeRate);
  const canAdjustFeeFromAmount = amountValue != null && amountValue > 0;
  const sourceAssetCode = selectedSourceHolding?.assetCode?.trim().toUpperCase();
  const targetAssetCode = selectedTargetHolding?.assetCode?.trim().toUpperCase();
  const feePercentText =
    rawFeeValue != null && amountValue != null && amountValue > 0
      ? `${formatDecimalInput((rawFeeValue / amountValue) * 100, 4)} %`
      : '';
  const canCalculateSettledAmount =
    mode === 'asset-exchange' &&
    amountValue != null &&
    amountValue > 0 &&
    exchangeRateValue != null &&
    exchangeRateValue > 0 &&
    Boolean(form.targetHoldingId);
  const rateSourceAssetCode =
    rateQuoteLabel?.sourceHoldingId === form.sourceHoldingId &&
    rateQuoteLabel?.targetHoldingId === form.targetHoldingId
      ? rateQuoteLabel.sourceAssetCode
      : selectedSourceHolding?.assetCode;
  const rateTargetAssetCode =
    rateQuoteLabel?.sourceHoldingId === form.sourceHoldingId &&
    rateQuoteLabel?.targetHoldingId === form.targetHoldingId
      ? rateQuoteLabel.targetAssetCode
      : selectedTargetHolding?.assetCode;

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

  const rateQuoteMutation = useAssetExchangeRateQuote({
    mutation: {
      onSuccess: (res) => {
        const dto = res.data as unknown as AssetExchangeRateQuoteResponseDto;
        if (dto.exchangeRate == null || !Number.isFinite(dto.exchangeRate)) {
          enqueueSnackbar('Kurz se nepodařilo zjistit', { variant: 'warning' });
          return;
        }
        setRateQuoteLabel({
          sourceHoldingId: dto.sourceHoldingId,
          targetHoldingId: dto.targetHoldingId,
          sourceAssetCode: dto.sourceAssetCode,
          targetAssetCode: dto.targetAssetCode,
        });
        setForm((prev) => ({ ...prev, exchangeRate: formatRateInput(dto.exchangeRate!) }));
        enqueueSnackbar('Kurz byl doplněn', { variant: 'success' });
      },
      onError: () => {
        enqueueSnackbar('Kurz se nepodařilo zjistit', { variant: 'error' });
      },
    },
  });

  const saving = walletTransferMutation.isPending || assetExchangeMutation.isPending;
  const quotingRate = rateQuoteMutation.isPending;

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const formatNumericField = (field: 'amount' | 'feeAmount') => {
    setForm((prev) => {
      if (field === 'feeAmount') {
        const value = parseOptionalNumber(prev.feeAmount);
        return {
          ...prev,
          feeAmount:
            value == null
              ? ''
              : formatDecimalInput(value, selectedSourceHolding?.assetScale ?? DEFAULT_FIAT_SCALE),
        };
      }
      return { ...prev, [field]: groupDecimalText(prev[field]) };
    });
  };

  const setAmountFromSourceBalance = (ratio: number) => {
    if (!canUseSourceBalance || sourceBalanceMinor == null) {
      enqueueSnackbar('Nejdřív vyber zdrojový holding se zůstatkem', { variant: 'warning' });
      return;
    }
    const amountMinor = Math.floor(sourceBalanceMinor * ratio);
    if (amountMinor <= 0) {
      enqueueSnackbar('Vypočtená částka je menší než nejmenší jednotka aktiva', { variant: 'warning' });
      return;
    }
    setForm((prev) => ({
      ...prev,
      amount: formatMajorInput(amountMinor, selectedSourceHolding?.assetScale),
    }));
  };

  const adjustFeeFromAmount = (direction: 1 | -1) => {
    if (!canAdjustFeeFromAmount || amountValue == null) {
      enqueueSnackbar('Nejdřív vyplň kladnou částku', { variant: 'warning' });
      return;
    }
    const currentFee = parseOptionalNumber(form.feeAmount) ?? 0;
    const step = amountValue * 0.001;
    const nextFee = Math.max(0, currentFee + direction * step);
    const fractionDigits = selectedSourceHolding?.assetScale ?? DEFAULT_FIAT_SCALE;
    setForm((prev) => ({
      ...prev,
      feeAmount: formatDecimalInput(nextFee, fractionDigits),
    }));
  };

  const calculateSettledAmount = () => {
    if (!form.targetHoldingId) {
      enqueueSnackbar('Vyber cílový holding', { variant: 'warning' });
      return;
    }
    if (amountValue == null || amountValue <= 0) {
      enqueueSnackbar('Nejdřív vyplň kladnou částku', { variant: 'warning' });
      return;
    }
    if (exchangeRateValue == null || exchangeRateValue <= 0) {
      enqueueSnackbar('Nejdřív vyplň kladný kurz', { variant: 'warning' });
      return;
    }
    if (feeValue < 0) {
      enqueueSnackbar('Poplatek nesmí být záporný', { variant: 'warning' });
      return;
    }
    const netAmount = amountValue - feeValue;
    if (netAmount <= 0) {
      enqueueSnackbar('Částka po odečtení poplatku musí být kladná', { variant: 'warning' });
      return;
    }
    const settledAmount = netAmount * exchangeRateValue;
    setForm((prev) => ({
      ...prev,
      settledAmount: formatDecimalInput(settledAmount, selectedTargetHolding?.assetScale ?? DEFAULT_FIAT_SCALE),
    }));
  };

  const handleRateQuote = () => {
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
    rateQuoteMutation.mutate({
      trackerId,
      data: {
        sourceHoldingId: form.sourceHoldingId,
        targetHoldingId: form.targetHoldingId,
      },
    });
  };

  const swapHoldings = () => {
    if (!form.sourceHoldingId && !form.targetHoldingId) return;
    setRateQuoteLabel(null);
    setForm((prev) => ({
      ...prev,
      sourceHoldingId: prev.targetHoldingId,
      targetHoldingId: prev.sourceHoldingId,
      settledAmount: '',
      exchangeRate: '',
    }));
  };

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

      <Paper variant="outlined" sx={{ p: 2, maxWidth: 980 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {isExchange ? 'Nová výměna aktiv (V2)' : 'Nový převod peněženek (V2)'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {isExchange
            ? 'Zaznamená výměnu aktiv mezi dvěma holdingy (různé měny / aktiva).'
            : 'Přesune částku z jednoho holdingu do druhého.'}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 1.25,
              alignItems: 'flex-start',
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.75, gridColumn: { xs: '1', sm: 'span 2' } }}>
              <FormControl size="small" fullWidth disabled={saving || !holdingsRes}>
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

              <Button
                type="button"
                size="small"
                variant="outlined"
                disabled={saving || (!form.sourceHoldingId && !form.targetHoldingId)}
                onClick={swapHoldings}
                sx={{ minWidth: 36, px: 0.75 }}
                aria-label="Prohodit zdrojový a cílový holding"
                title="Prohodit zdroj a cíl"
              >
                ↔
              </Button>

              <FormControl size="small" fullWidth disabled={saving || !holdingsRes}>
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
            </Box>

            <TextField
              size="small"
              label="Datum a čas"
              value={form.transactionDate}
              onChange={set('transactionDate')}
              fullWidth
              disabled={saving}
              placeholder="dd.MM.yyyy HH:mm"
            />

            <TextField
              size="small"
              label="Částka"
              value={form.amount}
              onChange={set('amount')}
              onBlur={() => formatNumericField('amount')}
              inputMode="decimal"
              fullWidth
              disabled={saving}
              placeholder="Částka nebo vypořádaná"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ mr: -0.5 }}>
                    <Stack direction="row" spacing={0.3} alignItems="center">
                      {sourceAssetCode ? (
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {sourceAssetCode}
                        </Typography>
                      ) : null}
                      {[
                        ['25%', 0.25],
                        ['50%', 0.5],
                        ['75%', 0.75],
                        ['100%', 1],
                      ].map(([label, ratio]) => (
                        <Button
                          key={label}
                          size="small"
                          variant="contained"
                          disabled={saving || !canUseSourceBalance}
                          onClick={() => setAmountFromSourceBalance(ratio as number)}
                          sx={{
                            minWidth: 0,
                            minHeight: 18,
                            px: 0.4,
                            py: 0,
                            fontSize: '0.56rem',
                            lineHeight: 1,
                            color: 'primary.contrastText',
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </Stack>
                  </InputAdornment>
                ),
              }}
            />
            {isExchange ? (
              <Stack direction="row" spacing={0.5}>
                <TextField
                  size="small"
                  label="Přišlo mi"
                  value={form.settledAmount}
                  onChange={set('settledAmount')}
                  inputMode="decimal"
                  fullWidth
                  disabled={saving}
                  placeholder="volitelné"
                  InputProps={{
                    endAdornment: targetAssetCode ? (
                      <InputAdornment position="end">
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {targetAssetCode}
                        </Typography>
                      </InputAdornment>
                    ) : undefined,
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  disabled={saving || !canCalculateSettledAmount}
                  onClick={calculateSettledAmount}
                  sx={{ whiteSpace: 'nowrap', minWidth: 86 }}
                >
                  Spočítat
                </Button>
              </Stack>
            ) : (
              <TextField
                size="small"
                label="Přišlo mi"
                value={form.settledAmount}
                onChange={set('settledAmount')}
                inputMode="decimal"
                fullWidth
                disabled={saving}
                placeholder="volitelné"
                InputProps={{
                  endAdornment: targetAssetCode ? (
                    <InputAdornment position="end">
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {targetAssetCode}
                      </Typography>
                    </InputAdornment>
                  ) : undefined,
                }}
              />
            )}

            {isExchange ? (
              <TextField
                size="small"
                label="Poplatek"
                value={form.feeAmount}
                onChange={set('feeAmount')}
                onBlur={() => formatNumericField('feeAmount')}
                inputMode="decimal"
                fullWidth
                disabled={saving}
                placeholder="volitelné"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ mr: -0.5 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {sourceAssetCode ? (
                          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.75, whiteSpace: 'nowrap' }}>
                            {sourceAssetCode}
                          </Typography>
                        ) : null}
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          sx={sourceAssetCode ? { pl: 0.75, borderLeft: '1px solid', borderColor: 'divider' } : undefined}
                        >
                          {feePercentText ? (
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                              {feePercentText}
                            </Typography>
                          ) : null}
                          <Stack spacing={0} sx={{ lineHeight: 1 }}>
                            <IconButton
                              size="small"
                              aria-label="Zvýšit poplatek o 0.1 % z částky"
                              disabled={saving || !canAdjustFeeFromAmount}
                              onClick={() => adjustFeeFromAmount(1)}
                              sx={{ p: 0, width: 18, height: 14, fontSize: '0.7rem' }}
                            >
                              ▲
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label="Snížit poplatek o 0.1 % z částky"
                              disabled={saving || !canAdjustFeeFromAmount}
                              onClick={() => adjustFeeFromAmount(-1)}
                              sx={{ p: 0, width: 18, height: 14, fontSize: '0.7rem' }}
                            >
                              ▼
                            </IconButton>
                          </Stack>
                        </Stack>
                      </Stack>
                    </InputAdornment>
                  ),
                }}
              />
            ) : null}

            {isExchange ? (
              <Stack direction="row" spacing={0.75}>
                <TextField
                  size="small"
                  label="Kurz"
                  value={form.exchangeRate}
                  onChange={set('exchangeRate')}
                  inputMode="decimal"
                  fullWidth
                  disabled={saving || quotingRate}
                  placeholder="volitelné"
                  InputProps={{
                    startAdornment: rateSourceAssetCode ? (
                      <InputAdornment position="start">
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          1 {rateSourceAssetCode} =
                        </Typography>
                      </InputAdornment>
                    ) : undefined,
                    endAdornment: rateTargetAssetCode ? (
                      <InputAdornment position="end">
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {rateTargetAssetCode}
                        </Typography>
                      </InputAdornment>
                    ) : undefined,
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  disabled={saving || quotingRate || !form.sourceHoldingId || !form.targetHoldingId}
                  onClick={handleRateQuote}
                  sx={{ whiteSpace: 'nowrap', minWidth: 44, px: 0.75 }}
                >
                  {quotingRate ? <CircularProgress size={16} /> : 'Kurz'}
                </Button>
              </Stack>
            ) : null}

            <TextField
              size="small"
              label="Popis"
              value={form.description}
              onChange={set('description')}
              fullWidth
              disabled={saving}
            />
            <TextField
              size="small"
              label="Externí reference"
              value={form.externalRef}
              onChange={set('externalRef')}
              fullWidth
              disabled={saving}
              placeholder="volitelné"
            />
            <TextField
              size="small"
              label="Poznámka"
              value={form.note}
              onChange={set('note')}
              fullWidth
              multiline
              minRows={1}
              disabled={saving}
              sx={{ gridColumn: { xs: '1', sm: 'span 2', md: 'span 2' } }}
            />

            <Stack direction="row" spacing={1} sx={{ alignSelf: 'center' }}>
              <Button
                type="submit"
                size="small"
                variant="contained"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {saving ? 'Ukládám…' : isExchange ? 'Vytvořit výměnu' : 'Vytvořit převod'}
              </Button>
              <Button
                type="button"
                size="small"
                variant="outlined"
                disabled={saving}
                onClick={() => { setForm({ ...EMPTY_FORM, transactionDate: defaultDatetimeLocal() }); setLastResult(null); }}
              >
                Vymazat
              </Button>
            </Stack>
          </Box>
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
