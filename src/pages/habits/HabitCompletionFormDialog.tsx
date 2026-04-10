import { HabitCompletionUpsertRequestDtoStatus } from '@api/model/habitCompletionUpsertRequestDtoStatus';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FC } from 'react';
import type { HabitCompletionDialogStatus } from './habitCompletionMappers';
import { HabitScoreRatingRow } from './HabitScoreRating';

export type { HabitCompletionDialogStatus } from './habitCompletionMappers';

type HabitCompletionFormDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Volitelný řádek pod nadpisem (např. čas dokončení). */
  completedAtCaption?: string | null;
  status: HabitCompletionDialogStatus;
  onStatusChange: (status: HabitCompletionDialogStatus) => void;
  note: string;
  onNoteChange: (note: string) => void;
  satisfactionScore: number;
  onSatisfactionScoreChange: (v: number) => void;
  executionScore: number;
  onExecutionScoreChange: (v: number) => void;
  actualPrice: string;
  onActualPriceChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
};

export const HabitCompletionFormDialog: FC<HabitCompletionFormDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  completedAtCaption,
  status,
  onStatusChange,
  note,
  onNoteChange,
  satisfactionScore,
  onSatisfactionScoreChange,
  executionScore,
  onExecutionScoreChange,
  actualPrice,
  onActualPriceChange,
  onSubmit,
  submitting,
}) => {
  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>
        {title}
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
            {subtitle}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {completedAtCaption ? (
            <Typography variant="caption" color="text.secondary">
              {completedAtCaption}
            </Typography>
          ) : null}
          <FormControl component="fieldset" variant="standard">
            <FormLabel component="legend" sx={{ mb: 1 }}>
              Stav
            </FormLabel>
            <RadioGroup
              value={status}
              onChange={(e) => onStatusChange(e.target.value as HabitCompletionDialogStatus)}
            >
              <FormControlLabel
                value={HabitCompletionUpsertRequestDtoStatus.DONE}
                control={<Radio disabled={submitting} />}
                label="Hotovo"
              />
              <FormControlLabel
                value={HabitCompletionUpsertRequestDtoStatus.PARTIALLY_COMPLETED}
                control={<Radio disabled={submitting} />}
                label="Částečně splněno"
              />
              <FormControlLabel
                value={HabitCompletionUpsertRequestDtoStatus.SKIPPED}
                control={<Radio disabled={submitting} />}
                label="Přeskočeno"
              />
              <FormControlLabel
                value={HabitCompletionUpsertRequestDtoStatus.MISSED}
                control={<Radio disabled={submitting} />}
                label="Zmeškaný"
              />
            </RadioGroup>
          </FormControl>
          <HabitScoreRatingRow
            label="Spokojenost se splněním"
            value={satisfactionScore}
            onChange={onSatisfactionScoreChange}
            disabled={submitting}
          />
          <HabitScoreRatingRow
            label="Hodnocení provedení"
            value={executionScore}
            onChange={onExecutionScoreChange}
            disabled={submitting}
          />
          <TextField
            label="Skutečná cena (Kč, volitelné)"
            value={actualPrice}
            onChange={(e) => onActualPriceChange(e.target.value)}
            type="text"
            inputMode="decimal"
            fullWidth
            disabled={submitting}
            placeholder="Nevyplněno"
          />
          <TextField
            label="Poznámka (volitelná)"
            placeholder="Bez poznámky odešli prázdné pole"
            fullWidth
            multiline
            minRows={3}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            disabled={submitting}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Zrušit
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitting}>
          Uložit
        </Button>
      </DialogActions>
    </Dialog>
  );
};
