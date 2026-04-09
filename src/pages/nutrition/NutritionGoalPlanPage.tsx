import { goalPlanCreate } from '@api/goal-plan-controller/goal-plan-controller';
import type { CreateGoalPlanRequestDto } from '@api/model/createGoalPlanRequestDto';
import { CreateGoalPlanRequestDtoCarbStrategy } from '@api/model/createGoalPlanRequestDtoCarbStrategy';
import { CreateGoalPlanRequestDtoFatStrategy } from '@api/model/createGoalPlanRequestDtoFatStrategy';
import { CreateGoalPlanRequestDtoGoalType } from '@api/model/createGoalPlanRequestDtoGoalType';
import { CreateGoalPlanRequestDtoProteinStrategy } from '@api/model/createGoalPlanRequestDtoProteinStrategy';
import { CreateGoalPlanRequestDtoStartBodyFatSource } from '@api/model/createGoalPlanRequestDtoStartBodyFatSource';
import type { GoalPlanResponseDto } from '@api/model/goalPlanResponseDto';
import type { NutritionTargetResponseDto } from '@api/model/nutritionTargetResponseDto';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/cs';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const GOAL_TYPE_LABELS: { value: CreateGoalPlanRequestDto['goalType']; label: string }[] = [
  { value: CreateGoalPlanRequestDtoGoalType.FAT_LOSS, label: 'Hubnutí' },
  { value: CreateGoalPlanRequestDtoGoalType.MAINTENANCE, label: 'Udržování' },
  { value: CreateGoalPlanRequestDtoGoalType.MUSCLE_GAIN, label: 'Nabírání' },
  { value: CreateGoalPlanRequestDtoGoalType.CUSTOM, label: 'Vlastní' },
];

const WEEKLY_OPTIONS: { value: number; label: string }[] = [
  { value: -0.75, label: '−0,750 kg/týden — Agresivní cut' },
  { value: -0.5, label: '−0,500 kg/týden — Standardní cut' },
  { value: -0.25, label: '−0,250 kg/týden — Mírný cut' },
  { value: 0, label: '0 kg/týden — Maintenance' },
  { value: 0.25, label: '+0,250 kg/týden — Lean bulk' },
  { value: 0.5, label: '+0,500 kg/týden — Standardní bulk' },
];

function defaultWeeklyForGoal(goalType: CreateGoalPlanRequestDto['goalType']): number {
  switch (goalType) {
    case CreateGoalPlanRequestDtoGoalType.FAT_LOSS:
      return -0.5;
    case CreateGoalPlanRequestDtoGoalType.MAINTENANCE:
      return 0;
    case CreateGoalPlanRequestDtoGoalType.MUSCLE_GAIN:
      return 0.25;
    default:
      return 0;
  }
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

function buildCreatePayload(form: {
  name: string;
  goalType: CreateGoalPlanRequestDto['goalType'];
  startDate: Dayjs | null;
  endDate: Dayjs | null;
  startWeightKg: string;
  startBodyFatPercent: string;
  startBodyFatSource: CreateGoalPlanRequestDto['startBodyFatSource'];
  targetWeeklyWeightChangeKg: number;
  proteinStrategy: CreateGoalPlanRequestDto['proteinStrategy'];
  fatStrategy: CreateGoalPlanRequestDto['fatStrategy'];
  carbStrategy: CreateGoalPlanRequestDto['carbStrategy'];
  notes: string;
}): CreateGoalPlanRequestDto {
  const startBf = form.startBodyFatPercent.trim().replace(',', '.');
  const bfNum = startBf === '' ? undefined : Number(startBf);
  const payload: CreateGoalPlanRequestDto = {
    name: form.name.trim(),
    goalType: form.goalType,
    startDate: form.startDate?.format('YYYY-MM-DD'),
    startWeightKg: Number(form.startWeightKg.replace(',', '.')),
    startBodyFatSource: form.startBodyFatSource,
    targetWeeklyWeightChangeKg: form.targetWeeklyWeightChangeKg,
    proteinStrategy: form.proteinStrategy,
    fatStrategy: form.fatStrategy,
    carbStrategy: form.carbStrategy,
  };
  const trimmedNotes = form.notes.trim();
  if (trimmedNotes) {
    payload.notes = trimmedNotes;
  }
  if (form.endDate) {
    payload.endDate = form.endDate.format('YYYY-MM-DD');
  }
  if (bfNum !== undefined && Number.isFinite(bfNum)) {
    payload.startBodyFatPercent = bfNum;
  }
  return payload;
}

export const NutritionGoalPlanPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const { enqueueSnackbar } = useSnackbar();

  const [phase, setPhase] = useState<'form' | 'success'>('form');
  const [createdPlan, setCreatedPlan] = useState<GoalPlanResponseDto | null>(null);

  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<CreateGoalPlanRequestDto['goalType']>(
    CreateGoalPlanRequestDtoGoalType.FAT_LOSS,
  );
  const [startDate, setStartDate] = useState<Dayjs | null>(() => dayjs());
  const [endDate, setEndDate] = useState<Dayjs | null>(() => dayjs().add(3, 'month'));
  const [startWeightKg, setStartWeightKg] = useState('80');
  const [startBodyFatPercent, setStartBodyFatPercent] = useState('');
  const [startBodyFatSource, setStartBodyFatSource] = useState<
    CreateGoalPlanRequestDto['startBodyFatSource']
  >(CreateGoalPlanRequestDtoStartBodyFatSource.MANUAL);
  const [targetWeeklyWeightChangeKg, setTargetWeeklyWeightChangeKg] = useState(-0.5);
  const [proteinStrategy, setProteinStrategy] = useState<CreateGoalPlanRequestDto['proteinStrategy']>(
    CreateGoalPlanRequestDtoProteinStrategy.STANDARD,
  );
  const [fatStrategy, setFatStrategy] = useState<CreateGoalPlanRequestDto['fatStrategy']>(
    CreateGoalPlanRequestDtoFatStrategy.STANDARD,
  );
  const [carbStrategy] = useState<CreateGoalPlanRequestDto['carbStrategy']>(
    CreateGoalPlanRequestDtoCarbStrategy.REMAINDER,
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTargetWeeklyWeightChangeKg(defaultWeeklyForGoal(goalType));
  }, [goalType]);

  const handleGoalTypeChange = (e: SelectChangeEvent<CreateGoalPlanRequestDto['goalType']>) => {
    setGoalType(e.target.value as CreateGoalPlanRequestDto['goalType']);
  };

  const handleWeeklyChange = (e: SelectChangeEvent<string | number>) => {
    setTargetWeeklyWeightChangeKg(Number(e.target.value));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trackerId) {
      return;
    }
    if (!name.trim()) {
      enqueueSnackbar('Vyplň název plánu', { variant: 'warning' });
      return;
    }
    if (!startDate) {
      enqueueSnackbar('Vyber datum začátku', { variant: 'warning' });
      return;
    }
    const w = Number(startWeightKg.replace(',', '.'));
    if (!Number.isFinite(w) || w <= 0) {
      enqueueSnackbar('Zadej platnou startovní váhu (kg)', { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const data = buildCreatePayload({
        name,
        goalType,
        startDate,
        endDate,
        startWeightKg,
        startBodyFatPercent,
        startBodyFatSource,
        targetWeeklyWeightChangeKg,
        proteinStrategy,
        fatStrategy,
        carbStrategy,
        notes,
      });

      const res = await goalPlanCreate(trackerId, data);
      if (res.status !== 200 && res.status !== 201) {
        enqueueSnackbar('Založení plánu selhalo', { variant: 'error' });
        return;
      }
      const plan = res.data as unknown as GoalPlanResponseDto;
      setCreatedPlan(plan);
      setPhase('success');
      enqueueSnackbar('Plán byl vytvořen', { variant: 'success' });
    } catch {
      enqueueSnackbar('Založení plánu selhalo', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const initialTarget: NutritionTargetResponseDto | undefined = createdPlan?.initialNutritionTarget;

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Nový plán
        </PageHeading>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nejprve vyber rozpočet (tracker) v menu u položky Trackery.
        </Typography>
        <Button component={Link} to="/trackers" variant="contained">
          Otevřít trackery
        </Button>
      </Box>
    );
  }

  if (phase === 'success' && initialTarget) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Nový plán
        </PageHeading>
        <Paper
          elevation={0}
          sx={{
            maxWidth: 920,
            p: 3,
            mt: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <CheckCircleOutlineIcon color="success" sx={{ mt: 0.25 }} />
              <Typography fontWeight={600}>Plán vytvořen! Tvoje doporučení:</Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                columnGap: 4,
                rowGap: 1.5,
                pl: { xs: 0, sm: 4 },
              }}
            >
              <Stack spacing={1}>
                <Typography>
                  Denní kalorie: <strong>{formatKcal(initialTarget.targetCaloriesKcal)}</strong>
                </Typography>
                <Typography color="text.secondary">
                  Baseline TDEE: {formatKcal(initialTarget.baselineTdeeKcal)}
                </Typography>
              </Stack>
              <Stack spacing={1}>
                <Typography>
                  Protein: <strong>{formatG(initialTarget.targetProteinG)}</strong>
                </Typography>
                <Typography>
                  Fat: <strong>{formatG(initialTarget.targetFatG)}</strong>
                </Typography>
                <Typography>
                  Carbs: <strong>{formatG(initialTarget.targetCarbsG)}</strong>
                </Typography>
              </Stack>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
              <Button variant="contained" component={Link} to="/nutrition/dashboard">
                Přejít na dashboard →
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (phase === 'success' && !initialTarget) {
    return (
      <Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Plán byl vytvořen, ale doporučení nejsou k dispozici. Zkus to znovu nebo kontaktuj podporu.
        </Typography>
        <Button variant="contained" component={Link} to="/nutrition/dashboard">
          Přejít na dashboard →
        </Button>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
      <Box>
        <PageHeading component="h1" gutterBottom>
          Nový plán
        </PageHeading>

        <Paper
          component="form"
          onSubmit={handleSubmit}
          elevation={0}
          sx={{
            maxWidth: 920,
            p: 3,
            mt: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2.5}
              alignItems="stretch"
              useFlexGap
            >
              <Stack spacing={2.5} sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  label="Název"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  required
                  placeholder="Jarní cut 2026"
                />

                <FormControl fullWidth>
                  <InputLabel id="goal-type-label">Typ cíle</InputLabel>
                  <Select
                    labelId="goal-type-label"
                    label="Typ cíle"
                    value={goalType}
                    onChange={handleGoalTypeChange}
                  >
                    {GOAL_TYPE_LABELS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <DatePicker
                  label="Start datum"
                  value={startDate}
                  onChange={(v) => setStartDate(v)}
                  format="DD. MM. YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />

                <DatePicker
                  label="End datum (volitelné)"
                  value={endDate}
                  onChange={(v) => setEndDate(v)}
                  format="DD. MM. YYYY"
                  slotProps={{ textField: { fullWidth: true } }}
                />

                <FormControl fullWidth>
                  <InputLabel id="weekly-label">Týdenní změna (kg)</InputLabel>
                  <Select
                    labelId="weekly-label"
                    label="Týdenní změna (kg)"
                    value={targetWeeklyWeightChangeKg}
                    onChange={handleWeeklyChange}
                  >
                    {WEEKLY_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack spacing={2.5} sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  label="Start váha (kg)"
                  type="number"
                  inputProps={{ min: 0.1, step: 0.1 }}
                  value={startWeightKg}
                  onChange={(e) => setStartWeightKg(e.target.value)}
                  fullWidth
                  required
                />

                <Tooltip title="Pokud neznáš BF, nech prázdné." placement="top" enterDelay={300}>
                  <TextField
                    label="Start BF % (volitelné)"
                    type="number"
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                    value={startBodyFatPercent}
                    onChange={(e) => setStartBodyFatPercent(e.target.value)}
                    fullWidth
                  />
                </Tooltip>

                <FormControl fullWidth>
                  <InputLabel id="bf-source-label">BF source</InputLabel>
                  <Select
                    labelId="bf-source-label"
                    label="BF source"
                    value={startBodyFatSource}
                    onChange={(e) =>
                      setStartBodyFatSource(e.target.value as CreateGoalPlanRequestDto['startBodyFatSource'])
                    }
                  >
                    <MenuItem value={CreateGoalPlanRequestDtoStartBodyFatSource.MANUAL}>
                      MANUAL — ruční zadání
                    </MenuItem>
                    <MenuItem value={CreateGoalPlanRequestDtoStartBodyFatSource.CIRCUMFERENCE}>
                      CIRCUMFERENCE — z obvodů
                    </MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="protein-label">Protein</InputLabel>
                  <Select
                    labelId="protein-label"
                    label="Protein"
                    value={proteinStrategy}
                    onChange={(e) =>
                      setProteinStrategy(e.target.value as CreateGoalPlanRequestDto['proteinStrategy'])
                    }
                  >
                    <MenuItem value={CreateGoalPlanRequestDtoProteinStrategy.STANDARD}>
                      STANDARD — auto dle BF%
                    </MenuItem>
                    <MenuItem value={CreateGoalPlanRequestDtoProteinStrategy.HIGH}>
                      HIGH — +10 % oproti standardu
                    </MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="fat-label">Fat</InputLabel>
                  <Select
                    labelId="fat-label"
                    label="Fat"
                    value={fatStrategy}
                    onChange={(e) =>
                      setFatStrategy(e.target.value as CreateGoalPlanRequestDto['fatStrategy'])
                    }
                  >
                    <MenuItem value={CreateGoalPlanRequestDtoFatStrategy.STANDARD}>STANDARD — auto</MenuItem>
                    <MenuItem value={CreateGoalPlanRequestDtoFatStrategy.HIGHER}>
                      HIGHER — +3 p. b. tuku
                    </MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="carb-label">Carbs</InputLabel>
                  <Select labelId="carb-label" label="Carbs" value={carbStrategy} disabled>
                    <MenuItem value={CreateGoalPlanRequestDtoCarbStrategy.REMAINDER}>
                      REMAINDER — zbytek kalorií po P+F
                    </MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>

            <TextField
              label="Poznámky (volitelné)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
              <Button type="submit" variant="contained" disabled={submitting}>
                Založit plán
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};
