import {
  habitFindWeekOverview,
  getHabitFindWeekOverviewQueryKey,
  getHabitFindAgendaForDateQueryKey,
} from '@api/habit-controller/habit-controller';
import type { HabitAgendaItemDto } from '@api/model/habitAgendaItemDto';
import type { HabitCompletionStateDto } from '@api/model/habitCompletionStateDto';
import { HabitCompletionStateDtoStatus } from '@api/model/habitCompletionStateDtoStatus';
import { HabitCompletionUpsertRequestDtoStatus } from '@api/model/habitCompletionUpsertRequestDtoStatus';
import type { HabitDayOverviewDto } from '@api/model/habitDayOverviewDto';
import type { HabitWeekOverviewResponseDto } from '@api/model/habitWeekOverviewResponseDto';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { Box, Button, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import 'dayjs/locale/cs';
import { useSnackbar } from 'notistack';
import { Fragment, FC, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { completionStateToDialogStatus } from './habitCompletionMappers';
import { habitCompletionUpsertOrThrow } from './habitCompletionUpsertWithError';
import { parseOptionalMoneyKc } from './habitMoneyParse';
import { HabitCompletionFormDialog, type HabitCompletionDialogStatus } from './HabitCompletionFormDialog';
import { normalizeHabitScore } from './HabitScoreRating';
import { normalizeDayBlocks } from './habitDayOverviewNormalize';
import { HABIT_BLOCK_LABELS, HABIT_DAY_LABELS, HABIT_DAY_BLOCKS_ORDER } from './habitUiConstants';

dayjs.extend(isoWeek);

function getAgendaItem(
  day: HabitDayOverviewDto | undefined,
  block: (typeof HABIT_DAY_BLOCKS_ORDER)[number],
  habitId: string,
): HabitAgendaItemDto | undefined {
  if (!day) {
    return undefined;
  }
  const normalized = normalizeDayBlocks(day);
  const b = normalized.find((x) => x.dayBlock === block);
  return b?.items?.find((i) => i.habitId === habitId);
}

function buildHabitRowsForBlock(
  days: HabitDayOverviewDto[],
  block: (typeof HABIT_DAY_BLOCKS_ORDER)[number],
): { habitId: string; name: string; sortKey: number }[] {
  const acc = new Map<string, { name: string; sortKey: number }>();
  for (const d of days) {
    const normalized = normalizeDayBlocks(d);
    const b = normalized.find((x) => x.dayBlock === block);
    for (const item of b?.items ?? []) {
      const id = item.habitId;
      if (!id) {
        continue;
      }
      const so = item.sortOrder ?? 0;
      const prev = acc.get(id);
      if (!prev) {
        acc.set(id, { name: item.name ?? '', sortKey: so });
      } else {
        acc.set(id, {
          name: prev.name || item.name || '',
          sortKey: Math.min(prev.sortKey, so),
        });
      }
    }
  }
  return [...acc.entries()]
    .map(([habitId, v]) => ({ habitId, name: v.name, sortKey: v.sortKey }))
    .sort((a, b) =>
      a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.name.localeCompare(b.name, 'cs'),
    );
}

type CellIndicator = {
  icon: 'check' | 'half' | 'skip' | 'miss' | 'pending' | 'none';
  title: string;
  bg: string;
  fg: string;
};

function weekCellIndicator(item: HabitAgendaItemDto | undefined): CellIndicator {
  if (!item) {
    return { icon: 'none', title: 'Není naplánováno', bg: 'transparent', fg: 'text.disabled' };
  }
  const st = item.completion?.status;
  if (st === HabitCompletionStateDtoStatus.DONE) {
    return { icon: 'check', title: 'Splněno', bg: 'success.main', fg: '#fff' };
  }
  if (st === HabitCompletionStateDtoStatus.PARTIALLY_COMPLETED) {
    return { icon: 'half', title: 'Částečně splněno', bg: 'info.main', fg: '#fff' };
  }
  if (st === HabitCompletionStateDtoStatus.SKIPPED) {
    return { icon: 'skip', title: 'Přeskočeno', bg: 'warning.main', fg: '#fff' };
  }
  if (st === HabitCompletionStateDtoStatus.MISSED) {
    return { icon: 'miss', title: 'Zmeškáno', bg: 'error.main', fg: '#fff' };
  }
  return { icon: 'pending', title: 'Naplánováno, bez záznamu', bg: 'action.disabledBackground', fg: 'text.disabled' };
}

const STATUS_ICON_MAP = {
  check: <CheckRoundedIcon sx={{ fontSize: 14 }} />,
  half: <RemoveRoundedIcon sx={{ fontSize: 14 }} />,
  skip: <Typography component="span" sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>S</Typography>,
  miss: <CloseRoundedIcon sx={{ fontSize: 14 }} />,
  pending: null,
  none: null,
} as const;

type CellDialogState = {
  habitId: string;
  habitName: string;
  date: string;
  completion: HabitCompletionStateDto | undefined;
};

const BLOCK_ACCENT_COLORS: Record<(typeof HABIT_DAY_BLOCKS_ORDER)[number], string> = {
  [HABIT_DAY_BLOCKS_ORDER[0]]: 'warning.main',
  [HABIT_DAY_BLOCKS_ORDER[1]]: 'info.main',
  [HABIT_DAY_BLOCKS_ORDER[2]]: 'success.main',
  [HABIT_DAY_BLOCKS_ORDER[3]]: 'secondary.main',
  [HABIT_DAY_BLOCKS_ORDER[4]]: 'primary.main',
};

const WeekGrid: FC<{
  sortedDays: HabitDayOverviewDto[];
  todayStr: string;
  openCellDialog: (
    habitId: string,
    habitName: string,
    date: string,
    completion: HabitCompletionStateDto | undefined,
  ) => void;
}> = ({ sortedDays, todayStr, openCellDialog }) => {
  const theme = useTheme();
  const totalCols = sortedDays.length + 1;
  const colTemplate = `minmax(120px, 1.8fr) repeat(${sortedDays.length}, minmax(38px, 1fr))`;

  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: colTemplate,
          minWidth: 560,
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <Box
          sx={{
            gridColumn: '1',
            p: 1.5,
            display: 'flex',
            alignItems: 'flex-end',
            bgcolor: '#14182c',
          }}
        />
        {sortedDays.map((d) => {
          const ds = d.date ?? '';
          const isToday = ds === todayStr;
          const dow = d.dayOfWeek;
          const dowLabel =
            dow && dow in HABIT_DAY_LABELS
              ? HABIT_DAY_LABELS[dow as keyof typeof HABIT_DAY_LABELS]
              : '';
          const dateShort = ds ? dayjs(ds).locale('cs').format('D. M.') : '';
          return (
            <Box
              key={ds}
              sx={{
                textAlign: 'center',
                py: 1,
                px: 0.5,
                position: 'relative',
                bgcolor: isToday ? '#1c2138' : '#14182c',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isToday ? 'primary.main' : 'text.secondary',
                  display: 'block',
                  lineHeight: 1.4,
                }}
              >
                {dowLabel}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'text.primary' : 'text.secondary',
                  lineHeight: 1.4,
                }}
              >
                {dateShort}
              </Typography>
            </Box>
          );
        })}

        {/* Separator under header */}
        <Box sx={{ gridColumn: `1 / ${totalCols + 1}`, borderBottom: 1, borderColor: 'divider' }} />

        {/* Blocks */}
        {HABIT_DAY_BLOCKS_ORDER.map((block) => {
          const rows = buildHabitRowsForBlock(sortedDays, block);
          const accent = BLOCK_ACCENT_COLORS[block];
          return (
            <Fragment key={block}>
              {/* Block section header - spans full width */}
              <Box
                sx={{
                  gridColumn: `1 / ${totalCols + 1}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  bgcolor: 'action.hover',
                }}
              >
                <Box
                  sx={{
                    width: 4,
                    height: 18,
                    borderRadius: 1,
                    bgcolor: accent,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: accent,
                    lineHeight: 1,
                  }}
                >
                  {HABIT_BLOCK_LABELS[block]}
                </Typography>
              </Box>

              {rows.length === 0 ? (
                <Box
                  sx={{
                    gridColumn: `1 / ${totalCols + 1}`,
                    px: 2,
                    py: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: '#222a3c',
                  }}
                >
                  <Typography variant="caption" color="text.disabled">
                    Žádné návyky
                  </Typography>
                </Box>
              ) : (
                rows.map((row, rowIdx) => (
                  <Fragment key={`${block}-${row.habitId}`}>
                    {/* Habit name cell */}
                    <Box
                      sx={{
                        px: 1.5,
                        py: 1,
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: rowIdx === rows.length - 1 ? 1 : 0,
                        borderColor: 'divider',
                        bgcolor: '#222a3c',
                      }}
                    >
                      <Typography
                        component={Link}
                        to={`/habits/${row.habitId}`}
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: 'text.primary',
                          textDecoration: 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        {row.name || '—'}
                      </Typography>
                    </Box>

                    {/* Day cells */}
                    {sortedDays.map((d) => {
                      const ds = d.date ?? '';
                      const isToday = ds === todayStr;
                      const item = getAgendaItem(d, block, row.habitId);
                      const ind = weekCellIndicator(item);
                      const scheduled = Boolean(item);
                      const icon = STATUS_ICON_MAP[ind.icon];
                      return (
                        <Box
                          key={`${row.habitId}-${ds}`}
                          onClick={() => {
                            if (!scheduled || !row.habitId || !ds) return;
                            openCellDialog(row.habitId, row.name, ds, item?.completion);
                          }}
                          title={ind.title}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            py: 1,
                            cursor: scheduled ? 'pointer' : 'default',
                            borderBottom: rowIdx === rows.length - 1 ? 1 : 0,
                            borderColor: 'divider',
                            transition: 'background-color 0.1s',
                            bgcolor: isToday ? '#2a3348' : '#222a3c',
                            '&:hover': scheduled
                              ? { bgcolor: 'action.hover' }
                              : {},
                          }}
                        >
                          {ind.icon === 'none' ? (
                            <Typography
                              component="span"
                              sx={{ color: 'text.disabled', fontSize: '0.75rem' }}
                            >
                              –
                            </Typography>
                          ) : (
                            <Box
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                bgcolor: ind.bg,
                                color: ind.fg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'transform 0.15s',
                                ...(scheduled
                                  ? {
                                      '&:hover': {
                                        transform: 'scale(1.15)',
                                        boxShadow: (t: typeof theme) =>
                                          `0 0 0 3px ${t.palette.action.focus}`,
                                      },
                                    }
                                  : {}),
                              }}
                            >
                              {icon}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </Fragment>
          );
        })}
      </Box>
    </Box>
  );
};

export const HabitWeekOverviewPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id ?? '';
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [weekAnchor, setWeekAnchor] = useState(() => dayjs().startOf('isoWeek'));
  const weekStartStr = weekAnchor.format('YYYY-MM-DD');
  const todayStr = dayjs().format('YYYY-MM-DD');

  const [cellDialog, setCellDialog] = useState<CellDialogState | null>(null);
  const [dialogStatus, setDialogStatus] = useState<HabitCompletionDialogStatus>(
    HabitCompletionUpsertRequestDtoStatus.DONE,
  );
  const [dialogNote, setDialogNote] = useState('');
  const [dialogSatisfactionScore, setDialogSatisfactionScore] = useState(0);
  const [dialogExecutionScore, setDialogExecutionScore] = useState(0);
  const [dialogActualPrice, setDialogActualPrice] = useState('');

  const weekQuery = useQuery({
    queryKey: getHabitFindWeekOverviewQueryKey(trackerId, { weekStart: weekStartStr }),
    enabled: !!trackerId,
    queryFn: async ({ signal }) => {
      const res = await habitFindWeekOverview(trackerId, { weekStart: weekStartStr }, { signal });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as HabitWeekOverviewResponseDto;
    },
  });

  const sortedDays = useMemo(() => {
    const list = weekQuery.data?.days ?? [];
    return [...list].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }, [weekQuery.data?.days]);

  const weekLabel = useMemo(() => {
    const ws = weekQuery.data?.weekStart ?? weekStartStr;
    const we = weekQuery.data?.weekEnd;
    const a = dayjs(ws).locale('cs').format('D. M. YYYY');
    const b = we ? dayjs(we).locale('cs').format('D. M. YYYY') : '';
    return b ? `${a} — ${b}` : a;
  }, [weekQuery.data?.weekEnd, weekQuery.data?.weekStart, weekStartStr]);

  const invalidateWeek = () =>
    queryClient.invalidateQueries({
      queryKey: getHabitFindWeekOverviewQueryKey(trackerId, { weekStart: weekStartStr }),
    });

  const upsertMutation = useMutation({
    mutationFn: async (input: {
      habitId: string;
      date: string;
      status: HabitCompletionDialogStatus;
      note?: string;
      satisfactionScore: number;
      executionScore: number;
      actualPrice: string;
    }) => {
      const price = parseOptionalMoneyKc(input.actualPrice);
      await habitCompletionUpsertOrThrow(trackerId, {
        habitId: input.habitId,
        date: input.date,
        status: input.status,
        note: input.note?.trim() || undefined,
        satisfactionScore: normalizeHabitScore(input.satisfactionScore),
        executionScore: normalizeHabitScore(input.executionScore),
        ...(price != null ? { actualPrice: price } : {}),
      });
    },
    onSuccess: async (_, vars) => {
      await invalidateWeek();
      await queryClient.invalidateQueries({
        queryKey: getHabitFindAgendaForDateQueryKey(trackerId, { date: vars.date }),
      });
      enqueueSnackbar('Stav uložen', { variant: 'success' });
      setCellDialog(null);
      setDialogNote('');
      setDialogSatisfactionScore(0);
      setDialogExecutionScore(0);
      setDialogActualPrice('');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && err.message.trim() ? err.message.trim() : 'Uložení se nezdařilo';
      enqueueSnackbar(msg, { variant: 'error' });
    },
  });

  const openCellDialog = (
    habitId: string,
    habitName: string,
    date: string,
    completion: HabitCompletionStateDto | undefined,
  ) => {
    setDialogStatus(completionStateToDialogStatus(completion?.status));
    setDialogNote(completion?.note ?? '');
    setDialogSatisfactionScore(normalizeHabitScore(completion?.satisfactionScore));
    setDialogExecutionScore(normalizeHabitScore(completion?.executionScore));
    setDialogActualPrice(completion?.actualPrice != null ? String(completion.actualPrice) : '');
    setCellDialog({ habitId, habitName, date, completion });
  };

  const submitDialog = () => {
    if (!cellDialog) {
      return;
    }
    upsertMutation.mutate({
      habitId: cellDialog.habitId,
      date: cellDialog.date,
      status: dialogStatus,
      note: dialogNote,
      satisfactionScore: dialogSatisfactionScore,
      executionScore: dialogExecutionScore,
      actualPrice: dialogActualPrice,
    });
  };

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Týdenní přehled
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

  const isCurrentWeek = weekAnchor.isSame(dayjs(), 'isoWeek');

  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        Týdenní přehled
      </PageHeading>

      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <IconButton aria-label="Předchozí týden" onClick={() => setWeekAnchor((w) => w.subtract(1, 'week'))}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="body1" fontWeight={600} sx={{ minWidth: 200 }}>
          {weekLabel}
        </Typography>
        <IconButton aria-label="Další týden" onClick={() => setWeekAnchor((w) => w.add(1, 'week'))}>
          <ChevronRightIcon />
        </IconButton>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setWeekAnchor(dayjs().startOf('isoWeek'))}
          disabled={isCurrentWeek}
        >
          Tento týden
        </Button>
      </Stack>

      {weekQuery.isLoading && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          Načítám…
        </Typography>
      )}
      {weekQuery.isError && (
        <Typography color="error" sx={{ py: 2 }}>
          Přehled se nepodařilo načíst.
        </Typography>
      )}

      {!weekQuery.isLoading && !weekQuery.isError && sortedDays.length > 0 && (
        <WeekGrid
          sortedDays={sortedDays}
          todayStr={todayStr}
          openCellDialog={openCellDialog}
        />
      )}

      {!weekQuery.isLoading && !weekQuery.isError && sortedDays.length === 0 && (
        <Typography color="text.secondary">Žádná data pro tento týden.</Typography>
      )}

      <HabitCompletionFormDialog
        open={cellDialog != null}
        onClose={() => !upsertMutation.isPending && setCellDialog(null)}
        title={cellDialog?.habitName ?? 'Návyk'}
        subtitle={
          cellDialog?.date ? dayjs(cellDialog.date).locale('cs').format('dddd D. M. YYYY') : undefined
        }
        completedAtCaption={
          cellDialog?.completion?.completedAt
            ? `Dokončeno: ${dayjs(cellDialog.completion.completedAt).locale('cs').format('D. M. YYYY HH:mm')}`
            : null
        }
        status={dialogStatus}
        onStatusChange={setDialogStatus}
        note={dialogNote}
        onNoteChange={setDialogNote}
        satisfactionScore={dialogSatisfactionScore}
        onSatisfactionScoreChange={setDialogSatisfactionScore}
        executionScore={dialogExecutionScore}
        onExecutionScoreChange={setDialogExecutionScore}
        actualPrice={dialogActualPrice}
        onActualPriceChange={setDialogActualPrice}
        onSubmit={submitDialog}
        submitting={upsertMutation.isPending}
      />
    </Box>
  );
};
