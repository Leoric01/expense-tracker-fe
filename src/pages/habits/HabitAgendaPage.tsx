import type { HabitCompletionStateDto } from '@api/model/habitCompletionStateDto';
import {
  habitFindAgendaForDate,
  getHabitFindAgendaForDateQueryKey,
} from '@api/habit-controller/habit-controller';
import type { HabitAgendaItemDto } from '@api/model/habitAgendaItemDto';
import type { HabitAgendaItemDtoDayBlocksItem } from '@api/model/habitAgendaItemDtoDayBlocksItem';
import type { HabitDayOverviewDto } from '@api/model/habitDayOverviewDto';
import { HabitCompletionStateDtoStatus } from '@api/model/habitCompletionStateDtoStatus';
import { HabitCompletionUpsertRequestDtoStatus } from '@api/model/habitCompletionUpsertRequestDtoStatus';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import FavoriteIcon from '@mui/icons-material/Favorite';
import GroupsIcon from '@mui/icons-material/Groups';
import HomeIcon from '@mui/icons-material/Home';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PsychologyIcon from '@mui/icons-material/Psychology';
import GavelIcon from '@mui/icons-material/Gavel';
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/cs';
import { useSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { completionStateToDialogStatus } from './habitCompletionMappers';
import { habitCompletionUpsertOrThrow } from './habitCompletionUpsertWithError';
import { parseOptionalMoneyKc } from './habitMoneyParse';
import { HabitCompletionFormDialog, type HabitCompletionDialogStatus } from './HabitCompletionFormDialog';
import { HabitScoreRatingInline, normalizeHabitScore } from './HabitScoreRating';
import { normalizeDayBlocks } from './habitDayOverviewNormalize';
import { HABIT_BLOCK_LABELS, HABIT_DAY_LABELS, HABIT_TYPE_LABELS, HABIT_DAY_BLOCKS_ORDER } from './habitUiConstants';

function habitTypeIcon(habitType: string | undefined) {
  switch (habitType) {
    case 'PHYSICAL':
      return <DirectionsRunIcon fontSize="small" />;
    case 'MENTAL':
      return <PsychologyIcon fontSize="small" />;
    case 'EDUCATIONAL':
      return <MenuBookIcon fontSize="small" />;
    case 'SOCIAL':
      return <GroupsIcon fontSize="small" />;
    case 'HEALTH':
      return <FavoriteIcon fontSize="small" />;
    case 'SLEEP':
      return <BedtimeIcon fontSize="small" />;
    case 'DISCIPLINE':
      return <GavelIcon fontSize="small" />;
    case 'HOUSEHOLD':
      return <HomeIcon fontSize="small" />;
    default:
      return <MoreHorizIcon fontSize="small" />;
  }
}

function completionSymbol(status: string | undefined) {
  if (status === HabitCompletionStateDtoStatus.DONE) {
    return (
      <Typography component="span" sx={{ color: 'success.main', fontSize: '1.25rem', fontWeight: 700 }} title="Splněno">
        ✓
      </Typography>
    );
  }
  if (status === HabitCompletionStateDtoStatus.PARTIALLY_COMPLETED) {
    return (
      <Typography component="span" sx={{ color: 'info.main', fontSize: '1.25rem', fontWeight: 700 }} title="Částečně splněno">
        ◐
      </Typography>
    );
  }
  if (status === HabitCompletionStateDtoStatus.SKIPPED) {
    return (
      <Typography component="span" sx={{ color: 'warning.main', fontSize: '1.25rem', fontWeight: 700 }} title="Přeskočeno">
        ↷
      </Typography>
    );
  }
  if (status === HabitCompletionStateDtoStatus.MISSED) {
    return (
      <Typography component="span" sx={{ color: 'error.main', fontSize: '1.1rem', fontWeight: 700 }} title="Zmeškáno">
        ✕
      </Typography>
    );
  }
  return (
    <Typography component="span" sx={{ color: 'text.disabled', fontSize: '1.15rem' }} title="Nesplněno">
      ○
    </Typography>
  );
}

function formatCompletedAt(iso: string | undefined) {
  if (!iso) {
    return null;
  }
  const d = dayjs(iso);
  return d.isValid() ? d.locale('cs').format('D. M. YYYY HH:mm') : iso;
}

function otherBlocksLabel(
  currentBlock: (typeof HABIT_DAY_BLOCKS_ORDER)[number],
  dayBlocks: HabitAgendaItemDtoDayBlocksItem[] | undefined,
): string | null {
  const rest = (dayBlocks ?? []).filter((b) => b && b !== currentBlock);
  if (rest.length === 0) {
    return null;
  }
  const labels = rest.map((b) => HABIT_BLOCK_LABELS[b as keyof typeof HABIT_BLOCK_LABELS] ?? b);
  return labels.join(', ');
}

type AgendaCompletionContext = {
  habitId: string;
  habitName: string;
  existingCompletion?: HabitCompletionStateDto;
};

export const HabitAgendaPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id ?? '';
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [pickedDate, setPickedDate] = useState<Dayjs>(() => dayjs());
  const dateStr = pickedDate.format('YYYY-MM-DD');

  const [completionCtx, setCompletionCtx] = useState<AgendaCompletionContext | null>(null);
  const [dialogStatus, setDialogStatus] = useState<HabitCompletionDialogStatus>(
    HabitCompletionUpsertRequestDtoStatus.DONE,
  );
  const [dialogNote, setDialogNote] = useState('');
  const [dialogSatisfactionScore, setDialogSatisfactionScore] = useState(0);
  const [dialogExecutionScore, setDialogExecutionScore] = useState(0);
  const [dialogActualPrice, setDialogActualPrice] = useState('');

  const agendaQuery = useQuery({
    queryKey: getHabitFindAgendaForDateQueryKey(trackerId, { date: dateStr }),
    enabled: !!trackerId,
    queryFn: async ({ signal }) => {
      const res = await habitFindAgendaForDate(trackerId, { date: dateStr }, { signal });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as HabitDayOverviewDto;
    },
  });

  const blocks = useMemo(() => normalizeDayBlocks(agendaQuery.data), [agendaQuery.data]);
  const overview = agendaQuery.data;
  const dow = overview?.dayOfWeek;
  const dayTitle =
    dow && dow in HABIT_DAY_LABELS
      ? HABIT_DAY_LABELS[dow as keyof typeof HABIT_DAY_LABELS]
      : overview?.dayOfWeek ?? '';

  const invalidateAgenda = () =>
    queryClient.invalidateQueries({
      queryKey: getHabitFindAgendaForDateQueryKey(trackerId, { date: dateStr }),
    });

  const invalidateWeekOverviews = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === `/api/habit/${trackerId}/week`,
    });

  const upsertMutation = useMutation({
    mutationFn: async (input: {
      habitId: string;
      status: HabitCompletionDialogStatus;
      note?: string;
      satisfactionScore: number;
      executionScore: number;
      actualPrice: string;
    }) => {
      const price = parseOptionalMoneyKc(input.actualPrice);
      await habitCompletionUpsertOrThrow(trackerId, {
        habitId: input.habitId,
        date: dateStr,
        status: input.status,
        note: input.note?.trim() || undefined,
        satisfactionScore: normalizeHabitScore(input.satisfactionScore),
        executionScore: normalizeHabitScore(input.executionScore),
        ...(price != null ? { actualPrice: price } : {}),
      });
    },
    onSuccess: async () => {
      await invalidateAgenda();
      await invalidateWeekOverviews();
      enqueueSnackbar('Stav uložen', { variant: 'success' });
      setCompletionCtx(null);
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

  const openCompletionPreset = (habitId: string, habitName: string, preset: HabitCompletionDialogStatus) => {
    setDialogStatus(preset);
    setDialogNote('');
    setDialogSatisfactionScore(0);
    setDialogExecutionScore(0);
    setDialogActualPrice('');
    setCompletionCtx({ habitId, habitName });
  };

  const openCompletionEdit = (habitId: string, habitName: string, completion: HabitCompletionStateDto) => {
    setDialogStatus(completionStateToDialogStatus(completion.status));
    setDialogNote(completion.note ?? '');
    setDialogSatisfactionScore(normalizeHabitScore(completion.satisfactionScore));
    setDialogExecutionScore(normalizeHabitScore(completion.executionScore));
    setDialogActualPrice(completion.actualPrice != null ? String(completion.actualPrice) : '');
    setCompletionCtx({ habitId, habitName, existingCompletion: completion });
  };

  const submitCompletionDialog = () => {
    if (!completionCtx) {
      return;
    }
    upsertMutation.mutate({
      habitId: completionCtx.habitId,
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
          Denní agenda
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

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
      <PageHeading component="h1" gutterBottom>
        Denní agenda
      </PageHeading>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton aria-label="Předchozí den" onClick={() => setPickedDate((d) => d.subtract(1, 'day'))} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <DatePicker
            label="Datum"
            value={pickedDate}
            onChange={(v) => v && setPickedDate(v)}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 200 } } }}
          />
          <IconButton aria-label="Následující den" onClick={() => setPickedDate((d) => d.add(1, 'day'))} size="small">
            <ChevronRightIcon />
          </IconButton>
        </Stack>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setPickedDate(dayjs())}
          disabled={pickedDate.isSame(dayjs(), 'day')}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          Dnes
        </Button>
        {dayTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {dayTitle}
          </Typography>
        )}
      </Stack>

      {agendaQuery.isLoading && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          Načítám agendu…
        </Typography>
      )}
      {agendaQuery.isError && (
        <Typography color="error" sx={{ py: 2 }}>
          Agendu se nepodařilo načíst.
        </Typography>
      )}

      {!agendaQuery.isLoading && !agendaQuery.isError && (
        <Stack spacing={3}>
          {blocks.map((block) => {
            const blockKey = block.dayBlock ?? '';
            const blockLabel =
              block.dayBlock && block.dayBlock in HABIT_BLOCK_LABELS
                ? HABIT_BLOCK_LABELS[block.dayBlock as keyof typeof HABIT_BLOCK_LABELS]
                : blockKey;
            const items = block.items ?? [];
            const currentBlockEnum = block.dayBlock as (typeof HABIT_DAY_BLOCKS_ORDER)[number];

            return (
              <Box key={blockKey}>
                <PageHeading component="h2" gutterBottom={false} sx={{ mb: 1.5 }}>
                  {blockLabel}
                </PageHeading>
                {items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ pl: 0.5 }}>
                    Žádné návyky
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {items.map((item) => (
                      <AgendaHabitCard
                        key={`${item.habitId}-${blockKey}`}
                        item={item}
                        currentBlock={currentBlockEnum}
                        onOpenHotovo={() =>
                          item.habitId &&
                          openCompletionPreset(item.habitId, item.name ?? 'Návyk', HabitCompletionUpsertRequestDtoStatus.DONE)
                        }
                        onOpenPreskocit={() =>
                          item.habitId &&
                          openCompletionPreset(item.habitId, item.name ?? 'Návyk', HabitCompletionUpsertRequestDtoStatus.SKIPPED)
                        }
                        onEditCompletion={() =>
                          item.habitId &&
                          item.completion &&
                          openCompletionEdit(item.habitId, item.name ?? 'Návyk', item.completion)
                        }
                        saving={upsertMutation.isPending}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      <HabitCompletionFormDialog
        open={completionCtx != null}
        onClose={() => !upsertMutation.isPending && setCompletionCtx(null)}
        title={completionCtx?.habitName ?? 'Návyk'}
        subtitle={dayjs(dateStr).locale('cs').format('dddd D. M. YYYY')}
        completedAtCaption={
          completionCtx?.existingCompletion?.completedAt
            ? `Dokončeno: ${dayjs(completionCtx.existingCompletion.completedAt).locale('cs').format('D. M. YYYY HH:mm')}`
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
        onSubmit={submitCompletionDialog}
        submitting={upsertMutation.isPending}
      />
    </LocalizationProvider>
  );
};

type AgendaHabitCardProps = {
  item: HabitAgendaItemDto;
  currentBlock: (typeof HABIT_DAY_BLOCKS_ORDER)[number];
  onOpenHotovo: () => void;
  onOpenPreskocit: () => void;
  onEditCompletion: () => void;
  saving: boolean;
};

const AgendaHabitCard: FC<AgendaHabitCardProps> = ({
  item,
  currentBlock,
  onOpenHotovo,
  onOpenPreskocit,
  onEditCompletion,
  saving,
}) => {
  const c = item.completion;
  const typeKey = item.habitType as keyof typeof HABIT_TYPE_LABELS | undefined;
  const typeLabel =
    typeKey && HABIT_TYPE_LABELS[typeKey] ? HABIT_TYPE_LABELS[typeKey] : item.habitType ?? '—';
  const other = otherBlocksLabel(currentBlock, item.dayBlocks);
  const when = formatCompletedAt(c?.completedAt);

  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <Tooltip title={typeLabel}>
                <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>{habitTypeIcon(item.habitType)}</Box>
              </Tooltip>
              {item.habitId ? (
                <Typography
                  component={Link}
                  to={`/habits/${item.habitId}`}
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  {item.name ?? '—'}
                </Typography>
              ) : (
                <Typography variant="subtitle1" fontWeight={700}>
                  {item.name ?? '—'}
                </Typography>
              )}
              <Chip label={typeLabel} size="small" variant="outlined" />
              <Chip label={`${item.expectedMinutes ?? 0} min`} size="small" variant="filled" color="default" />
            </Stack>
            {item.description?.trim() ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {item.description}
              </Typography>
            ) : null}
            {other ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Také v blocích: {other}
              </Typography>
            ) : null}
            {(normalizeHabitScore(item.satisfactionScore) > 0 ||
              normalizeHabitScore(item.utilityScore) > 0 ||
              item.estimatedPrice != null) && (
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                <HabitScoreRatingInline label="Spokojenost (návyk)" score={item.satisfactionScore} />
                <HabitScoreRatingInline label="Užitečnost" score={item.utilityScore} />
                {item.estimatedPrice != null ? (
                  <Typography variant="caption" color="text.secondary">
                    Odhad (Kč): {item.estimatedPrice}
                  </Typography>
                ) : null}
              </Stack>
            )}
          </Box>

          <Stack alignItems={{ xs: 'stretch', sm: 'flex-end' }} spacing={1} sx={{ minWidth: { sm: 200 } }}>
            {c ? (
              <ButtonBase
                focusRipple
                disabled={saving || !item.habitId}
                onClick={onEditCompletion}
                aria-label="Upravit stav splnění"
                sx={{
                  display: 'block',
                  textAlign: { xs: 'left', sm: 'right' },
                  borderRadius: 1,
                  py: 0.5,
                  px: 0.75,
                  width: { xs: '100%', sm: 'auto' },
                  alignSelf: { xs: 'stretch', sm: 'flex-end' },
                  '&:hover:not(:disabled)': { bgcolor: 'action.hover' },
                }}
              >
                <Stack spacing={0.5} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <Stack direction="row" alignItems="center" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                    {completionSymbol(c?.status)}
                    {c?.status === HabitCompletionStateDtoStatus.DONE && (
                      <Typography variant="caption" color="success.main" fontWeight={600}>
                        Hotovo
                      </Typography>
                    )}
                    {c?.status === HabitCompletionStateDtoStatus.PARTIALLY_COMPLETED && (
                      <Typography variant="caption" color="info.main" fontWeight={600}>
                        Částečně splněno
                      </Typography>
                    )}
                    {c?.status === HabitCompletionStateDtoStatus.SKIPPED && (
                      <Typography variant="caption" color="warning.main" fontWeight={600}>
                        Přeskočeno
                      </Typography>
                    )}
                    {c?.status === HabitCompletionStateDtoStatus.MISSED && (
                      <Typography variant="caption" color="error.main" fontWeight={600}>
                        Zmeškaný
                      </Typography>
                    )}
                  </Stack>
                  {(normalizeHabitScore(c.satisfactionScore) > 0 ||
                    normalizeHabitScore(c.executionScore) > 0 ||
                    c.actualPrice != null) && (
                    <Stack
                      spacing={0.25}
                      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                      sx={{ width: '100%' }}
                    >
                      <HabitScoreRatingInline label="Spokojenost" score={c.satisfactionScore} />
                      <HabitScoreRatingInline label="Provedení" score={c.executionScore} />
                      {c.actualPrice != null ? (
                        <Typography variant="caption" color="text.secondary">
                          Cena (Kč): {c.actualPrice}
                        </Typography>
                      ) : null}
                    </Stack>
                  )}
                  {c.note?.trim() ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: { sm: 'right' } }}>
                      {c.note}
                    </Typography>
                  ) : null}
                  {when ? (
                    <Typography variant="caption" color="text.secondary">
                      {when}
                    </Typography>
                  ) : null}
                </Stack>
              </ButtonBase>
            ) : (
              <>
                <Stack direction="row" alignItems="center" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                  {completionSymbol(undefined)}
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <Button size="small" variant="contained" onClick={onOpenHotovo} disabled={saving || !item.habitId}>
                    Hotovo
                  </Button>
                  <Button size="small" variant="text" onClick={onOpenPreskocit} disabled={saving || !item.habitId}>
                    Přeskočit
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
