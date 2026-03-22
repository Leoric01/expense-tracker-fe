import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { WalletResponseDto } from '@api/model';
import { FormEvent, memo, useCallback, useEffect, useState } from 'react';
import {
  canonicalAmountFromUserInput,
  defaultDatetimeLocal,
  formatAmountDisplayCs,
  parseAmount,
  toIsoFromDatetimeLocal,
} from './transactionFormUtils';

export type TransferConfirmPayload = {
  amountMajor: number;
  transactionDateIso: string;
  description?: string;
};

type Props = {
  open: boolean;
  sourceWallet?: WalletResponseDto;
  targetWallet?: WalletResponseDto;
  transferCurrenciesOk: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: TransferConfirmPayload) => void | Promise<void>;
  onInvalidAmount: () => void;
  onInvalidDate: () => void;
};

export const TransferBetweenWalletsDialog = memo(function TransferBetweenWalletsDialog({
  open,
  sourceWallet,
  targetWallet,
  transferCurrenciesOk,
  submitting,
  onClose,
  onConfirm,
  onInvalidAmount,
  onInvalidDate,
}: Props) {
  const [amountCanonical, setAmountCanonical] = useState('');
  const [when, setWhen] = useState(defaultDatetimeLocal);
  const [desc, setDesc] = useState('');

  useEffect(() => {
    if (open) {
      setAmountCanonical('');
      setWhen(defaultDatetimeLocal());
      setDesc('');
    }
  }, [open]);

  const amountDisplay = formatAmountDisplayCs(amountCanonical);

  const onAmountChange = useCallback((raw: string) => {
    setAmountCanonical(canonicalAmountFromUserInput(raw));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferCurrenciesOk) return;
    const amountMajor = parseAmount(amountDisplay);
    if (amountMajor == null || amountMajor <= 0) {
      onInvalidAmount();
      return;
    }
    const iso = toIsoFromDatetimeLocal(when);
    if (!iso) {
      onInvalidDate();
      return;
    }
    await onConfirm({
      amountMajor,
      transactionDateIso: iso,
      ...(desc.trim() ? { description: desc.trim() } : {}),
    });
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Převod mezi peněženkami</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
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
              value={amountDisplay}
              onChange={(e) => onAmountChange(e.target.value)}
              required
              inputMode="decimal"
              disabled={!transferCurrenciesOk}
              fullWidth
              autoComplete="off"
              placeholder="0"
              helperText="Číslice a desetinná čárka; tisíce se oddělí mezerou"
            />
            <TextField
              label="Datum a čas"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              placeholder="dd.MM.yyyy HH:mm"
              helperText="Formát dd.MM.yyyy HH:mm"
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
              disabled={!transferCurrenciesOk}
            />
            <TextField
              label="Popis (volitelné)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              fullWidth
              disabled={!transferCurrenciesOk}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} disabled={submitting}>
            Zrušit
          </Button>
          <Button type="submit" variant="contained" disabled={submitting || !transferCurrenciesOk}>
            Provést převod
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
});
