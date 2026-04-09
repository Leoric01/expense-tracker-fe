import { goalPlanFindAll } from '@api/goal-plan-controller/goal-plan-controller';
import type { ManualNutritionTargetRequestDto } from '@api/model/manualNutritionTargetRequestDto';
import type { NutritionDashboardResponseDto } from '@api/model/nutritionDashboardResponseDto';
import type { PagedModelGoalPlanResponseDto } from '@api/model/pagedModelGoalPlanResponseDto';
import type { PagedModelNutritionTargetResponseDto } from '@api/model/pagedModelNutritionTargetResponseDto';
import type { NutritionTargetResponseDto } from '@api/model/nutritionTargetResponseDto';
import { nutritionDashboard } from '@api/nutrition-dashboard-controller/nutrition-dashboard-controller';
import {
  getNutritionTargetFindAllQueryKey,
  nutritionTargetFindAll,
  nutritionTargetFindCurrent,
  nutritionTargetManualOverride,
} from '@api/nutrition-target-controller/nutrition-target-controller';
import { PageHeading } from '@components/PageHeading';
import { useNutritionActiveGoalPlanId } from '@hooks/useNutritionActiveGoalPlanId';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
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
import { Link } from 'react-router-dom';

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

function formatDate(iso: string | undefined) {
  if (!iso) {
    return '—';
  }
  return dayjs(iso).format('D. M. YYYY');
}

const REASON_LABELS: Record<string, string> = {
  INITIAL_CALCULATION: 'Inicializace',
  ADAPTIVE_ADJUSTMENT: 'Adaptivní',
  MANUAL_OVERRIDE: 'Ruční',
};

function reasonCodeLabel(code: string | undefined) {
  if (!code) {
    return '—';
  }
  return REASON_LABELS[code] ?? code;
}

function ReasonBadges({ row }: { row: NutritionTargetResponseDto }) {
  const manual = row.manualOverride === true;
  const code = row.reasonCode;
  if (manual && code === 'MANUAL_OVERRIDE') {
    return <Chip size="small" color="warning" label="Ruční" />;
  }
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {manual ? <Chip size="small" color="warning" label="Ruční" variant="outlined" /> : null}
      {code ? (
        <Chip
          size="small"
          color={
            code === 'ADAPTIVE_ADJUSTMENT' ? 'info' : code === 'INITIAL_CALCULATION' ? 'default' : 'secondary'
          }
          label={reasonCodeLabel(code)}
          variant="outlined"
        />
      ) : null}
    </Stack>
  );
}

async function fetchCurrentTarget(trackerId: string): Promise<NutritionTargetResponseDto | null> {
  const res = await nutritionTargetFindCurrent(trackerId);
  if (res.status === 404) {
    return null;
  }
  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.data as unknown as NutritionTargetResponseDto;
}

export const NutritionTargetHistoryPage: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const persistedGoalPlanId = useNutritionActiveGoalPlanId(trackerId);

  const dashboardParams = useMemo(
    () => ({
      from: dayjs().subtract(90, 'day').format('YYYY-MM-DD'),
      to: dayjs().format('YYYY-MM-DD'),
    }),
    [],
  );

  const dashboardQuery = useQuery({
    queryKey: ['nutritionDashboard', trackerId, dashboardParams],
    enabled: !!trackerId,
    queryFn: async (): Promise<NutritionDashboardResponseDto> => {
      const res = await nutritionDashboard(trackerId!, dashboardParams);
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as NutritionDashboardResponseDto;
    },
  });

  const goalPlansFallbackQuery = useQuery({
    queryKey: ['goalPlanFindAll', trackerId, 'target-history-fallback'],
    enabled:
      !!trackerId &&
      dashboardQuery.isSuccess &&
      !dashboardQuery.data?.activeGoalPlanId,
    queryFn: async (): Promise<PagedModelGoalPlanResponseDto> => {
      const res = await goalPlanFindAll(trackerId!, { page: 0, size: 100 });
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as PagedModelGoalPlanResponseDto;
    },
  });

  const goalPlanIdForOverride = useMemo(() => {
    const fromDash = dashboardQuery.data?.activeGoalPlanId;
    if (fromDash) {
      return fromDash;
    }
    const fromList = goalPlansFallbackQuery.data?.content?.find((g) => g.active)?.id;
    if (fromList) {
      return fromList;
    }
    return persistedGoalPlanId;
  }, [dashboardQuery.data?.activeGoalPlanId, goalPlansFallbackQuery.data?.content, persistedGoalPlanId]);

  const currentQuery = useQuery({
    queryKey: ['nutritionTargetCurrent', trackerId],
    enabled: !!trackerId,
    queryFn: () => fetchCurrentTarget(trackerId!),
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const listParams = useMemo(
    () => ({
      page,
      size: rowsPerPage,
      sort: ['effectiveFrom,desc'],
    }),
    [page, rowsPerPage],
  );

  const historyQuery = useQuery({
    queryKey: trackerId ? getNutritionTargetFindAllQueryKey(trackerId, listParams) : ['nutritionTargetFindAll', 'off'],
    enabled: !!trackerId,
    queryFn: async (): Promise<PagedModelNutritionTargetResponseDto> => {
      const res = await nutritionTargetFindAll(trackerId!, listParams);
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as PagedModelNutritionTargetResponseDto;
    },
  });

  const current = currentQuery.data;
  const resolvingGoalPlan =
    !!trackerId &&
    (dashboardQuery.isLoading ||
      (dashboardQuery.isSuccess && !dashboardQuery.data?.activeGoalPlanId && goalPlansFallbackQuery.isLoading));

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState<Dayjs | null>(() => dayjs());
  const [baselineTdee, setBaselineTdee] = useState('');
  const [calorieAdj, setCalorieAdj] = useState('');
  const [targetCal, setTargetCal] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');

  useEffect(() => {
    if (!overrideOpen || !current) {
      return;
    }
    const t = current;
    setEffectiveFrom(dayjs());
    setBaselineTdee(t.baselineTdeeKcal != null ? String(Math.round(t.baselineTdeeKcal)) : '');
    setCalorieAdj(t.calorieAdjustmentKcal != null ? String(Math.round(t.calorieAdjustmentKcal)) : '');
    setTargetCal(t.targetCaloriesKcal != null ? String(Math.round(t.targetCaloriesKcal)) : '');
    setProteinG(t.targetProteinG != null ? String(Math.round(t.targetProteinG * 10) / 10) : '');
    setFatG(t.targetFatG != null ? String(Math.round(t.targetFatG * 10) / 10) : '');
    setCarbsG(t.targetCarbsG != null ? String(Math.round(t.targetCarbsG * 10) / 10) : '');
    setReasonDetail('');
  }, [overrideOpen, current]);

  const overrideMutation = useMutation({
    mutationFn: async (body: ManualNutritionTargetRequestDto) => {
      const res = await nutritionTargetManualOverride(trackerId!, goalPlanIdForOverride!, body);
      if (res.status < 200 || res.status >= 400) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    },
    onSuccess: async () => {
      enqueueSnackbar('Ruční target uložen', { variant: 'success' });
      setOverrideOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['nutritionTargetCurrent', trackerId] });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === `/api/nutrition-target/${trackerId}`,
      });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
    },
    onError: () => {
      enqueueSnackbar('Uložení override selhalo', { variant: 'error' });
    },
  });

  const parseNum = (s: string): number | undefined => {
    const t = s.trim().replace(',', '.');
    if (t === '') {
      return undefined;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleOverrideSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!goalPlanIdForOverride) {
      enqueueSnackbar('Chybí aktivní cílový plán', { variant: 'warning' });
      return;
    }
    if (!effectiveFrom) {
      enqueueSnackbar('Vyber datum platnosti od', { variant: 'warning' });
      return;
    }
    const baseline = parseNum(baselineTdee);
    const adj = parseNum(calorieAdj);
    const tcal = parseNum(targetCal);
    const p = parseNum(proteinG);
    const f = parseNum(fatG);
    const c = parseNum(carbsG);
    if (
      baseline === undefined ||
      adj === undefined ||
      tcal === undefined ||
      p === undefined ||
      f === undefined ||
      c === undefined
    ) {
      enqueueSnackbar('Vyplň všechna číselná pole', { variant: 'warning' });
      return;
    }
    const body: ManualNutritionTargetRequestDto = {
      effectiveFrom: effectiveFrom.format('YYYY-MM-DD'),
      baselineTdeeKcal: baseline,
      calorieAdjustmentKcal: adj,
      targetCaloriesKcal: tcal,
      targetProteinG: p,
      targetFatG: f,
      targetCarbsG: c,
      reasonDetail: reasonDetail.trim() || undefined,
    };
    overrideMutation.mutate(body);
  };

  const historyRows = historyQuery.data?.content ?? [];
  const totalHistory = historyQuery.data?.page?.totalElements ?? 0;

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Target historie
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
      <Stack spacing={3}>
        <PageHeading component="h1" gutterBottom>
          Target historie
        </PageHeading>

        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
          Historie nutrition targetů a ruční přepsání (např. podle trenéra). Adaptivní úpravy se při aktivním ručním
          override nemění automaticky.
        </Typography>

        <Typography variant="subtitle2" color="text.secondary">
          Aktuální target
        </Typography>
        {currentQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Načítám…
          </Typography>
        ) : !current ? (
          <Typography variant="body2" color="text.secondary">
            Žádný aktivní target — nejdřív založ cílový plán a nech vygenerovat doporučení.
          </Typography>
        ) : (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, maxWidth: 720 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                <PushPinOutlinedIcon color="primary" fontSize="small" sx={{ mt: 0.25 }} />
                <Typography variant="body1">
                  <strong>{formatKcal(current.targetCaloriesKcal)}</strong>
                  {' | '}
                  P: {formatG(current.targetProteinG)} | F: {formatG(current.targetFatG)} | C:{' '}
                  {formatG(current.targetCarbsG)}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Platný od: {formatDate(current.effectiveFrom)} | Algorithm: {current.algorithmVersion ?? '—'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="text.secondary">
                  Reason:
                </Typography>
                <ReasonBadges row={current} />
                {current.reasonDetail ? (
                  <Typography variant="body2" color="text.secondary">
                    ({current.reasonDetail})
                  </Typography>
                ) : null}
              </Stack>
              {current.manualOverride === true ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Adaptive adjustment je pozastaven (ruční override aktivní).
                </Alert>
              ) : null}
            </Stack>
          </Paper>
        )}

        <Typography variant="subtitle2" color="text.secondary">
          Historie
        </Typography>
        {historyQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Načítám historii…
          </Typography>
        ) : historyQuery.isError ? (
          <Typography color="error">Historii se nepodařilo načíst.</Typography>
        ) : (
          <>
            <Table size="small" sx={{ maxWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Období</TableCell>
                  <TableCell align="right">Kalorie</TableCell>
                  <TableCell>Důvod</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyRows.map((row) => (
                  <TableRow key={row.id ?? `${row.effectiveFrom}-${row.effectiveTo}`}>
                    <TableCell>
                      {formatDate(row.effectiveFrom)}
                      {row.effectiveTo ? ` → ${formatDate(row.effectiveTo)}` : ' →'}
                    </TableCell>
                    <TableCell align="right">{formatKcal(row.targetCaloriesKcal)}</TableCell>
                    <TableCell>
                      <ReasonBadges row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={totalHistory}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="Řádků:"
            />
          </>
        )}

        <Typography variant="subtitle2" color="text.secondary">
          Manual override
        </Typography>
        {resolvingGoalPlan ? (
          <Typography variant="body2" color="text.secondary">
            Načítám aktivní plán…
          </Typography>
        ) : !goalPlanIdForOverride ? (
          <Alert severity="warning" sx={{ maxWidth: 720 }}>
            Ruční override vyžaduje aktivní cílový plán.{' '}
            <Link to="/nutrition/goal-plan">Otevřít plány</Link>.
          </Alert>
        ) : (
          <>
            <Button variant="outlined" onClick={() => setOverrideOpen((o) => !o)}>
              {overrideOpen ? 'Skrýt formulář' : 'Přepsat target ručně'}
            </Button>
            <Collapse in={overrideOpen}>
              <Paper
                component="form"
                onSubmit={handleOverrideSubmit}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2, maxWidth: 560, mt: 1 }}
              >
                <Stack spacing={2}>
                  <DatePicker
                    label="Platný od"
                    value={effectiveFrom}
                    onChange={(v) => v && setEffectiveFrom(v)}
                    format="DD. MM. YYYY"
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                  <TextField
                    label="Baseline TDEE (kcal)"
                    value={baselineTdee}
                    onChange={(e) => setBaselineTdee(e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ step: 1 }}
                  />
                  <TextField
                    label="Calorie adjustment (kcal)"
                    value={calorieAdj}
                    onChange={(e) => setCalorieAdj(e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ step: 1 }}
                  />
                  <TextField
                    label="Target kalorie (kcal)"
                    value={targetCal}
                    onChange={(e) => setTargetCal(e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ step: 1 }}
                  />
                  <TextField
                    label="Protein (g)"
                    value={proteinG}
                    onChange={(e) => setProteinG(e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ step: 0.1 }}
                  />
                  <TextField
                    label="Fat (g)"
                    value={fatG}
                    onChange={(e) => setFatG(e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ step: 0.1 }}
                  />
                  <TextField
                    label="Carbs (g)"
                    value={carbsG}
                    onChange={(e) => setCarbsG(e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ step: 0.1 }}
                  />
                  <TextField
                    label="Důvod (volitelné)"
                    value={reasonDetail}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="Doporučení trenéra"
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="submit" variant="contained" disabled={overrideMutation.isPending || !current}>
                      Uložit override
                    </Button>
                  </Box>
                  {!current ? (
                    <Typography variant="caption" color="text.secondary">
                      Nejprve musí existovat aktuální target (načti se výše).
                    </Typography>
                  ) : null}
                </Stack>
              </Paper>
            </Collapse>
          </>
        )}
      </Stack>
    </LocalizationProvider>
  );
};
