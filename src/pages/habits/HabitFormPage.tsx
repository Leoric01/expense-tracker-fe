import {
  habitCreate,
  habitFindById,
  habitUpdate,
  getHabitFindByIdQueryKey,
} from '@api/habit-controller/habit-controller';
import type { HabitResponseDto } from '@api/model/habitResponseDto';
import type { HabitUpsertRequestDto } from '@api/model/habitUpsertRequestDto';
import { HabitUpsertRequestDtoHabitType } from '@api/model/habitUpsertRequestDtoHabitType';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/cs';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HabitScheduleMatrix } from './HabitScheduleMatrix';
import { parseOptionalMoneyKc } from './habitMoneyParse';
import { HabitScoreRatingRow, normalizeHabitScore } from './HabitScoreRating';
import {
  HABIT_TYPE_OPTIONS,
  keySetToScheduleSlots,
  slotsToKeySet,
} from './habitUiConstants';

function buildUpsertBody(args: {
  name: string;
  description: string;
  habitType: (typeof HabitUpsertRequestDtoHabitType)[keyof typeof HabitUpsertRequestDtoHabitType];
  expectedMinutes: number;
  validFrom: Dayjs;
  validTo: Dayjs | null;
  active: boolean;
  sortOrder: number;
  scheduleKeys: Set<string>;
  satisfactionScore: number;
  utilityScore: number;
  estimatedPrice: string;
}): HabitUpsertRequestDto {
  const scheduleSlots = keySetToScheduleSlots(args.scheduleKeys);
  const est = parseOptionalMoneyKc(args.estimatedPrice);
  return {
    name: args.name.trim(),
    description: args.description.trim() || undefined,
    habitType: args.habitType,
    expectedMinutes: args.expectedMinutes,
    validFrom: args.validFrom.format('YYYY-MM-DD'),
    validTo: args.validTo ? args.validTo.format('YYYY-MM-DD') : (null as unknown as string),
    active: args.active,
    sortOrder: args.sortOrder,
    satisfactionScore: normalizeHabitScore(args.satisfactionScore),
    utilityScore: normalizeHabitScore(args.utilityScore),
    ...(est != null ? { estimatedPrice: est } : {}),
    scheduleSlots,
  } as HabitUpsertRequestDto;
}

export const HabitFormPage: FC = () => {
  const { habitId } = useParams<{ habitId: string }>();
  const isEdit = Boolean(habitId);
  const navigate = useNavigate();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id ?? '';
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [habitType, setHabitType] = useState<
    (typeof HabitUpsertRequestDtoHabitType)[keyof typeof HabitUpsertRequestDtoHabitType]
  >(HabitUpsertRequestDtoHabitType.PHYSICAL);
  const [expectedMinutes, setExpectedMinutes] = useState('30');
  const [validFrom, setValidFrom] = useState<Dayjs | null>(dayjs());
  const [validTo, setValidTo] = useState<Dayjs | null>(null);
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [scheduleKeys, setScheduleKeys] = useState<Set<string>>(new Set());
  const [scheduleError, setScheduleError] = useState(false);
  const [satisfactionScore, setSatisfactionScore] = useState(0);
  const [utilityScore, setUtilityScore] = useState(0);
  const [estimatedPrice, setEstimatedPrice] = useState('');

  const detailQuery = useQuery({
    queryKey: getHabitFindByIdQueryKey(trackerId, habitId ?? ''),
    enabled: isEdit && !!trackerId && !!habitId,
    queryFn: async ({ signal }) => {
      const res = await habitFindById(trackerId, habitId!, { signal });
      if (res.status === 404) {
        throw new Error('NOT_FOUND');
      }
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as HabitResponseDto;
    },
  });

  useEffect(() => {
    const h = detailQuery.data;
    if (!isEdit || !h) {
      return;
    }
    setName(h.name ?? '');
    setDescription(h.description ?? '');
    setHabitType(
      (h.habitType as (typeof HabitUpsertRequestDtoHabitType)[keyof typeof HabitUpsertRequestDtoHabitType]) ??
        HabitUpsertRequestDtoHabitType.OTHER,
    );
    setExpectedMinutes(String(h.expectedMinutes ?? 0));
    setValidFrom(h.validFrom ? dayjs(h.validFrom) : dayjs());
    setValidTo(h.validTo ? dayjs(h.validTo) : null);
    setActive(h.active ?? true);
    setSortOrder(h.sortOrder ?? 0);
    setScheduleKeys(slotsToKeySet(h.scheduleSlots));
    setSatisfactionScore(normalizeHabitScore(h.satisfactionScore));
    setUtilityScore(normalizeHabitScore(h.utilityScore));
    setEstimatedPrice(h.estimatedPrice != null && h.estimatedPrice !== 0 ? String(h.estimatedPrice) : '');
  }, [isEdit, detailQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (body: HabitUpsertRequestDto) => {
      const res = await habitCreate(trackerId, body);
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as HabitResponseDto;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: [`/api/habit/${trackerId}`] });
      enqueueSnackbar('Návyk byl vytvořen', { variant: 'success' });
      const id = created.id;
      if (id) {
        navigate(`/habits/${id}`, { replace: true });
      } else {
        navigate('/habits/list', { replace: true });
      }
    },
    onError: () => {
      enqueueSnackbar('Uložení se nezdařilo', { variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (body: HabitUpsertRequestDto) => {
      const res = await habitUpdate(trackerId, habitId!, body);
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as HabitResponseDto;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/habit/${trackerId}`] });
      if (habitId) {
        await queryClient.invalidateQueries({ queryKey: getHabitFindByIdQueryKey(trackerId, habitId) });
      }
      enqueueSnackbar('Návyk byl uložen', { variant: 'success' });
      navigate(habitId ? `/habits/${habitId}` : '/habits/list', { replace: true });
    },
    onError: () => {
      enqueueSnackbar('Uložení se nezdařilo', { variant: 'error' });
    },
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trackerId) {
      return;
    }
    if (!name.trim()) {
      enqueueSnackbar('Vyplň název návyku', { variant: 'warning' });
      return;
    }
    const minutes = Number(expectedMinutes.replace(',', '.'));
    if (!Number.isFinite(minutes) || minutes < 0) {
      enqueueSnackbar('Očekávaná délka musí být nezáporné číslo', { variant: 'warning' });
      return;
    }
    if (!validFrom) {
      enqueueSnackbar('Vyplň platnost od', { variant: 'warning' });
      return;
    }
    if (scheduleKeys.size === 0) {
      setScheduleError(true);
      enqueueSnackbar('Vyber alespoň jeden časový slot v rozvrhu', { variant: 'warning' });
      return;
    }
    setScheduleError(false);

    const body = buildUpsertBody({
      name,
      description,
      habitType,
      expectedMinutes: minutes,
      validFrom,
      validTo,
      active,
      sortOrder,
      scheduleKeys,
      satisfactionScore,
      utilityScore,
      estimatedPrice,
    });

    if (isEdit) {
      updateMutation.mutate(body);
    } else {
      createMutation.mutate(body);
    }
  };

  const typeSelect = (e: SelectChangeEvent<string>) => {
    setHabitType(e.target.value as (typeof HabitUpsertRequestDtoHabitType)[keyof typeof HabitUpsertRequestDtoHabitType]);
  };

  const noTracker = useMemo(
    () => (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Návyky
        </PageHeading>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nejprve vyber rozpočet (tracker) v menu u položky Trackery.
        </Typography>
        <Button component={Link} to="/trackers" variant="contained">
          Otevřít trackery
        </Button>
      </Box>
    ),
    [],
  );

  if (!trackerId) {
    return noTracker;
  }

  if (isEdit && detailQuery.isLoading) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        Načítám návyk…
      </Typography>
    );
  }

  if (isEdit && detailQuery.isError) {
    return (
      <Box>
        <Typography color="error" sx={{ mb: 2 }}>
          Návyk se nepodařilo načíst.
        </Typography>
        <Button component={Link} to="/habits/list" variant="outlined">
          Zpět na seznam
        </Button>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
      <Box component="form" onSubmit={onSubmit}>
        <PageHeading component="h1" gutterBottom>
          {isEdit ? 'Upravit návyk' : 'Nový návyk'}
        </PageHeading>

        <Stack spacing={3} sx={{ maxWidth: 720 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                required
                fullWidth
                disabled={saving}
              />
              <TextField
                label="Popis"
                value={description}
                onChange={(ev) => setDescription(ev.target.value)}
                fullWidth
                multiline
                minRows={2}
                disabled={saving}
              />
              <FormControl fullWidth disabled={saving}>
                <InputLabel id="habit-type-label">Typ návyku</InputLabel>
                <Select labelId="habit-type-label" label="Typ návyku" value={habitType} onChange={typeSelect}>
                  {HABIT_TYPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Očekávaná délka (min)"
                value={expectedMinutes}
                onChange={(ev) => setExpectedMinutes(ev.target.value)}
                type="text"
                inputMode="decimal"
                fullWidth
                disabled={saving}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <DatePicker
                  label="Platnost od"
                  value={validFrom}
                  onChange={(v) => setValidFrom(v)}
                  disabled={saving}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
                <DatePicker
                  label="Platnost do (volitelné)"
                  value={validTo}
                  onChange={(v) => setValidTo(v)}
                  disabled={saving}
                  slotProps={{ textField: { fullWidth: true, helperText: 'Prázdné = bez konce' } }}
                />
              </Stack>
              <TextField
                label="Pořadí řazení"
                type="number"
                value={sortOrder}
                onChange={(ev) => setSortOrder(Number(ev.target.value) || 0)}
                fullWidth
                disabled={saving}
                inputProps={{ min: 0 }}
              />
              <FormControlLabel
                control={
                  <Checkbox checked={active} onChange={(ev) => setActive(ev.target.checked)} disabled={saving} />
                }
                label="Aktivní"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Hodnocení 0–10: půl hvězdy = 1 bod. 0 = nevyplněno.
              </Typography>
              <HabitScoreRatingRow
                label="Spokojenost s návykem"
                value={satisfactionScore}
                onChange={setSatisfactionScore}
                disabled={saving}
              />
              <HabitScoreRatingRow
                label="Užitečnost návyku"
                value={utilityScore}
                onChange={setUtilityScore}
                disabled={saving}
              />
              <TextField
                label="Odhadovaná cena (Kč, volitelné)"
                value={estimatedPrice}
                onChange={(ev) => setEstimatedPrice(ev.target.value)}
                type="text"
                inputMode="decimal"
                fullWidth
                disabled={saving}
                placeholder="Nevyplněno"
              />
            </Stack>
          </Paper>

          <Box>
            <Typography variant="subtitle1" color="text.secondary" fontWeight={600} gutterBottom>
              Rozvrh
            </Typography>
            <HabitScheduleMatrix
              selected={scheduleKeys}
              onChange={(next) => {
                setScheduleKeys(next);
                if (next.size > 0) {
                  setScheduleError(false);
                }
              }}
              disabled={saving}
            />
            {scheduleError && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                Vyber alespoň jeden slot.
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button type="submit" variant="contained" disabled={saving}>
              {isEdit ? 'Uložit' : 'Vytvořit'}
            </Button>
            <Button
              component={Link}
              to={isEdit && habitId ? `/habits/${habitId}` : '/habits/list'}
              variant="outlined"
              disabled={saving}
            >
              Zrušit
            </Button>
          </Stack>
        </Stack>
      </Box>
    </LocalizationProvider>
  );
};
