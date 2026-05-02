import { goalPlanFindAll } from '@api/goal-plan-controller/goal-plan-controller';
import type { PagedModelGoalPlanResponseDto } from '@api/model/pagedModelGoalPlanResponseDto';
import type { PagedModelWeeklyCheckinResponseDto } from '@api/model/pagedModelWeeklyCheckinResponseDto';
import type { NutritionDashboardResponseDto } from '@api/model/nutritionDashboardResponseDto';
import type { NutritionTargetResponseDto } from '@api/model/nutritionTargetResponseDto';
import type { WeeklyCheckinResponseDto } from '@api/model/weeklyCheckinResponseDto';
import { nutritionDashboard } from '@api/nutrition-dashboard-controller/nutrition-dashboard-controller';
import { nutritionTargetFindCurrent } from '@api/nutrition-target-controller/nutrition-target-controller';
import {
  weeklyCheckinFindAll,
  weeklyCheckinGenerateForDate,
} from '@api/weekly-checkin-controller/weekly-checkin-controller';
import { PageHeading } from '@components/PageHeading';
import { useNutritionActiveGoalPlanId } from '@hooks/useNutritionActiveGoalPlanId';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { useSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

async function fetchNutritionTargetCurrent(
  trackerId: string,
): Promise<NutritionTargetResponseDto | null> {
  const res = await nutritionTargetFindCurrent(trackerId);
  if ((res.status as number) === 404) {
    return null;
  }
  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.data as unknown as NutritionTargetResponseDto;
}

function formatKg(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kg`;
}

function formatKcal(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${Math.round(n).toLocaleString('cs-CZ')} kcal`;
}

function formatBf(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %`;
}

function formatDeltaKg(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} kg`;
}

function formatDateShort(iso: string | undefined) {
  if (!iso) {
    return '—';
  }
  return dayjs(iso).format('D. M. YYYY');
}

export const NutritionWeeklyCheckinPage: FC = () => {
  const theme = useTheme();
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
    queryKey: ['goalPlanFindAll', trackerId, 'weekly-page-fallback'],
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

  const goalPlanId = useMemo(() => {
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

  const historyQuery = useQuery({
    queryKey: ['weeklyCheckinFindAll', trackerId, goalPlanId],
    enabled: !!trackerId && !!goalPlanId,
    queryFn: async (): Promise<PagedModelWeeklyCheckinResponseDto> => {
      const res = await weeklyCheckinFindAll(trackerId!, goalPlanId!, {
        page: 0,
        size: 50,
        sort: ['weekIndex,desc'],
      });
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as PagedModelWeeklyCheckinResponseDto;
    },
  });

  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<WeeklyCheckinResponseDto | null>(null);
  const [adaptiveKcal, setAdaptiveKcal] = useState<{ from: number; to: number } | null>(null);

  const historyRows = historyQuery.data?.content ?? [];
  const weightTrendData = useMemo(() => {
    const rows = [...historyRows].filter((r) => r.weekIndex != null && r.avgWeightKg != null);
    rows.sort((a, b) => (a.weekIndex ?? 0) - (b.weekIndex ?? 0));
    return rows.map((r) => ({
      weekLabel: `T${r.weekIndex}`,
      avgWeightKg: r.avgWeightKg as number,
      weekIndex: r.weekIndex as number,
    }));
  }, [historyRows]);

  const resolvingGoalPlan =
    !!trackerId &&
    (dashboardQuery.isLoading || (dashboardQuery.isSuccess && !dashboardQuery.data?.activeGoalPlanId && goalPlansFallbackQuery.isLoading));

  const handleGenerate = async () => {
    if (!trackerId || !goalPlanId) {
      return;
    }
    setGenerating(true);
    setAdaptiveKcal(null);
    try {
      const targetBefore = await fetchNutritionTargetCurrent(trackerId);
      const prevKcal = targetBefore?.targetCaloriesKcal;

      const genRes = await weeklyCheckinGenerateForDate(trackerId, goalPlanId, undefined);
      if (genRes.status < 200 || genRes.status >= 300) {
        enqueueSnackbar('Generování weekly check-inu selhalo', { variant: 'error' });
        return;
      }

      const dto = genRes.data as unknown as WeeklyCheckinResponseDto;
      setLastGenerated(dto);

      await queryClient.invalidateQueries({ queryKey: ['nutritionTargetCurrent', trackerId] });
      const targetAfter = await fetchNutritionTargetCurrent(trackerId);
      const nextKcal = targetAfter?.targetCaloriesKcal;

      if (
        prevKcal != null &&
        nextKcal != null &&
        Number.isFinite(prevKcal) &&
        Number.isFinite(nextKcal) &&
        prevKcal !== nextKcal
      ) {
        setAdaptiveKcal({ from: prevKcal, to: nextKcal });
      }

      await queryClient.invalidateQueries({ queryKey: ['weeklyCheckinFindAll', trackerId, goalPlanId] });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
      enqueueSnackbar('Weekly check-in uložen', { variant: 'success' });
    } catch {
      enqueueSnackbar('Generování weekly check-inu selhalo', { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Weekly check-in
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

  const displayCheckin = lastGenerated;

  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        Weekly check-in
      </PageHeading>

      {dashboardQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst přehled výživy. Zkus stránku obnovit.
        </Alert>
      )}

      {resolvingGoalPlan ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
          <CircularProgress size={22} />
          <Typography variant="body2" color="text.secondary">
            Načítám aktivní cílový plán…
          </Typography>
        </Box>
      ) : !goalPlanId ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          K weekly check-inu je potřeba aktivní cílový plán.{' '}
          <Link to="/nutrition/goal-plan">Otevřít cílové plány</Link> nebo{' '}
          <Link to="/nutrition/dashboard">dashboard</Link>.
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 720, mt: 1 }}>
        <Button
          variant="contained"
          onClick={() => void handleGenerate()}
          disabled={!goalPlanId || generating || resolvingGoalPlan}
        >
          {generating ? 'Generuji…' : 'Vygenerovat pro aktuální týden'}
        </Button>

        {displayCheckin && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Týden {displayCheckin.weekIndex ?? '—'} ({formatDateShort(displayCheckin.weekStartDate)} →{' '}
              {formatDateShort(displayCheckin.weekEndDate)})
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              <Typography variant="body2">Prům. váha: {formatKg(displayCheckin.avgWeightKg)}</Typography>
              <Typography variant="body2">Prům. kalorie: {formatKcal(displayCheckin.avgCaloriesKcal)}</Typography>
              <Typography variant="body2">BF%: {formatBf(displayCheckin.bodyFatPercent)}</Typography>
              <Typography variant="body2">
                Změna od startu: {formatDeltaKg(displayCheckin.weightChangeFromStartKg)}
              </Typography>
              <Typography variant="body2">
                Změna od minulého týdne: {formatDeltaKg(displayCheckin.weightChangeFromPreviousCheckinKg)}
              </Typography>
              <Typography variant="body2">
                Odhad TDEE: {formatKcal(displayCheckin.avgEstimatedTdeeKcal)}
              </Typography>
              <Typography variant="body2">
                Dní s váhou: {displayCheckin.daysWithWeight ?? '—'}/7 · Dní s kaloriemi:{' '}
                {displayCheckin.daysWithCalories ?? '—'}/7 · Dní s obvody:{' '}
                {displayCheckin.daysWithBodyMeasurements ?? '—'}/7
              </Typography>
            </Stack>

            {adaptiveKcal && (
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <BoltOutlinedIcon color="warning" sx={{ mt: 0.25 }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Target byl adaptivně upraven
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Target adaptivně upraven:{' '}
                    {Math.round(adaptiveKcal.from).toLocaleString('cs-CZ')} →{' '}
                    {Math.round(adaptiveKcal.to).toLocaleString('cs-CZ')} kcal
                  </Typography>
                </Box>
              </Stack>
            )}
          </Paper>
        )}

        {weightTrendData.length >= 2 && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Trend průměrné váhy (weekly check-iny)
            </Typography>
            <Box sx={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={weightTrendData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11 }}
                    width={44}
                    tickFormatter={(v) => `${v}`}
                  />
                  <RechartsTooltip
                    formatter={(value) => {
                      const n = typeof value === 'number' ? value : Number(value);
                      const label = Number.isFinite(n) ? `${n.toFixed(1)} kg` : '—';
                      return [label, 'Prům. váha'];
                    }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.weekIndex != null
                        ? `Týden ${payload[0].payload.weekIndex}`
                        : ''
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="avgWeightKg"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1 }}>
          Historie check-inů
        </Typography>

        {historyQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Načítám historii…
          </Typography>
        ) : historyQuery.isError ? (
          <Typography variant="body2" color="error">
            Historii se nepodařilo načíst.
          </Typography>
        ) : historyRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Zatím žádný weekly check-in — použij tlačítko výše.
          </Typography>
        ) : (
          <Table size="small" sx={{ maxWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Týden</TableCell>
                <TableCell align="right">Prům. váha</TableCell>
                <TableCell align="right">Prům. kcal</TableCell>
                <TableCell align="right">Δ od startu</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historyRows.map((row) => (
                <TableRow key={row.id ?? `${row.weekIndex}-${row.weekStartDate}`}>
                  <TableCell>
                    {row.weekIndex != null ? `Week ${row.weekIndex}` : '—'}
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatDateShort(row.weekStartDate)} – {formatDateShort(row.weekEndDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{formatKg(row.avgWeightKg)}</TableCell>
                  <TableCell align="right">{formatKcal(row.avgCaloriesKcal)}</TableCell>
                  <TableCell align="right">{formatDeltaKg(row.weightChangeFromStartKg)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </Box>
  );
};
