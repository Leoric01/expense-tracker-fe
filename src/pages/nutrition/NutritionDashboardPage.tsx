import { nutritionDashboard } from '@api/nutrition-dashboard-controller/nutrition-dashboard-controller';
import type { NutritionDashboardResponseDto } from '@api/model/nutritionDashboardResponseDto';
import type { NutritionDashboardCheckinPointDto } from '@api/model/nutritionDashboardCheckinPointDto';
import { PageHeading } from '@components/PageHeading';
import { usePersistStore } from '@components/store/persistStore';
import { useAuth } from '@auth/AuthContext';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import {
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
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/cs';
import { FC, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

function formatKg(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kg`;
}

function formatDateCs(iso: string | undefined) {
  if (!iso) {
    return '—';
  }
  return dayjs(iso).format('D. M. YYYY');
}

export const NutritionDashboardPage: FC = () => {
  const theme = useTheme();
  const { userData } = useAuth();
  const userId = userData?.id ?? '';
  const setNutritionActiveGoalPlan = usePersistStore(userId).setNutritionActiveGoalPlan;

  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  const [from, setFrom] = useState<Dayjs>(() => dayjs().subtract(90, 'day'));
  const [to, setTo] = useState<Dayjs>(() => dayjs());

  const params = useMemo(
    () => ({
      from: from.format('YYYY-MM-DD'),
      to: to.format('YYYY-MM-DD'),
    }),
    [from, to],
  );

  const dashboardQuery = useQuery({
    queryKey: ['nutritionDashboard', trackerId, params],
    enabled: !!trackerId,
    queryFn: async (): Promise<NutritionDashboardResponseDto> => {
      const res = await nutritionDashboard(trackerId!, params);
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as NutritionDashboardResponseDto;
    },
  });

  useEffect(() => {
    if (!trackerId || !dashboardQuery.isSuccess || !dashboardQuery.data) {
      return;
    }
    const gid = dashboardQuery.data.activeGoalPlanId;
    setNutritionActiveGoalPlan(trackerId, gid ?? null);
  }, [trackerId, dashboardQuery.isSuccess, dashboardQuery.data, setNutritionActiveGoalPlan]);

  const dto = dashboardQuery.data;

  const weightChartData = useMemo(() => {
    const pts = (dto?.weightTimeline ?? [])
      .filter((p) => p.date != null)
      .map((p) => ({ date: p.date!, weightKg: p.weightKg }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return pts;
  }, [dto?.weightTimeline]);

  const calorieChartData = useMemo(() => {
    const pts = (dto?.calorieTimeline ?? [])
      .filter((p) => p.date != null)
      .map((p) => ({ date: p.date!, caloriesKcal: p.caloriesKcal }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return pts;
  }, [dto?.calorieTimeline]);

  const handleResetRange = () => {
    setFrom(dayjs().subtract(90, 'day'));
    setTo(dayjs());
  };

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Dashboard výživy
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

  if (dashboardQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (dashboardQuery.isError || !dto) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Dashboard výživy
        </PageHeading>
        <Typography color="error">Data se nepodařilo načíst.</Typography>
      </Box>
    );
  }

  const current = dto.currentTarget;
  const checkin = dto.latestCheckin;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          useFlexGap
        >
          <PageHeading component="h1" sx={{ mb: 0 }}>
            Dashboard výživy
          </PageHeading>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" size="small" component={Link} to="/nutrition/daily-checkin">
              + Zapsat dnešní check-in
            </Button>
            <Button variant="outlined" size="small" component={Link} to="/nutrition/weekly-checkin">
              ↻ Vygenerovat weekly check-in
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" flexWrap="wrap">
            <DatePicker
              label="Od"
              value={from}
              onChange={(v) => v && setFrom(v)}
              format="DD. MM. YYYY"
              slotProps={{ textField: { size: 'small', sx: { minWidth: 160 } } }}
            />
            <DatePicker
              label="Do"
              value={to}
              onChange={(v) => v && setTo(v)}
              format="DD. MM. YYYY"
              slotProps={{ textField: { size: 'small', sx: { minWidth: 160 } } }}
            />
            <Button variant="outlined" size="small" onClick={handleResetRange}>
              Posledních 90 dní
            </Button>
          </Stack>
        </Stack>

        {!current ? (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack spacing={2} alignItems="flex-start">
              <Typography fontWeight={600}>Zatím nemáš aktivní výživový plán</Typography>
              <Typography color="text.secondary">
                Založ cílový plán (sekce 2), aby se ti spočítaly kalorie a makra.
              </Typography>
              <Button variant="contained" component={Link} to="/nutrition/goal-plan">
                Založit plán
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <EmojiEventsOutlinedIcon color="primary" fontSize="small" />
              <Typography fontWeight={600}>Aktuální target</Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: 2,
                mb: 2,
              }}
            >
              {[
                { label: 'Kalorie', value: formatKcal(current.targetCaloriesKcal) },
                { label: 'Protein', value: formatG(current.targetProteinG) },
                { label: 'Fat', value: formatG(current.targetFatG) },
                { label: 'Carbs', value: formatG(current.targetCarbsG) },
              ].map((cell) => (
                <Box
                  key={cell.label}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1.5,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    {cell.label}
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {cell.value}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Platný od: {formatDateCs(current.effectiveFrom)}
                {current.effectiveTo ? ` · do ${formatDateCs(current.effectiveTo)}` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manual override: {current.manualOverride ? 'Ano' : 'Ne'}
              </Typography>
            </Stack>
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <InsightsOutlinedIcon color="primary" fontSize="small" />
            <Typography fontWeight={600}>
              Poslední weekly check-in
              {checkin?.weekIndex != null ? ` (Week ${checkin.weekIndex})` : ''}
            </Typography>
          </Stack>
          {!checkin ? (
            <Typography color="text.secondary">Zatím žádné weekly check-iny.</Typography>
          ) : (
            <Stack spacing={1}>
              <Typography variant="body2">
                Avg váha: <strong>{formatKg(checkin.avgWeightKg)}</strong>
                {' · '}
                Avg kalorie: <strong>{formatKcal(checkin.avgCaloriesKcal)}</strong>
              </Typography>
              <Typography variant="body2">
                BF%:{' '}
                <strong>
                  {checkin.bodyFatPercent != null && Number.isFinite(checkin.bodyFatPercent)
                    ? `${checkin.bodyFatPercent.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %`
                    : '—'}
                </strong>
                {' · '}
                Změna od startu:{' '}
                <strong>
                  {checkin.weightChangeFromStartKg != null && Number.isFinite(checkin.weightChangeFromStartKg)
                    ? `${checkin.weightChangeFromStartKg >= 0 ? '+' : ''}${checkin.weightChangeFromStartKg.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg`
                    : '—'}
                </strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dní s váhou: {checkin.daysWithWeight ?? '—'}/7 · Dní s kaloriemi:{' '}
                {checkin.daysWithCalories ?? '—'}/7
                {checkin.daysWithBodyMeasurements != null
                  ? ` · Měření těla: ${checkin.daysWithBodyMeasurements}/7`
                  : ''}
              </Typography>
            </Stack>
          )}
        </Paper>

        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <ShowChartOutlinedIcon color="primary" fontSize="small" />
            <Typography fontWeight={600}>Grafy (období dle výběru výše)</Typography>
          </Stack>

          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Váha (kg)
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                {weightChartData.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    Žádná data o váze v období.
                  </Typography>
                ) : (
                  <ResponsiveContainer>
                    <ComposedChart data={weightChartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: string) => dayjs(v).format('D. M.')}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 11 }}
                        width={44}
                        tickFormatter={(v) => `${v}`}
                      />
                      <RechartsTooltip
                        labelFormatter={(v) => formatDateCs(String(v))}
                        formatter={(value) => {
                          const n = typeof value === 'number' ? value : Number(value);
                          const label = Number.isFinite(n) ? `${n.toFixed(1)} kg` : '—';
                          return [label, 'Váha'];
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="weightKg"
                        name="Váha"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Kalorie (kcal / den)
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                {calorieChartData.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    Žádná data o kaloriích v období.
                  </Typography>
                ) : (
                  <ResponsiveContainer>
                    <ComposedChart data={calorieChartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: string) => dayjs(v).format('D. M.')}
                        minTickGap={24}
                      />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={44} />
                      <RechartsTooltip
                        labelFormatter={(v) => formatDateCs(String(v))}
                        formatter={(value) => {
                          const n = typeof value === 'number' ? value : Number(value);
                          const label = Number.isFinite(n) ? `${Math.round(n)} kcal` : '—';
                          return [label, 'Kalorie'];
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="caloriesKcal"
                        name="Kalorie"
                        stroke={theme.palette.secondary.main}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </Paper>
          </Stack>
        </Box>

        {dto.weeklyCheckins && dto.weeklyCheckins.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Weekly check-iny (přehled)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Week</TableCell>
                  <TableCell>Od – do</TableCell>
                  <TableCell align="right">Prům. váha</TableCell>
                  <TableCell align="right">Prům. kcal</TableCell>
                  <TableCell align="right">BF %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dto.weeklyCheckins.map((row: NutritionDashboardCheckinPointDto, i: number) => (
                  <TableRow key={`${row.weekIndex}-${row.weekStartDate}-${i}`}>
                    <TableCell>{row.weekIndex ?? '—'}</TableCell>
                    <TableCell>
                      {formatDateCs(row.weekStartDate)} – {formatDateCs(row.weekEndDate)}
                    </TableCell>
                    <TableCell align="right">{formatKg(row.avgWeightKg)}</TableCell>
                    <TableCell align="right">{formatKcal(row.avgCaloriesKcal)}</TableCell>
                    <TableCell align="right">
                      {row.bodyFatPercent != null && Number.isFinite(row.bodyFatPercent)
                        ? `${row.bodyFatPercent.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Stack>
    </LocalizationProvider>
  );
};
