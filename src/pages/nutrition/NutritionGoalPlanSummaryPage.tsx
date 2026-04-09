import { goalPlanFindById } from '@api/goal-plan-controller/goal-plan-controller';
import type { GoalPlanResponseDto } from '@api/model/goalPlanResponseDto';
import type { NutritionTargetResponseDto } from '@api/model/nutritionTargetResponseDto';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  formatG,
  formatKcal,
  formatKgPlain,
  formatPlanDate,
  formatPlanDateTime,
  goalTypeLabel,
  weeklyLabel,
} from './goalPlanShared';

function GoalPlanDetailPanel({ plan }: { plan: GoalPlanResponseDto }) {
  const nt: NutritionTargetResponseDto | undefined = plan.initialNutritionTarget;
  return (
    <Box sx={{ py: 1 }}>
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

/** Sekce 8 — souhrn plánu (detail z GET by id). */
export const NutritionGoalPlanSummaryPage: FC = () => {
  const { goalPlanId } = useParams<{ goalPlanId: string }>();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  const detailQuery = useQuery({
    queryKey: ['goalPlanFindById', trackerId, goalPlanId],
    enabled: !!trackerId && !!goalPlanId,
    queryFn: async (): Promise<GoalPlanResponseDto> => {
      const res = await goalPlanFindById(trackerId!, goalPlanId!);
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as GoalPlanResponseDto;
    },
  });

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
    return (
      <Typography color="error">Chybí ID plánu.</Typography>
    );
  }

  const plan = detailQuery.data;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <PageHeading component="h1" gutterBottom sx={{ mb: 0 }}>
          {plan?.name ?? 'Plán'}
        </PageHeading>
        <Button component={Link} to="/nutrition/goal-plan" variant="outlined" size="small">
          ← Moje plány
        </Button>
      </Stack>

      {detailQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : detailQuery.isError || !plan ? (
        <Typography color="error">Plán se nepodařilo načíst.</Typography>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, maxWidth: 920 }}>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {goalTypeLabel(plan.goalType)} · {formatPlanDate(plan.startDate)}
              {plan.endDate ? ` → ${formatPlanDate(plan.endDate)}` : ''}
            </Typography>
            {plan.active ? (
              <Typography variant="body2" color="primary" fontWeight={600}>
                Aktivní plán
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Neaktivní (archiv)
              </Typography>
            )}
          </Stack>
          <GoalPlanDetailPanel plan={plan} />
          <Box sx={{ mt: 2 }}>
            <Button component={Link} to="/nutrition/dashboard" variant="contained" size="small">
              Dashboard výživy
            </Button>
          </Box>
        </Paper>
      )}
    </Stack>
  );
};
