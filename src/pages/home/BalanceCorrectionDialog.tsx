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
import { FormEvent, memo, useEffect, useState } from 'react';
import { AmountTextFieldCs } from './AmountTextFieldCs';
import { DEFAULT_FIAT_SCALE } from '@utils/moneyMinorUnits';
import { formatWalletAmount } from './walletDisplay';
import { defaultDatetimeLocal, formatAmountDisplayCs, parseAmount, toIsoFromDatetimeLocal } from './transactionFormUtils';

export type BalanceCorrectionConfirmPayload = {
  correctedBalanceMajor: number;
  transactionDateIso: string;
  note?: string;
};

type Props = {
  open: boolean;
  wallet?: WalletResponseDto | null;
  /** Odpovídá `Asset.scale` držby (2 = fiat, 8 = BTC). */
  amountMinorUnitScale?: number;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: BalanceCorrectionConfirmPayload) => void | Promise<void>;
  onInvalidAmount: () => void;
  onInvalidDate: () => void;
};

export const BalanceCorrectionDialog = memo(function BalanceCorrectionDialog({
  open,
  wallet,
  amountMinorUnitScale = DEFAULT_FIAT_SCALE,
  submitting,
  onClose,
  onConfirm,
  onInvalidAmount,
  onInvalidDate,
}: Props) {
  const [amountCanonical, setAmountCanonical] = useState('');
  const [when, setWhen] = useState(defaultDatetimeLocal);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setAmountCanonical('');
      setWhen(defaultDatetimeLocal());
      setNote('');
    }
  }, [open]);

  const amountDisplay = formatAmountDisplayCs(amountCanonical);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const bal = parseAmount(amountDisplay);
    if (bal == null) {
      onInvalidAmount();
      return;
    }
    const iso = toIsoFromDatetimeLocal(when);
    if (!iso) {
      onInvalidDate();
      return;
    }
    await onConfirm({
      correctedBalanceMajor: bal,
      transactionDateIso: iso,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Korekce zůstatku (inventura)</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Peněženka: <strong>{wallet?.name ?? '—'}</strong>
              {wallet?.currencyCode ? ` · ${wallet.currencyCode}` : ''}
            </Typography>
            <Typography variant="body2">
              Účetní zůstatek:{' '}
              <strong>
                {formatWalletAmount(wallet?.currentBalance, wallet?.currencyCode, amountMinorUnitScale)}
              </strong>
            </Typography>
            <Alert severity="info" variant="outlined">
              Zadej skutečný zůstatek podle reality; rozdíl vůči systému dopočítá server.
            </Alert>
            <AmountTextFieldCs
              label="Skutečný zůstatek po inventuře"
              canonical={amountCanonical}
              setCanonical={setAmountCanonical}
              required
              fullWidth
              placeholder="0"
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
            />
            <TextField label="Poznámka (volitelné)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} disabled={submitting}>
            Zrušit
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            Uložit korekci
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
});
