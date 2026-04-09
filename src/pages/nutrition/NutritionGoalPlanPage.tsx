import {
  getGoalPlanFindAllQueryKey,
  goalPlanActivate,
  goalPlanCreate,
  goalPlanDeactivate,
  goalPlanFindAll,
  goalPlanUpdate,
} from '@api/goal-plan-controller/goal-plan-controller';
import type { CreateGoalPlanRequestDto } from '@api/model/createGoalPlanRequestDto';
import type { UpdateGoalPlanRequestDto } from '@api/model/updateGoalPlanRequestDto';
import { CreateGoalPlanRequestDtoCarbStrategy } from '@api/model/createGoalPlanRequestDtoCarbStrategy';
import { CreateGoalPlanRequestDtoFatStrategy } from '@api/model/createGoalPlanRequestDtoFatStrategy';
import { CreateGoalPlanRequestDtoGoalType } from '@api/model/createGoalPlanRequestDtoGoalType';
import { CreateGoalPlanRequestDtoProteinStrategy } from '@api/model/createGoalPlanRequestDtoProteinStrategy';
import { CreateGoalPlanRequestDtoStartBodyFatSource } from '@api/model/createGoalPlanRequestDtoStartBodyFatSource';
import type { GoalPlanResponseDto } from '@api/model/goalPlanResponseDto';
import type { NutritionTargetResponseDto } from '@api/model/nutritionTargetResponseDto';
import type { PagedModelGoalPlanResponseDto } from '@api/model/pagedModelGoalPlanResponseDto';
import { PageHeading } from '@components/PageHeading';
import { usePersistStore } from '@components/store/persistStore';
import { useAuth } from '@auth/AuthContext';
import { useNutritionActiveGoalPlanId } from '@hooks/useNutritionActiveGoalPlanId';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/cs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
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

function goalTypeLabel(goalType: string | undefined) {
  if (!goalType) {
    return '—';
  }
  const found = GOAL_TYPE_LABELS.find((o) => o.value === goalType);
  return found?.label ?? goalType;
}

function formatPlanDate(iso: string | undefined) {
  if (!iso) {
    return '—';
  }
  return dayjs(iso).format('D. M. YYYY');
}

function formatPlanDateTime(iso: string | undefined) {
  if (!iso) {
    return '—';
  }
  return dayjs(iso).format('D. M. YYYY HH:mm');
}

function formatKgPlain(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg`;
}

function weeklyLabel(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  const o = WEEKLY_OPTIONS.find((x) => Math.abs(x.value - value) < 0.0001);
  return o ? o.label : `${value.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })} kg/týden`;
}

function planToUpdateForm(plan: GoalPlanResponseDto) {
  return {
    name: plan.name ?? '',
    goalType: (plan.goalType ?? CreateGoalPlanRequestDtoGoalType.FAT_LOSS) as CreateGoalPlanRequestDto['goalType'],
    startDate: plan.startDate ? dayjs(plan.startDate) : dayjs(),
    endDate: plan.endDate ? dayjs(plan.endDate) : null,
    startWeightKg: plan.startWeightKg != null ? String(plan.startWeightKg) : '',
    startBodyFatPercent:
      plan.startBodyFatPercent != null ? String(plan.startBodyFatPercent) : '',
    startBodyFatSource:
      (plan.startBodyFatSource ??
        CreateGoalPlanRequestDtoStartBodyFatSource.MANUAL) as CreateGoalPlanRequestDto['startBodyFatSource'],
    targetWeeklyWeightChangeKg: plan.targetWeeklyWeightChangeKg ?? 0,
    proteinStrategy:
      (plan.proteinStrategy ??
        CreateGoalPlanRequestDtoProteinStrategy.STANDARD) as CreateGoalPlanRequestDto['proteinStrategy'],
    fatStrategy:
      (plan.fatStrategy ?? CreateGoalPlanRequestDtoFatStrategy.STANDARD) as CreateGoalPlanRequestDto['fatStrategy'],
    carbStrategy:
      (plan.carbStrategy ??
        CreateGoalPlanRequestDtoCarbStrategy.REMAINDER) as CreateGoalPlanRequestDto['carbStrategy'],
    notes: plan.notes ?? '',
  };
}

function buildUpdatePayload(form: ReturnType<typeof planToUpdateForm>): UpdateGoalPlanRequestDto {
  const startBf = form.startBodyFatPercent.trim().replace(',', '.');
  const bfNum = startBf === '' ? undefined : Number(startBf);
  const payload: UpdateGoalPlanRequestDto = {
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

function GoalPlanDetailPanel({ plan }: { plan: GoalPlanResponseDto }) {
  const nt = plan.initialNutritionTarget;
  return (
    <Box sx={{ py: 2, px: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Úplný přehled plánu
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
          columnGap: 3,
        }}
      >
        <Typography variant="body2">
          <strong>ID:</strong> {plan.id ?? '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Nutrition profile ID:</strong> {plan.nutritionProfileId ?? '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Start váha:</strong> {formatKgPlain(plan.startWeightKg)}
        </Typography>
        <Typography variant="body2">
          <strong>Start BF %:</strong>{' '}
          {plan.startBodyFatPercent != null && Number.isFinite(plan.startBodyFatPercent)
            ? `${plan.startBodyFatPercent.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} %`
            : '—'}
        </Typography>
        <Typography variant="body2">
          <strong>BF zdroj:</strong> {plan.startBodyFatSource ?? '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Týdenní změna váhy:</strong> {weeklyLabel(plan.targetWeeklyWeightChangeKg)}
        </Typography>
        <Typography variant="body2">
          <strong>Protein strategie:</strong> {plan.proteinStrategy ?? '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Fat strategie:</strong> {plan.fatStrategy ?? '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Carb strategie:</strong> {plan.carbStrategy ?? '—'}
        </Typography>
        <Typography variant="body2" sx={{ gridColumn: { sm: '1 / -1' } }}>
          <strong>Poznámky:</strong> {plan.notes?.trim() ? plan.notes : '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Vytvořeno:</strong> {formatPlanDateTime(plan.createdDate)}
        </Typography>
        <Typography variant="body2">
          <strong>Upraveno:</strong> {formatPlanDateTime(plan.lastModifiedDate)}
        </Typography>
      </Box>
      {nt && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            Počáteční nutrition target (založení)
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2">
              Kalorie: {formatKcal(nt.targetCaloriesKcal)} · TDEE: {formatKcal(nt.baselineTdeeKcal)}
            </Typography>
            <Typography variant="body2">
              P / F / C: {formatG(nt.targetProteinG)} / {formatG(nt.targetFatG)} / {formatG(nt.targetCarbsG)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Platnost: {formatPlanDate(nt.effectiveFrom)}
              {nt.effectiveTo ? ` – ${formatPlanDate(nt.effectiveTo)}` : ''}
            </Typography>
          </Stack>
        </Box>
      )}
    </Box>
  );
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

type GoalPlanEditFormState = ReturnType<typeof planToUpdateForm>;

const GoalPlanEditDialog: FC<{
  open: boolean;
  plan: GoalPlanResponseDto | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (goalPlanId: string, data: UpdateGoalPlanRequestDto) => void;
}> = ({ open, plan, isSubmitting, onClose, onSave }) => {
  const [form, setForm] = useState<GoalPlanEditFormState>(() => planToUpdateForm({} as GoalPlanResponseDto));

  useEffect(() => {
    if (plan) {
      setForm(planToUpdateForm(plan));
    }
  }, [plan]);

  if (!plan?.id) {
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(plan.id!, buildUpdatePayload(form));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Upravit plán</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                  <TextField
                    label="Název"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    fullWidth
                    required
                  />
                  <FormControl fullWidth>
                    <InputLabel id="edit-goal-type-label">Typ cíle</InputLabel>
                    <Select
                      labelId="edit-goal-type-label"
                      label="Typ cíle"
                      value={form.goalType}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          goalType: e.target.value as CreateGoalPlanRequestDto['goalType'],
                        }))
                      }
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
                    value={form.startDate}
                    onChange={(v) => v && setForm((f) => ({ ...f, startDate: v }))}
                    format="DD. MM. YYYY"
                    slotProps={{ textField: { fullWidth: true, required: true } }}
                  />
                  <DatePicker
                    label="End datum (volitelné)"
                    value={form.endDate}
                    onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                    format="DD. MM. YYYY"
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                  <FormControl fullWidth>
                    <InputLabel id="edit-weekly-label">Týdenní změna (kg)</InputLabel>
                    <Select
                      labelId="edit-weekly-label"
                      label="Týdenní změna (kg)"
                      value={form.targetWeeklyWeightChangeKg}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          targetWeeklyWeightChangeKg: Number(e.target.value),
                        }))
                      }
                    >
                      {WEEKLY_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                  <TextField
                    label="Start váha (kg)"
                    type="number"
                    inputProps={{ min: 0.1, step: 0.1 }}
                    value={form.startWeightKg}
                    onChange={(e) => setForm((f) => ({ ...f, startWeightKg: e.target.value }))}
                    fullWidth
                    required
                  />
                  <Tooltip title="Pokud neznáš BF, nech prázdné." placement="top" enterDelay={300}>
                    <TextField
                      label="Start BF % (volitelné)"
                      type="number"
                      inputProps={{ min: 0, max: 100, step: 0.1 }}
                      value={form.startBodyFatPercent}
                      onChange={(e) => setForm((f) => ({ ...f, startBodyFatPercent: e.target.value }))}
                      fullWidth
                    />
                  </Tooltip>
                  <FormControl fullWidth>
                    <InputLabel id="edit-bf-source-label">BF source</InputLabel>
                    <Select
                      labelId="edit-bf-source-label"
                      label="BF source"
                      value={form.startBodyFatSource}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          startBodyFatSource: e.target.value as CreateGoalPlanRequestDto['startBodyFatSource'],
                        }))
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
                    <InputLabel id="edit-protein-label">Protein</InputLabel>
                    <Select
                      labelId="edit-protein-label"
                      label="Protein"
                      value={form.proteinStrategy}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          proteinStrategy: e.target.value as CreateGoalPlanRequestDto['proteinStrategy'],
                        }))
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
                    <InputLabel id="edit-fat-label">Fat</InputLabel>
                    <Select
                      labelId="edit-fat-label"
                      label="Fat"
                      value={form.fatStrategy}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          fatStrategy: e.target.value as CreateGoalPlanRequestDto['fatStrategy'],
                        }))
                      }
                    >
                      <MenuItem value={CreateGoalPlanRequestDtoFatStrategy.STANDARD}>STANDARD — auto</MenuItem>
                      <MenuItem value={CreateGoalPlanRequestDtoFatStrategy.HIGHER}>
                        HIGHER — +3 p. b. tuku
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel id="edit-carb-label">Carbs</InputLabel>
                    <Select
                      labelId="edit-carb-label"
                      label="Carbs"
                      value={form.carbStrategy}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          carbStrategy: e.target.value as CreateGoalPlanRequestDto['carbStrategy'],
                        }))
                      }
                    >
                      <MenuItem value={CreateGoalPlanRequestDtoCarbStrategy.REMAINDER}>
                        REMAINDER — zbytek kalorií po P+F
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
              <TextField
                label="Poznámky (volitelné)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
              />
            </Stack>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Uložit
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export const NutritionGoalPlanPage: FC = () => {
  const { userData } = useAuth();
  const userId = userData?.id ?? '';
  const setNutritionActiveGoalPlan = usePersistStore(userId).setNutritionActiveGoalPlan;
  const queryClient = useQueryClient();

  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const persistedActiveGoalPlanId = useNutritionActiveGoalPlanId(trackerId);
  const { enqueueSnackbar } = useSnackbar();

  const listQuery = useQuery({
    queryKey: trackerId
      ? getGoalPlanFindAllQueryKey(trackerId, { page: 0, size: 100 })
      : ['goalPlanFindAll', 'disabled'],
    enabled: !!trackerId,
    queryFn: async (): Promise<PagedModelGoalPlanResponseDto> => {
      const res = await goalPlanFindAll(trackerId!, { page: 0, size: 100 });
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as PagedModelGoalPlanResponseDto;
    },
  });

  const sortedPlans = useMemo(() => {
    const raw = listQuery.data?.content ?? [];
    return [...raw].sort((a, b) => {
      if (a.active && !b.active) {
        return -1;
      }
      if (!a.active && b.active) {
        return 1;
      }
      return (b.startDate ?? '').localeCompare(a.startDate ?? '');
    });
  }, [listQuery.data?.content]);

  const activateMutation = useMutation({
    mutationFn: async (goalPlanId: string) => {
      const res = await goalPlanActivate(trackerId!, goalPlanId);
      if (res.status >= 400) {
        throw new Error('activate failed');
      }
    },
    onSuccess: async (_, goalPlanId) => {
      await queryClient.invalidateQueries({ queryKey: getGoalPlanFindAllQueryKey(trackerId!) });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
      setNutritionActiveGoalPlan(trackerId!, goalPlanId);
      enqueueSnackbar('Plán je aktivní', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Aktivace plánu selhala', { variant: 'error' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (goalPlanId: string) => {
      const res = await goalPlanDeactivate(trackerId!, goalPlanId);
      if (res.status >= 400) {
        throw new Error('deactivate failed');
      }
    },
    onSuccess: async (_, goalPlanId) => {
      await queryClient.invalidateQueries({ queryKey: getGoalPlanFindAllQueryKey(trackerId!) });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
      if (persistedActiveGoalPlanId === goalPlanId) {
        setNutritionActiveGoalPlan(trackerId!, null);
      }
      setExpandedPlanId((id) => (id === goalPlanId ? null : id));
      enqueueSnackbar('Plán deaktivován', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Deaktivace plánu selhala', { variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { goalPlanId: string; data: UpdateGoalPlanRequestDto }) => {
      const res = await goalPlanUpdate(trackerId!, vars.goalPlanId, vars.data);
      if (res.status >= 400) {
        throw new Error('update failed');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGoalPlanFindAllQueryKey(trackerId!) });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
      setEditingPlan(null);
      enqueueSnackbar('Plán uložen', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Uložení plánu selhalo', { variant: 'error' });
    },
  });

  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<GoalPlanResponseDto | null>(null);

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
      await queryClient.invalidateQueries({ queryKey: getGoalPlanFindAllQueryKey(trackerId) });
      if (plan.id) {
        setNutritionActiveGoalPlan(trackerId, plan.id);
      }
      enqueueSnackbar('Plán byl vytvořen', { variant: 'success' });
    } catch {
      enqueueSnackbar('Založení plánu selhalo', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Cílový plán
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

  const initialTarget: NutritionTargetResponseDto | undefined = createdPlan?.initialNutritionTarget;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
      <Stack spacing={3}>
        <PageHeading component="h1" gutterBottom>
          Cílový plán
        </PageHeading>

        <Box>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Moje plány
          </Typography>
          {listQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : listQuery.isError ? (
            <Typography color="error">Seznam plánů se nepodařilo načíst.</Typography>
          ) : sortedPlans.length === 0 ? (
            <Typography color="text.secondary">Zatím žádný plán — založ ho níže.</Typography>
          ) : (
            <Table size="small" sx={{ maxWidth: 920 }}>
              <TableHead>
                <TableRow>
                  <TableCell width={40} padding="checkbox" />
                  <TableCell>Název</TableCell>
                  <TableCell>Typ</TableCell>
                  <TableCell>Období</TableCell>
                  <TableCell>Stav</TableCell>
                  <TableCell align="right">Akce</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedPlans.map((plan) => {
                  const pid = plan.id;
                  const open = pid != null && expandedPlanId === pid;
                  return (
                    <Fragment key={pid ?? plan.name}>
                      <TableRow
                        hover
                        onClick={() => {
                          if (!pid) {
                            return;
                          }
                          setExpandedPlanId((cur) => (cur === pid ? null : pid));
                        }}
                        sx={{
                          cursor: pid ? 'pointer' : 'default',
                          bgcolor: plan.active ? 'action.selected' : undefined,
                        }}
                      >
                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            aria-label={open ? 'Sbalit' : 'Rozbalit'}
                            disabled={!pid}
                            onClick={() => pid && setExpandedPlanId((cur) => (cur === pid ? null : pid))}
                          >
                            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={plan.active ? 600 : 400}>{plan.name ?? '—'}</Typography>
                        </TableCell>
                        <TableCell>{goalTypeLabel(plan.goalType)}</TableCell>
                        <TableCell>
                          {formatPlanDate(plan.startDate)}
                          {plan.endDate ? ` – ${formatPlanDate(plan.endDate)}` : ''}
                        </TableCell>
                        <TableCell>
                          {plan.active ? (
                            <Chip size="small" color="primary" label="Aktivní" />
                          ) : (
                            <Chip size="small" variant="outlined" label="Neaktivní" />
                          )}
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                            {pid ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setEditingPlan(plan)}
                              >
                                Upravit
                              </Button>
                            ) : null}
                            {pid && plan.active ? (
                              <Button
                                size="small"
                                color="warning"
                                variant="outlined"
                                disabled={deactivateMutation.isPending || activateMutation.isPending}
                                onClick={() => deactivateMutation.mutate(pid)}
                              >
                                Deaktivovat
                              </Button>
                            ) : null}
                            {pid && !plan.active ? (
                              <Button
                                size="small"
                                variant="contained"
                                disabled={activateMutation.isPending || deactivateMutation.isPending}
                                onClick={() => activateMutation.mutate(pid)}
                              >
                                Aktivovat
                              </Button>
                            ) : null}
                          </Stack>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ py: 0, borderBottom: open ? undefined : 0 }} colSpan={6}>
                          <Collapse in={open} timeout="auto" unmountOnExit>
                            {pid ? <GoalPlanDetailPanel plan={plan} /> : null}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Box>

        <GoalPlanEditDialog
          open={editingPlan !== null}
          plan={editingPlan}
          isSubmitting={updateMutation.isPending}
          onClose={() => setEditingPlan(null)}
          onSave={(goalPlanId, data) => updateMutation.mutate({ goalPlanId, data })}
        />

        {phase === 'success' && initialTarget && (
          <Paper
            elevation={0}
            sx={{
              maxWidth: 920,
              p: 3,
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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => {
                    setPhase('form');
                    setCreatedPlan(null);
                  }}
                >
                  Založit další plán
                </Button>
                <Button variant="contained" component={Link} to="/nutrition/dashboard">
                  Přejít na dashboard →
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        {phase === 'success' && !initialTarget && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Plán byl vytvořen, ale doporučení nejsou k dispozici. Zkus to znovu nebo kontaktuj podporu.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="outlined"
                onClick={() => {
                  setPhase('form');
                  setCreatedPlan(null);
                }}
              >
                Založit další plán
              </Button>
              <Button variant="contained" component={Link} to="/nutrition/dashboard">
                Přejít na dashboard →
              </Button>
            </Stack>
          </Paper>
        )}

        {phase === 'form' ? (
          <>
            <Typography variant="subtitle1" fontWeight={600}>
              Nový plán
            </Typography>
            <Paper
          component="form"
          onSubmit={handleSubmit}
          elevation={0}
          sx={{
            maxWidth: 920,
            p: 3,
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
          </>
        ) : null}
      </Stack>
    </LocalizationProvider>
  );
};
