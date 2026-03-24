import type { BudgetPlanResponseDto } from '@api/model';
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { formatWalletAmount } from '@pages/home/walletDisplay';
import { formatDateDdMmYyyy } from '@utils/dateTimeCs';
import { minorUnitsToMajor } from '@utils/moneyMinorUnits';
import { FC, Fragment } from 'react';
import { budgetPeriodLabelCs, budgetPlanPeriodChipSx } from './categoryBudgetPeriodLabels';

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

/** Jen `dd.MM.–dd.MM.` (bez roku při stejném roce) — pro řádek kategorie. */
function formatBudgetDateRangeDdMmOnly(validFrom?: string, validTo?: string): string {
  const parse = (s?: string) => (s?.trim() ? new Date(s) : null);
  const a = parse(validFrom);
  const b = parse(validTo);
  const ok = (d: Date | null) => Boolean(d && !Number.isNaN(d.getTime()));
  const fmtFull = (d: Date) =>
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  const fmtDm = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
  if (ok(a) && ok(b)) {
    const sameY = a!.getFullYear() === b!.getFullYear();
    if (sameY) return `${fmtDm(a!)}–${fmtDm(b!)}`;
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

function daysInCurrentLocalMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

/**
 * Limit rozpočtu přepočtený na běžný kalendářní měsíc (minor units).
 * Denní × počet dní v tomto měsíci, týdenní × (dny v měsíci / 7), měsíčně/čtvrtletně/ročně jako v součtech kategorií.
 */
export function budgetAmountToMonthlyEquivalentMinor(
  amountMinor: number,
  periodType: string | undefined,
  intervalValue = 1,
): number {
  if (!Number.isFinite(amountMinor)) return 0;
  const n = intervalValue == null || intervalValue < 1 ? 1 : Math.floor(intervalValue);
  const days = daysInCurrentLocalMonth();
  const weeksInMonth = days / 7;
  switch (periodType) {
    case 'DAILY':
      return Math.round((amountMinor * days) / n);
    case 'WEEKLY':
      return Math.round((amountMinor * weeksInMonth) / n);
    case 'MONTHLY':
      return Math.round(amountMinor / n);
    case 'QUARTERLY':
      return Math.round(amountMinor / (3 * n));
    case 'YEARLY':
      return Math.round(amountMinor / (12 * n));
    default:
      return 0;
  }
}

/** Čísla v liště bez desetin (celé jednotky); přesnost je v `title` / tooltipu. */
function formatBudgetBarAmountPairCs(spentMinor: number, limitMinor: number): string {
  const fmt = (minor: number) => {
    const major = minorUnitsToMajor(minor) ?? 0;
    return new Intl.NumberFormat('cs-CZ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(major));
  };
  return `${fmt(spentMinor)}/${fmt(limitMinor)}`;
}

/** Plnicí lišta s čísly uvnitř (bez měny); žádné svislé okraje navíc. */
function BudgetUsageBarInlineAmounts(props: {
  fillPercent: number;
  overBudget: boolean;
  incomeOverBudget?: boolean;
  spentMinor: number;
  limitMinor: number;
}) {
  const { fillPercent, overBudget, incomeOverBudget = false, spentMinor, limitMinor } = props;
  const w = Math.min(100, Math.max(0, fillPercent));
  const label = formatBudgetBarAmountPairCs(spentMinor, limitMinor);
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: 20,
        borderRadius: 999,
        overflow: 'hidden',
        bgcolor: (t) =>
          incomeOverBudget
            ? alpha(t.palette.warning.light, t.palette.mode === 'dark' ? 0.4 : 0.32)
            : alpha(t.palette.action.hover, t.palette.mode === 'dark' ? 0.45 : 1),
        border: '1px solid',
        borderColor: incomeOverBudget ? 'warning.light' : 'divider',
        boxShadow: (t) => `inset 0 2px 5px ${alpha(t.palette.common.black, 0.08)}`,
        flex: 1,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${w}%`,
          borderRadius: 999,
          bgcolor: incomeOverBudget ? 'warning.main' : overBudget ? 'error.main' : 'primary.main',
          boxShadow: (t) => `inset 0 1px 0 ${alpha(t.palette.common.white, 0.28)}`,
          transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.shorter }),
        }}
      />
      <Typography
        variant="caption"
        component="div"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          fontSize: '0.68rem',
          fontWeight: 700,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 0.02,
          whiteSpace: 'nowrap',
          px: 0.75,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          pointerEvents: 'none',
          color: 'text.primary',
          textShadow: (t) =>
            t.palette.mode === 'dark'
              ? `0 0 5px ${t.palette.background.paper}, 0 0 8px ${t.palette.common.black}`
              : `0 0 4px ${t.palette.background.paper}, 0 1px 2px ${alpha(t.palette.common.white, 0.95)}`,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function budgetListRowSegments(plan: BudgetPlanResponseDto): {
  spentVsLimit: string;
  remainingText: string;
  periodDdMm: string;
  periodBadge: string;
  perDay: string;
  title: string;
} {
  const amount = plan.amount ?? 0;
  const spent = plan.alreadySpent ?? 0;
  const currency = plan.currencyCode;
  const remaining = amount - spent;
  const periodDdMm = formatBudgetDateRangeDdMmOnly(plan.validFrom, plan.validTo);
  const daysLeft = budgetDaysLeftInclusive(plan.validFrom, plan.validTo);

  const spentVsLimit = `${formatWalletAmount(spent, currency)} / ${formatWalletAmount(amount, currency)}`;
  const remainingText = `zbývá ${formatWalletAmount(remaining, currency)}`;
  const periodBadge = plan.periodType
    ? budgetPeriodLabelCs(plan.periodType).toLocaleUpperCase('cs-CZ')
    : '—';

  let perDay: string;
  if (daysLeft <= 0 || !plan.validTo?.trim()) {
    perDay = '—';
  } else {
    const perDayMinor = Math.round(remaining / daysLeft);
    perDay = `${formatWalletAmount(perDayMinor, currency)}/den`;
  }

  const detailTitle = [`${spentVsLimit} ${periodBadge} · ${remainingText}`, periodDdMm || null, perDay]
    .filter(Boolean)
    .join(' · ');

  const monthlyLine = plan.periodType
    ? `Přepočet na měsíc: ${formatWalletAmount(
        budgetAmountToMonthlyEquivalentMinor(amount, plan.periodType, 1),
        currency,
      )}`
    : null;

  const title = monthlyLine ? `${monthlyLine}\n${detailTitle}` : detailTitle;
  return { spentVsLimit, remainingText, periodDdMm, periodBadge, perDay, title };
}

/** Sloupce řádku kategorie: trubice+částky | období | zbývá | platnost | /den (zarovnání napříč řádky). */
export const CATEGORY_BUDGET_LIST_ROW_GRID_INNER =
  'minmax(0, 1fr) 96px 132px 110px 120px' as const;

type UsageLineProps = {
  plan: BudgetPlanResponseDto;
  categoryKind?: 'INCOME' | 'EXPENSE';
  showPeriodType?: boolean;
  variant?: 'detail' | 'listRow';
  /** Když `true` u `listRow`, vrátí 5 sourozenců pro vložení do rodičovského CSS gridu (bez obalujícího Stacku). */
  gridCells?: boolean;
};

export const CategoryBudgetPlanUsageLine: FC<UsageLineProps> = ({
  plan,
  categoryKind,
  showPeriodType,
  variant = 'detail',
  gridCells = false,
}) => {
  const amount = plan.amount ?? 0;
  const spent = plan.alreadySpent ?? 0;
  const overBudget = amount > 0 && spent > amount;
  const incomeOverBudget = overBudget && categoryKind === 'INCOME';
  const pct = budgetUsagePercent(amount, spent);
  const validity = formatBudgetValidityRange(plan.validFrom, plan.validTo);
  const tubeFill = overBudget ? 100 : pct;

  if (variant === 'listRow') {
    const { spentVsLimit, remainingText, periodDdMm, periodBadge, perDay, title } = budgetListRowSegments(plan);
    const captionBase = {
      variant: 'caption' as const,
      color: 'text.secondary' as const,
    };
    const captionTypo = {
      lineHeight: 1.25,
      fontVariantNumeric: 'tabular-nums' as const,
      whiteSpace: 'nowrap' as const,
    };

    if (gridCells) {
      const cur = (plan.currencyCode ?? 'CZK').toUpperCase();
      return (
        <Fragment>
          <Box
            title={title}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <BudgetUsageBarInlineAmounts
              fillPercent={tubeFill}
              overBudget={overBudget}
              incomeOverBudget={incomeOverBudget}
              spentMinor={spent}
              limitMinor={amount}
            />
            <Typography
              {...captionBase}
              sx={{
                ...captionTypo,
                flexShrink: 0,
                fontWeight: 600,
                letterSpacing: 0.3,
              }}
            >
              {cur}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: 0, alignItems: 'center' }}>
            <Chip
              size="small"
              variant="outlined"
              label={periodBadge}
              sx={(theme) => ({
                height: 18,
                maxWidth: '100%',
                ...budgetPlanPeriodChipSx(theme, plan.periodType),
                '& .MuiChip-label': {
                  px: 0.8,
                  fontSize: '0.62rem',
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                },
              })}
            />
          </Box>
          <Typography
            {...captionBase}
            sx={{
              ...captionTypo,
              justifySelf: 'end',
              textAlign: 'right',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {remainingText}
          </Typography>
          <Typography
            {...captionBase}
            sx={{
              ...captionTypo,
              textAlign: 'center',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {periodDdMm || '—'}
          </Typography>
          <Typography
            {...captionBase}
            sx={{
              ...captionTypo,
              justifySelf: 'end',
              textAlign: 'right',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {perDay}
          </Typography>
        </Fragment>
      );
    }

    const curStack = (plan.currencyCode ?? 'CZK').toUpperCase();
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        title={title}
        sx={{
          flex: '1 1 0%',
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flex: '1 1 0%',
            minWidth: 96,
            maxWidth: '100%',
          }}
        >
          <BudgetUsageBarInlineAmounts
            fillPercent={tubeFill}
            overBudget={overBudget}
            incomeOverBudget={incomeOverBudget}
            spentMinor={spent}
            limitMinor={amount}
          />
          <Typography
            {...captionBase}
            sx={{
              ...captionTypo,
              flexShrink: 0,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            {curStack}
          </Typography>
        </Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{
            flex: '0 1 auto',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Chip
            size="small"
            variant="outlined"
            label={periodBadge}
            sx={(theme) => ({
              height: 18,
              ...budgetPlanPeriodChipSx(theme, plan.periodType),
              '& .MuiChip-label': {
                px: 0.8,
                fontSize: '0.62rem',
                letterSpacing: 0.2,
                textTransform: 'uppercase',
              },
            })}
          />
          <Typography
            {...captionBase}
            sx={{
              ...captionTypo,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            · {remainingText}
          </Typography>
        </Stack>
        {periodDdMm ? (
          <Typography {...captionBase} sx={{ ...captionTypo, flexShrink: 0 }}>
            {periodDdMm}
          </Typography>
        ) : null}
        <Typography {...captionBase} sx={{ ...captionTypo, flexShrink: 0 }}>
          {perDay}
        </Typography>
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
          bgcolor: incomeOverBudget ? 'warning.light' : 'action.hover',
          '& .MuiLinearProgress-bar': { bgcolor: incomeOverBudget ? 'warning.main' : 'error.main' },
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
