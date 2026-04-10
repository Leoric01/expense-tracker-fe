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
import { Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
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

function weekCellGlyph(
  item: HabitAgendaItemDto | undefined,
): { char: string; title: string; sx: Record<string, unknown> } {
  if (!item) {
    return {
      char: '–',
      title: 'Není naplánováno',
      sx: { color: 'text.disabled', fontSize: '1.1rem', fontWeight: 600 },
    };
  }
  const st = item.completion?.status;
  if (st === HabitCompletionStateDtoStatus.DONE) {
    return {
      char: '✓',
      title: 'Splněno',
      sx: { color: 'success.main', fontSize: '1.2rem', fontWeight: 700 },
    };
  }
  if (st === HabitCompletionStateDtoStatus.PARTIALLY_COMPLETED) {
    return {
      char: '◐',
      title: 'Částečně splněno',
      sx: { color: 'info.main', fontSize: '1.2rem', fontWeight: 700 },
    };
  }
  if (st === HabitCompletionStateDtoStatus.SKIPPED) {
    return {
      char: '↷',
      title: 'Přeskočeno',
      sx: { color: 'warning.main', fontSize: '1.2rem', fontWeight: 700 },
    };
  }
  if (st === HabitCompletionStateDtoStatus.MISSED) {
    return {
      char: '✕',
      title: 'Zmeškáno',
      sx: { color: 'error.main', fontSize: '1.05rem', fontWeight: 700 },
    };
  }
  return {
    char: '○',
    title: 'Naplánováno, bez záznamu',
    sx: { color: 'text.disabled', fontSize: '1.1rem', fontWeight: 700 },
  };
}

type CellDialogState = {
  habitId: string;
  habitName: string;
  date: string;
  completion: HabitCompletionStateDto | undefined;
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
    setDialogActualPrice(
      completion?.actualPrice != null && completion.actualPrice !== 0
        ? String(completion.actualPrice)
        : '',
    );
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
        <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 160, fontWeight: 700 }}>Návyk</TableCell>
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
                    <TableCell
                      key={ds}
                      align="center"
                      sx={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        ...(isToday
                          ? {
                              bgcolor: 'action.selected',
                              boxShadow: (t) => `inset 0 3px 0 0 ${t.palette.primary.main}`,
                            }
                          : {}),
                      }}
                    >
                      <Typography variant="caption" display="block" color="text.secondary">
                        {dowLabel}
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {dateShort}
                      </Typography>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {HABIT_DAY_BLOCKS_ORDER.map((block) => {
                const rows = buildHabitRowsForBlock(sortedDays, block);
                return (
                  <Fragment key={block}>
                    <TableRow>
                      <TableCell
                        colSpan={sortedDays.length + 1}
                        sx={{
                          bgcolor: 'action.hover',
                          py: 1,
                          fontWeight: 700,
                          borderBottom: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {HABIT_BLOCK_LABELS[block]}
                      </TableCell>
                    </TableRow>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={sortedDays.length + 1}>
                          <Typography variant="body2" color="text.secondary">
                            V tomto bloku tento týden žádné návyky
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={`${block}-${row.habitId}`} hover>
                          <TableCell sx={{ verticalAlign: 'middle' }}>
                            <Typography
                              component={Link}
                              to={`/habits/${row.habitId}`}
                              variant="body2"
                              fontWeight={600}
                              sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {row.name || '—'}
                            </Typography>
                          </TableCell>
                          {sortedDays.map((d) => {
                            const ds = d.date ?? '';
                            const isToday = ds === todayStr;
                            const item = getAgendaItem(d, block, row.habitId);
                            const g = weekCellGlyph(item);
                            const scheduled = Boolean(item);
                            return (
                              <TableCell
                                key={`${row.habitId}-${ds}`}
                                align="center"
                                onClick={() => {
                                  if (!scheduled || !row.habitId || !ds) {
                                    return;
                                  }
                                  openCellDialog(row.habitId, row.name, ds, item?.completion);
                                }}
                                sx={{
                                  cursor: scheduled ? 'pointer' : 'default',
                                  verticalAlign: 'middle',
                                  ...(isToday ? { bgcolor: 'action.selected' } : {}),
                                  '&:hover': scheduled ? { bgcolor: 'action.hover' } : {},
                                }}
                              >
                                <Typography component="span" title={g.title} sx={g.sx}>
                                  {g.char}
                                </Typography>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
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
