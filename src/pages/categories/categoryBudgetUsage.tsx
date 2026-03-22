import type { BudgetPlanResponseDto } from '@api/model';
import { Box, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { formatWalletAmount } from '@pages/home/walletDisplay';
import { formatDateDdMmYyyy } from '@utils/dateTimeCs';
import { FC } from 'react';
import { budgetPeriodLabelCs } from './categoryBudgetPeriodLabels';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

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

/** Kompaktní řádek: `01.03.–31.03.2026` nebo s plnými roky. */
function formatBudgetDateRangeCompact(validFrom?: string, validTo?: string): string {
  const parse = (s?: string) => (s?.trim() ? new Date(s) : null);
  const a = parse(validFrom);
  const b = parse(validTo);
  const ok = (d: Date | null) => Boolean(d && !Number.isNaN(d.getTime()));
  const fmtFull = (d: Date) =>
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  const fmtDm = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
  if (ok(a) && ok(b)) {
    const sameY = a!.getFullYear() === b!.getFullYear();
    if (sameY) return `${fmtDm(a!)}–${fmtDm(b!)}${a!.getFullYear()}`;
    return `${fmtFull(a!)}–${fmtFull(b!)}`;
  }
  if (ok(a)) return `od ${fmtFull(a!)}`;
  if (ok(b)) return `do ${fmtFull(b!)}`;
  return '';
}

/**
 * Počet kalendářních dnů od max(dnes, platnost od) do platnost do (včetně).
 * Bez `validTo` vrací 0 (nelze odvodit tempo „na den“).
 */
export function budgetDaysLeftInclusive(validFrom?: string, validTo?: string): number {
  const to = validTo?.trim();
  if (!to) return 0;
  const end = startOfLocalDay(new Date(to));
  if (Number.isNaN(end.getTime())) return 0;

  const today = startOfLocalDay(new Date());
  const fromParsed = validFrom?.trim() ? startOfLocalDay(new Date(validFrom)) : null;
  const rangeStart =
    fromParsed && !Number.isNaN(fromParsed.getTime()) ? fromParsed : today;

  const effectiveStart = today > rangeStart ? today : rangeStart;
  if (effectiveStart > end) return 0;
  return Math.floor((end.getTime() - effectiveStart.getTime()) / 86_400_000) + 1;
}

function budgetUsagePercent(amountMinor: number, spentMinor: number): number {
  if (amountMinor <= 0) return 0;
  return Math.min(100, (spentMinor / amountMinor) * 100);
}

/** Kompaktní „trubička“ — výšku řádku pořád dávají ikony/chip. */
function BudgetUsageTube(props: { fillPercent: number; overBudget: boolean }) {
  const { fillPercent, overBudget } = props;
  const w = Math.min(100, Math.max(0, fillPercent));
  return (
    <Box
      sx={{
        width: '100%',
        height: 12,
        borderRadius: 999,
        overflow: 'hidden',
        bgcolor: (t) => alpha(t.palette.action.hover, t.palette.mode === 'dark' ? 0.45 : 1),
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: (t) => `inset 0 2px 5px ${alpha(t.palette.common.black, 0.08)}`,
      }}
    >
      <Box
        sx={{
          height: '100%',
          width: `${w}%`,
          borderRadius: 999,
          bgcolor: overBudget ? 'error.main' : 'primary.main',
          boxShadow: (t) => `inset 0 1px 0 ${alpha(t.palette.common.white, 0.28)}`,
          transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.shorter }),
        }}
      />
    </Box>
  );
}

function budgetListRowCaption(plan: BudgetPlanResponseDto): { text: string; title: string } {
  const amount = plan.amount ?? 0;
  const spent = plan.alreadySpent ?? 0;
  const currency = plan.currencyCode;
  const remaining = amount - spent;
  const period = formatBudgetDateRangeCompact(plan.validFrom, plan.validTo);
  const daysLeft = budgetDaysLeftInclusive(plan.validFrom, plan.validTo);

  let perDen: string;
  if (daysLeft <= 0 || !plan.validTo?.trim()) {
    perDen = '—';
  } else {
    const perDayMinor = Math.round(remaining / daysLeft);
    perDen = `${formatWalletAmount(perDayMinor, currency)}/den`;
  }

  const parts: string[] = [];
  if (period) parts.push(period);
  parts.push(`${formatWalletAmount(spent, currency)} / ${formatWalletAmount(amount, currency)}`);
  parts.push(`zbývá ${formatWalletAmount(remaining, currency)}`);
  parts.push(perDen);

  const text = parts.join(' · ');
  return { text, title: text };
}

type UsageLineProps = {
  plan: BudgetPlanResponseDto;
  showPeriodType?: boolean;
  variant?: 'detail' | 'listRow';
};

export const CategoryBudgetPlanUsageLine: FC<UsageLineProps> = ({
  plan,
  showPeriodType,
  variant = 'detail',
}) => {
  const amount = plan.amount ?? 0;
  const spent = plan.alreadySpent ?? 0;
  const overBudget = amount > 0 && spent > amount;
  const pct = budgetUsagePercent(amount, spent);
  const validity = formatBudgetValidityRange(plan.validFrom, plan.validTo);
  const tubeFill = overBudget ? 100 : pct;

  if (variant === 'listRow') {
    const { text, title } = budgetListRowCaption(plan);
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          flex: '1 1 0%',
          minWidth: 0,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          title={title}
          sx={{
            flex: '1 1 auto',
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.25,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {text}
        </Typography>
        <Box
          sx={{
            width: 88,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <BudgetUsageTube fillPercent={tubeFill} overBudget={overBudget} />
        </Box>
      </Stack>
    );
  }

  const bar = (
    <LinearProgress
      variant="determinate"
      value={overBudget ? 100 : pct}
      sx={{
        height: 6,
        borderRadius: 1,
        width: '100%',
        ...(overBudget && {
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': { bgcolor: 'error.main' },
        }),
      }}
    />
  );

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
          {formatWalletAmount(spent, plan.currencyCode)} / {formatWalletAmount(amount, plan.currencyCode)}
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
