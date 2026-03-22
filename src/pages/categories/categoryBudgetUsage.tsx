import type { BudgetPlanResponseDto } from '@api/model';
import { Box, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { formatWalletAmount } from '@pages/home/walletDisplay';
import { formatDateDdMmYyyy } from '@utils/dateTimeCs';
import { FC, ReactNode } from 'react';
import { budgetPeriodLabelCs } from './categoryBudgetPeriodLabels';

/** Platnost rozpočtu pro zobrazení (kalendářní řádek). */
export function formatBudgetValidityRange(validFrom?: string, validTo?: string): string {
  const fromRaw = validFrom?.trim() ? formatDateDdMmYyyy(validFrom) : '';
  const toRaw = validTo?.trim() ? formatDateDdMmYyyy(validTo) : '';
  const from = fromRaw && fromRaw !== '—' ? fromRaw : '';
  const to = toRaw && toRaw !== '—' ? toRaw : '';
  if (from && to) return `${from} – ${to}`;
  if (from) return `od ${from}`;
  if (to) return `do ${to}`;
  return '';
}

function budgetUsagePercent(amountMinor: number, spentMinor: number): number {
  if (amountMinor <= 0) return 0;
  return Math.min(100, (spentMinor / amountMinor) * 100);
}

function budgetTooltipContent(
  plan: BudgetPlanResponseDto,
  options: { showPlanName?: boolean; showPeriodType?: boolean },
): ReactNode {
  const amount = plan.amount ?? 0;
  const spent = plan.alreadySpent ?? 0;
  const currency = plan.currencyCode;
  const validity = formatBudgetValidityRange(plan.validFrom, plan.validTo);

  return (
    <Stack component="span" spacing={0.5} sx={{ py: 0.25, color: 'inherit' }}>
      {options.showPlanName && plan.name ? (
        <Typography component="span" variant="caption" display="block" fontWeight={600}>
          {plan.name}
        </Typography>
      ) : null}
      <Typography component="span" variant="caption" display="block" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatWalletAmount(spent, currency)} / {formatWalletAmount(amount, currency)}
      </Typography>
      {options.showPeriodType && plan.periodType ? (
        <Typography component="span" variant="caption" display="block" sx={{ opacity: 0.85 }}>
          {budgetPeriodLabelCs(plan.periodType)}
        </Typography>
      ) : null}
      {validity ? (
        <Typography component="span" variant="caption" display="block" sx={{ opacity: 0.85 }}>
          Platnost: {validity}
        </Typography>
      ) : null}
    </Stack>
  );
}

type UsageLineProps = {
  plan: BudgetPlanResponseDto;
  /** Typ období — v dialogu pod částkami; v tooltipu u varianty listRow volitelně */
  showPeriodType?: boolean;
  /**
   * `detail` — dialog (název, částky, pruh, platnost).
   * `listRow` — jen pruh v řádku kategorie, částky v tooltipu.
   */
  variant?: 'detail' | 'listRow';
  /** U `listRow`: název rozpočtu jen v tooltipu (např. když je víc rozpočtů) */
  tooltipShowPlanName?: boolean;
};

export const CategoryBudgetPlanUsageLine: FC<UsageLineProps> = ({
  plan,
  showPeriodType,
  variant = 'detail',
  tooltipShowPlanName,
}) => {
  const amount = plan.amount ?? 0;
  const spent = plan.alreadySpent ?? 0;
  const currency = plan.currencyCode;
  const overBudget = amount > 0 && spent > amount;
  const pct = budgetUsagePercent(amount, spent);
  const validity = formatBudgetValidityRange(plan.validFrom, plan.validTo);

  const bar = (
    <LinearProgress
      variant="determinate"
      value={overBudget ? 100 : pct}
      sx={{
        height: variant === 'listRow' ? 4 : 6,
        borderRadius: 1,
        width: '100%',
        ...(overBudget && {
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': { bgcolor: 'error.main' },
        }),
      }}
    />
  );

  if (variant === 'listRow') {
    return (
      <Tooltip
        title={budgetTooltipContent(plan, {
          showPlanName: tooltipShowPlanName,
          showPeriodType,
        })}
        placement="top"
        enterNextDelay={400}
      >
        <Box
          sx={{
            minWidth: 56,
            maxWidth: 112,
            flex: '1 1 64px',
            display: 'flex',
            alignItems: 'center',
            py: 0.25,
          }}
        >
          {bar}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap title={plan.name ?? undefined}>
            {plan.name ?? 'Rozpočet'}
          </Typography>
          {showPeriodType && plan.periodType ? (
            <Typography variant="caption" color="text.secondary" display="block">
              {budgetPeriodLabelCs(plan.periodType)}
            </Typography>
          ) : null}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'right',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {formatWalletAmount(spent, currency)} / {formatWalletAmount(amount, currency)}
        </Typography>
      </Stack>
      {bar}
      {validity ? (
        <Typography variant="caption" color="text.disabled">
          Platnost: {validity}
        </Typography>
      ) : null}
    </Stack>
  );
};
