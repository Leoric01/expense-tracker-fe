import type { NutritionSummaryResponseDto } from '@api/model/nutritionSummaryResponseDto';
import type { NutritionSummaryWeekDto } from '@api/model/nutritionSummaryWeekDto';
import { nutritionSummary } from '@api/nutrition-dashboard-controller/nutrition-dashboard-controller';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import { Box, Button, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { FC, useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link, useParams } from 'react-router-dom';
import { goalTypeLabel } from './goalPlanShared';

function formatKg(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function formatKcal(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${Math.round(n).toLocaleString('cs-CZ')}`;
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

function formatPlanRange(isoStart: string | undefined, isoEnd: string | undefined) {
  if (!isoStart) {
    return '—';
  }
  const a = dayjs(isoStart).format('D. M. YYYY');
  if (!isoEnd) {
    return a;
  }
  return `${a} → ${dayjs(isoEnd).format('D. M. YYYY')}`;
}

function formatMonthLabel(ym: string | undefined) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return ym ?? '—';
  }
  const [y, m] = ym.split('-');
  return `${m}/${y}`;
}

/** Zelená = na trase k cíli, červená = mimo (záporný cíl = ztráta → lepší je „víc záporné“). */
function monthProgressOk(actual: number | undefined, goal: number | undefined): boolean | null {
  if (actual == null || goal == null || !Number.isFinite(actual) || !Number.isFinite(goal)) {
    return null;
  }
  if (goal < 0) {
    return actual <= goal;
  }
  if (goal > 0) {
    return actual >= goal;
  }
  return Math.abs(actual - goal) <= 0.35;
}

/** Sekce 8 — souhrn plánu (GET nutrition-dashboard …/summary). */
export const NutritionGoalPlanSummaryPage: FC = () => {
  const theme = useTheme();
  const { goalPlanId } = useParams<{ goalPlanId: string }>();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  const summaryQuery = useQuery({
    queryKey: ['nutritionSummary', trackerId, goalPlanId],
    enabled: !!trackerId && !!goalPlanId,
    queryFn: async (): Promise<NutritionSummaryResponseDto> => {
      const res = await nutritionSummary(trackerId!, goalPlanId!);
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as NutritionSummaryResponseDto;
    },
  });

  const dto = summaryQuery.data;

  const weeksDisplay = useMemo(() => {
    const raw = dto?.weeks ?? [];
    return [...raw].sort((a, b) => (b.weekIndex ?? 0) - (a.weekIndex ?? 0));
  }, [dto?.weeks]);

  const weightChartData = useMemo(() => {
    const weeks = dto?.weeks ?? [];
    const sorted = [...weeks]
      .filter((w) => w.weekIndex != null)
      .sort((a, b) => (a.weekIndex ?? 0) - (b.weekIndex ?? 0));
    const start = dto?.startWeightKg;
    const tw = dto?.targetWeeklyWeightChangeKg;
    return sorted.map((w) => {
      const wi = w.weekIndex as number;
      const projected =
        start != null && tw != null && Number.isFinite(start) && Number.isFinite(tw)
          ? start + wi * tw
          : undefined;
      return {
        weekLabel: `W${wi}`,
        weekIndex: wi,
        avgWeight: w.avgWeightKg,
        projected,
      };
    });
  }, [dto?.weeks, dto?.startWeightKg, dto?.targetWeeklyWeightChangeKg]);

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Plán
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

  if (!goalPlanId) {
    return <Typography color="error">Chybí ID plánu.</Typography>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <ListAltOutlinedIcon color="primary" />
          <PageHeading component="h1" gutterBottom sx={{ mb: 0 }}>
            {dto?.goalPlanName ?? 'Plán'}
          </PageHeading>
        </Stack>
        <Button component={Link} to="/nutrition/goal-plan" variant="outlined" size="small">
          ← Moje plány
        </Button>
      </Stack>

      {summaryQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : summaryQuery.isError || !dto ? (
        <Typography color="error">Souhrn plánu se nepodařilo načíst.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            {goalTypeLabel(dto.goalType)} | {formatPlanRange(dto.planStartDate, dto.planEndDate)}
          </Typography>
          <Typography variant="body2">
            Start: {formatKg(dto.startWeightKg)} kg
            {dto.startBodyFatPercent != null ? ` | BF: ${formatBf(dto.startBodyFatPercent)}` : ''} | Target:{' '}
            {dto.targetWeeklyWeightChangeKg != null
              ? `${dto.targetWeeklyWeightChangeKg > 0 ? '+' : ''}${dto.targetWeeklyWeightChangeKg.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg/týden`
              : '—'}
          </Typography>

          {weightChartData.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Trend váhy vs. cílová projekce (týdenně)
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <ComposedChart data={weightChartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11 }}
                      width={48}
                      tickFormatter={(v) => `${v}`}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [
                        `${value?.toFixed?.(1) ?? value} kg`,
                        name === 'avgWeight' ? 'Prům. váha' : 'Projekce (cíl)',
                      ]}
                      labelFormatter={(l) => `Týden ${l}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="projected"
                      name="Projekce (cíl)"
                      stroke={theme.palette.secondary.main}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="avgWeight"
                      name="Prům. váha"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          )}

          <Typography variant="subtitle1" fontWeight={600}>
            Týdenní přehled
          </Typography>
          <Table size="small" sx={{ maxWidth: 960 }}>
            <TableHead>
              <TableRow>
                <TableCell>Week</TableCell>
                <TableCell align="right">Avg kg</TableCell>
                <TableCell align="right">Avg kcal</TableCell>
                <TableCell align="right">BF%</TableCell>
                <TableCell align="right">Δ start</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {weeksDisplay.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">Zatím žádná týdenní data.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                weeksDisplay.map((w: NutritionSummaryWeekDto, i) => (
                  <TableRow key={`${w.weekIndex}-${w.weekStartDate ?? i}`}>
                    <TableCell>{w.weekIndex ?? '—'}</TableCell>
                    <TableCell align="right">{formatKg(w.avgWeightKg)}</TableCell>
                    <TableCell align="right">{formatKcal(w.avgCaloriesKcal)}</TableCell>
                    <TableCell align="right">{formatBf(w.bodyFatPercent)}</TableCell>
                    <TableCell align="right">{formatDeltaKg(w.weightChangeFromStartKg)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Typography variant="subtitle1" fontWeight={600} sx={{ pt: 1 }}>
            Měsíční přehled
          </Typography>
          <Table size="small" sx={{ maxWidth: 560 }}>
            <TableHead>
              <TableRow>
                <TableCell>Měsíc</TableCell>
                <TableCell align="right">Skutečná změna</TableCell>
                <TableCell align="right">Cílová změna</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(dto.months ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">Žádná měsíční data.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (dto.months ?? []).map((m) => {
                  const ok = monthProgressOk(m.actualWeightChangeKg, m.goalWeightChangeKg);
                  const color =
                    ok === true ? 'success.main' : ok === false ? 'error.main' : 'text.primary';
                  return (
                    <TableRow key={m.month ?? ''}>
                      <TableCell>{formatMonthLabel(m.month)}</TableCell>
                      <TableCell align="right">
                        <Typography component="span" sx={{ color, fontWeight: ok != null ? 600 : 400 }}>
                          {formatDeltaKg(m.actualWeightChangeKg)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{formatDeltaKg(m.goalWeightChangeKg)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <Box sx={{ pt: 1 }}>
            <Button component={Link} to="/nutrition/dashboard" variant="contained" size="small">
              Dashboard výživy
            </Button>
          </Box>
        </>
      )}
    </Stack>
  );
};
