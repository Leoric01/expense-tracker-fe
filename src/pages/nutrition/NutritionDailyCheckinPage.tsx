import { dailyBodyMeasurementLogFindByDate } from '@api/daily-body-measurement-log-controller/daily-body-measurement-log-controller';
import { dailyNutritionLogFindByDate } from '@api/daily-nutrition-log-controller/daily-nutrition-log-controller';
import { dailyCheckinUpsert } from '@api/daily-checkin-controller/daily-checkin-controller';
import { getNutritionProfileFindUrl } from '@api/nutrition-profile-controller/nutrition-profile-controller';
import { nutritionTargetFindCurrent } from '@api/nutrition-target-controller/nutrition-target-controller';
import type { DailyBodyMeasurementLogResponseDto } from '@api/model/dailyBodyMeasurementLogResponseDto';
import type { DailyCheckinResponseDto } from '@api/model/dailyCheckinResponseDto';
import type { DailyNutritionLogResponseDto } from '@api/model/dailyNutritionLogResponseDto';
import type { NutritionProfileResponseDto } from '@api/model/nutritionProfileResponseDto';
import { NutritionProfileResponseDtoBiologicalSex } from '@api/model/nutritionProfileResponseDtoBiologicalSex';
import type { NutritionTargetResponseDto } from '@api/model/nutritionTargetResponseDto';
import type { UpsertDailyCheckinRequestDto } from '@api/model/upsertDailyCheckinRequestDto';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/cs';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

function parseNum(s: string): number | undefined {
  const t = s.trim().replace(',', '.');
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function formatKcal(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${Math.round(n).toLocaleString('cs-CZ')} kcal`;
}

function formatG(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${Math.round(n).toLocaleString('cs-CZ')} g`;
}

export const NutritionDailyCheckinPage: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  const [logDate, setLogDate] = useState<Dayjs>(() => dayjs());
  const logDateStr = useMemo(() => logDate.format('YYYY-MM-DD'), [logDate]);

  const [weightKg, setWeightKg] = useState('');
  const [caloriesKcal, setCaloriesKcal] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [notes, setNotes] = useState('');
  const [includeCircumference, setIncludeCircumference] = useState(false);
  const [waistCm, setWaistCm] = useState('');
  const [neckCm, setNeckCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [responseBfPercent, setResponseBfPercent] = useState<number | null>(null);

  const profileQuery = useQuery({
    queryKey: ['nutritionProfile', trackerId],
    enabled: !!trackerId,
    queryFn: async (): Promise<NutritionProfileResponseDto | null> => {
      const res = await fetch(getNutritionProfileFindUrl(trackerId!));
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as NutritionProfileResponseDto;
    },
  });

  const targetQuery = useQuery({
    queryKey: ['nutritionTargetCurrent', trackerId],
    enabled: !!trackerId,
    queryFn: async (): Promise<NutritionTargetResponseDto | null> => {
      const res = await nutritionTargetFindCurrent(trackerId!);
      if ((res.status as number) === 404) {
        return null;
      }
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as NutritionTargetResponseDto;
    },
  });

  const nutritionByDateQuery = useQuery({
    queryKey: ['dailyNutritionLogByDate', trackerId, logDateStr],
    enabled: !!trackerId,
    queryFn: async (): Promise<DailyNutritionLogResponseDto | null> => {
      const res = await dailyNutritionLogFindByDate(trackerId!, logDateStr);
      if ((res.status as number) === 404) {
        return null;
      }
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as DailyNutritionLogResponseDto;
    },
  });

  const bodyByDateQuery = useQuery({
    queryKey: ['dailyBodyMeasurementByDate', trackerId, logDateStr],
    enabled: !!trackerId,
    queryFn: async (): Promise<DailyBodyMeasurementLogResponseDto | null> => {
      const res = await dailyBodyMeasurementLogFindByDate(trackerId!, logDateStr);
      if ((res.status as number) === 404) {
        return null;
      }
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as DailyBodyMeasurementLogResponseDto;
    },
  });

  const showHip =
    profileQuery.data?.biologicalSex === NutritionProfileResponseDtoBiologicalSex.FEMALE;

  const prefetchLoading = nutritionByDateQuery.isFetching || bodyByDateQuery.isFetching;

  useEffect(() => {
    setResponseBfPercent(null);
  }, [logDateStr]);

  useEffect(() => {
    if (!nutritionByDateQuery.isSuccess || !bodyByDateQuery.isSuccess) {
      return;
    }
    const n = nutritionByDateQuery.data;
    const b = bodyByDateQuery.data;

    setWeightKg(n?.weightKg != null ? String(n.weightKg) : '');
    setCaloriesKcal(n?.caloriesKcal != null ? String(Math.round(n.caloriesKcal)) : '');
    setProteinG(n?.proteinG != null ? String(n.proteinG) : '');
    setFatG(n?.fatG != null ? String(n.fatG) : '');
    setCarbsG(n?.carbsG != null ? String(n.carbsG) : '');
    setNotes(n?.notes ?? '');

    const hasBody =
      b != null && (b.waistCm != null || b.neckCm != null || b.hipCm != null);
    setIncludeCircumference(!!hasBody);
    setWaistCm(b?.waistCm != null ? String(b.waistCm) : '');
    setNeckCm(b?.neckCm != null ? String(b.neckCm) : '');
    setHipCm(b?.hipCm != null ? String(b.hipCm) : '');
  }, [
    nutritionByDateQuery.isSuccess,
    nutritionByDateQuery.data,
    bodyByDateQuery.isSuccess,
    bodyByDateQuery.data,
    logDateStr,
  ]);

  const target = targetQuery.data;
  const enteredCalories = parseNum(caloriesKcal);
  const calorieRemaining =
    target?.targetCaloriesKcal != null && enteredCalories != null
      ? target.targetCaloriesKcal - enteredCalories
      : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trackerId) {
      return;
    }
    const w = parseNum(weightKg);
    const cal = parseNum(caloriesKcal);
    if (w === undefined || cal === undefined) {
      enqueueSnackbar('Vyplň váhu a kalorie', { variant: 'warning' });
      return;
    }

    const p = parseNum(proteinG);
    const f = parseNum(fatG);
    const c = parseNum(carbsG);

    const payload: Record<string, unknown> = {
      logDate: logDateStr,
      weightKg: w,
      caloriesKcal: cal,
      notes: notes.trim() === '' ? null : notes.trim(),
    };
    if (p !== undefined) {
      payload.proteinG = p;
    }
    if (f !== undefined) {
      payload.fatG = f;
    }
    if (c !== undefined) {
      payload.carbsG = c;
    }

    if (!includeCircumference) {
      payload.waistCm = null;
      payload.neckCm = null;
      payload.hipCm = null;
    } else {
      payload.waistCm = parseNum(waistCm) ?? null;
      payload.neckCm = parseNum(neckCm) ?? null;
      payload.hipCm = showHip ? parseNum(hipCm) ?? null : null;
    }

    setSubmitting(true);
    try {
      const res = await dailyCheckinUpsert(trackerId, payload as UpsertDailyCheckinRequestDto);
      if (res.status >= 400) {
        enqueueSnackbar('Uložení check-inu selhalo', { variant: 'error' });
        return;
      }
      const body = res.data as unknown as DailyCheckinResponseDto;
      const bf = body.bodyMeasurementLog?.calculatedBodyFatPercent;
      setResponseBfPercent(bf != null && Number.isFinite(bf) ? bf : null);
      enqueueSnackbar('Check-in uložen', { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['dailyNutritionLogByDate', trackerId, logDateStr] });
      await queryClient.invalidateQueries({ queryKey: ['dailyBodyMeasurementByDate', trackerId, logDateStr] });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
    } catch {
      enqueueSnackbar('Uložení check-inu selhalo', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Denní check-in
        </PageHeading>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nejprve vyber rozpočet (tracker).
        </Typography>
        <Button component={Link} to="/trackers" variant="contained">
          Otevřít trackery
        </Button>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
      <Box component="form" onSubmit={handleSubmit}>
        <PageHeading component="h1" gutterBottom>
          Denní check-in
        </PageHeading>

        <Paper
          elevation={0}
          sx={{
            maxWidth: 720,
            p: 3,
            mt: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DatePicker
                label="Datum"
                value={logDate}
                onChange={(v) => v && setLogDate(v)}
                format="DD. MM. YYYY"
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>

            {prefetchLoading && (
              <Grid size={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Načítám záznam pro vybraný den…
                  </Typography>
                </Box>
              </Grid>
            )}

            <Grid size={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Váha & výživa
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Váha (kg)"
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                fullWidth
                size="small"
                required
                disabled={prefetchLoading}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Kalorie (kcal)"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={caloriesKcal}
                onChange={(e) => setCaloriesKcal(e.target.value)}
                fullWidth
                size="small"
                required
                disabled={prefetchLoading}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Protein (g)"
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
                fullWidth
                size="small"
                disabled={prefetchLoading}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Fat (g)"
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={fatG}
                onChange={(e) => setFatG(e.target.value)}
                fullWidth
                size="small"
                disabled={prefetchLoading}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Carbs (g)"
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={carbsG}
                onChange={(e) => setCarbsG(e.target.value)}
                fullWidth
                size="small"
                disabled={prefetchLoading}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Poznámky (volitelné)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={2}
                disabled={prefetchLoading}
              />
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 0.5 }}>
                Tělesné obvody (volitelné)
              </Typography>
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeCircumference}
                    onChange={(e) => setIncludeCircumference(e.target.checked)}
                    disabled={prefetchLoading}
                    size="small"
                  />
                }
                label="Chci dnes zadat obvody"
              />
            </Grid>
            <Grid size={12}>
              <Collapse in={includeCircumference}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Pas (cm)"
                      type="number"
                      inputProps={{ min: 0, step: 0.1 }}
                      value={waistCm}
                      onChange={(e) => setWaistCm(e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Krk (cm)"
                      type="number"
                      inputProps={{ min: 0, step: 0.1 }}
                      value={neckCm}
                      onChange={(e) => setNeckCm(e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  {showHip ? (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Boky (cm)"
                        type="number"
                        inputProps={{ min: 0, step: 0.1 }}
                        value={hipCm}
                        onChange={(e) => setHipCm(e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                  ) : null}
                </Grid>
              </Collapse>
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 0.5 }}>
                Aktuální target (pouze čtení)
              </Typography>
            </Grid>
            <Grid size={12}>
              {targetQuery.isLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Načítám target…
                </Typography>
              ) : !target ? (
                <Typography variant="body2" color="text.secondary">
                  Žádný aktivní target — založ cílový plán.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="body2">
                    Kalorie: <strong>{formatKcal(target.targetCaloriesKcal)}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Protein: {formatG(target.targetProteinG)} | Fat: {formatG(target.targetFatG)} | Carbs:{' '}
                    {formatG(target.targetCarbsG)}
                  </Typography>
                  {enteredCalories != null && target.targetCaloriesKcal != null && (
                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2">
                        Zbývá:{' '}
                        <strong>
                          {calorieRemaining != null
                            ? `${Math.round(calorieRemaining).toLocaleString('cs-CZ')} kcal`
                            : '—'}
                        </strong>
                      </Typography>
                      {calorieRemaining != null && calorieRemaining < 0 && (
                        <WarningAmberRoundedIcon color="warning" fontSize="small" sx={{ ml: 0.5 }} />
                      )}
                    </Stack>
                  )}
                </Stack>
              )}
            </Grid>

            {responseBfPercent != null && (
              <Grid size={12}>
                <Typography variant="body2" color="success.main">
                  BF% (vypočteno): {responseBfPercent.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %
                </Typography>
              </Grid>
            )}

            <Grid size={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
                <Button type="submit" variant="contained" disabled={submitting || prefetchLoading}>
                  Uložit check-in
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};
