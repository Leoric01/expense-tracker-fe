import { FormControl, FormLabel, Rating, Stack, Typography } from '@mui/material';
import { FC, useId } from 'react';

/** Backend: 0 = nevyplněno, 1–10 = po půlhvězdě na škále 5 hvězd. */
export const HABIT_SCORE_MAX = 10;

export function normalizeHabitScore(score: number | undefined | null): number {
  if (score == null || Number.isNaN(score)) {
    return 0;
  }
  return Math.min(HABIT_SCORE_MAX, Math.max(0, Math.round(score)));
}

/** Hodnota pro MUI Rating (max 5, precision 0.5). */
export function scoreToStarsValue(score: number | undefined | null): number | null {
  const s = normalizeHabitScore(score);
  return s === 0 ? null : s / 2;
}

export function starsValueToScore(value: number | null): number {
  if (value == null || value === 0) {
    return 0;
  }
  return Math.min(HABIT_SCORE_MAX, Math.max(1, Math.round(value * 2)));
}

type HabitScoreRatingRowProps = {
  label: string;
  value: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
};

/** Řádek s 5 hvězdami (poloviční kroky ↔ body 0–10). */
export const HabitScoreRatingRow: FC<HabitScoreRatingRowProps> = ({ label, value, onChange, disabled }) => {
  const readOnly = !onChange;
  const v = normalizeHabitScore(value);
  const ratingId = useId();
  return (
    <FormControl component="fieldset" variant="standard" fullWidth disabled={disabled}>
      <FormLabel component="legend" sx={{ mb: 0.5, fontSize: '0.875rem' }}>
        {label}
      </FormLabel>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <Rating
          name={ratingId}
          value={scoreToStarsValue(v)}
          precision={0.5}
          max={5}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(_, newVal) => onChange?.(starsValueToScore(newVal))}
        />
        <Typography variant="caption" color="text.secondary">
          {v === 0 ? 'Nevyplněno' : `${v}/10`}
        </Typography>
      </Stack>
    </FormControl>
  );
};

type HabitScoreRatingInlineProps = {
  label: string;
  score: number | undefined | null;
};

/** Kompaktní jen čtení (např. karta v agendě). */
export const HabitScoreRatingInline: FC<HabitScoreRatingInlineProps> = ({ label, score }) => {
  const s = normalizeHabitScore(score);
  if (s === 0) {
    return null;
  }
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
      <Typography variant="caption" color="text.secondary" component="span">
        {label}:
      </Typography>
      <Rating value={s / 2} precision={0.5} max={5} readOnly size="small" />
      <Typography variant="caption" color="text.secondary" component="span">
        {s}/10
      </Typography>
    </Stack>
  );
};
