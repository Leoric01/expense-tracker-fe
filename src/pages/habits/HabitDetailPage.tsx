import {
  habitActivate,
  habitDeactivate,
  habitDelete,
  habitFindById,
  getHabitFindByIdQueryKey,
} from '@api/habit-controller/habit-controller';
import type { HabitResponseDto } from '@api/model/habitResponseDto';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { HabitScheduleMatrix } from './HabitScheduleMatrix';
import { HabitScoreRatingRow } from './HabitScoreRating';
import { HABIT_TYPE_LABELS, slotsToKeySet } from './habitUiConstants';

export const HabitDetailPage: FC = () => {
  const { habitId } = useParams<{ habitId: string }>();
  const navigate = useNavigate();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id ?? '';
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: getHabitFindByIdQueryKey(trackerId, habitId ?? ''),
    enabled: !!trackerId && !!habitId,
    queryFn: async ({ signal }) => {
      const res = await habitFindById(trackerId, habitId!, { signal });
      if (res.status === 404) {
        throw new Error('NOT_FOUND');
      }
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as HabitResponseDto;
    },
  });

  const habit = detailQuery.data;

  const invalidateHabits = async () => {
    await queryClient.invalidateQueries({ queryKey: [`/api/habit/${trackerId}`] });
    if (habitId) {
      await queryClient.invalidateQueries({ queryKey: getHabitFindByIdQueryKey(trackerId, habitId) });
    }
  };

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await habitActivate(trackerId, habitId!);
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
    },
    onSuccess: async () => {
      await invalidateHabits();
      enqueueSnackbar('Návyk aktivován', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Aktivace se nezdařila', { variant: 'error' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await habitDeactivate(trackerId, habitId!);
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
    },
    onSuccess: async () => {
      await invalidateHabits();
      enqueueSnackbar('Návyk deaktivován', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Deaktivace se nezdařila', { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await habitDelete(trackerId, habitId!);
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/habit/${trackerId}`] });
      enqueueSnackbar('Návyk smazán', { variant: 'success' });
      setDeleteOpen(false);
      navigate('/habits/list', { replace: true });
    },
    onError: () => enqueueSnackbar('Smazání se nezdařilo', { variant: 'error' }),
  });

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Návyk
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

  if (!habitId) {
    return <Navigate to="/habits/list" replace />;
  }

  if (detailQuery.isLoading) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        Načítám…
      </Typography>
    );
  }

  if (detailQuery.isError || !habit) {
    return (
      <Box>
        <Typography color="error" sx={{ mb: 2 }}>
          Návyk nebyl nalezen nebo ho nelze načíst.
        </Typography>
        <Button component={Link} to="/habits/list" variant="outlined">
          Zpět na seznam
        </Button>
      </Box>
    );
  }

  const typeKey = habit.habitType as keyof typeof HABIT_TYPE_LABELS | undefined;
  const typeLabel =
    typeKey && HABIT_TYPE_LABELS[typeKey] ? HABIT_TYPE_LABELS[typeKey] : habit.habitType ?? '—';

  const busy = activateMutation.isPending || deactivateMutation.isPending || deleteMutation.isPending;

  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        {habit.name ?? 'Návyk'}
      </PageHeading>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Button component={Link} to={`/habits/${habitId}/edit`} variant="outlined" startIcon={<EditIcon />} disabled={busy}>
          Upravit
        </Button>
        {habit.active ? (
          <Button
            variant="outlined"
            color="warning"
            disabled={busy}
            onClick={() => deactivateMutation.mutate()}
          >
            Deaktivovat
          </Button>
        ) : (
          <Button variant="contained" disabled={busy} onClick={() => activateMutation.mutate()}>
            Aktivovat
          </Button>
        )}
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          Smazat
        </Button>
        <Button component={Link} to="/habits/agenda" variant="text" disabled={busy}>
          Agenda
        </Button>
        <Button component={Link} to="/habits/list" variant="text" disabled={busy}>
          Seznam
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <DetailRow label="Popis" value={habit.description?.trim() ? habit.description : '—'} />
          <DetailRow label="Typ" value={typeLabel} />
          <DetailRow label="Očekávaná délka" value={`${habit.expectedMinutes ?? '—'} min`} />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
              Stav
            </Typography>
            {habit.active ? (
              <Chip label="Aktivní" color="success" size="small" />
            ) : (
              <Chip label="Neaktivní" size="small" />
            )}
          </Stack>
          <DetailRow
            label="Platnost"
            value={
              habit.validFrom
                ? `${habit.validFrom}${habit.validTo ? ` → ${habit.validTo}` : ' → bez konce'}`
                : '—'
            }
          />
          <DetailRow label="Pořadí" value={String(habit.sortOrder ?? 0)} />
          <HabitScoreRatingRow label="Spokojenost s návykem" value={habit.satisfactionScore ?? 0} />
          <HabitScoreRatingRow label="Užitečnost návyku" value={habit.utilityScore ?? 0} />
          <DetailRow
            label="Odhadovaná cena"
            value={
              habit.estimatedPrice != null && habit.estimatedPrice > 0 ? `${habit.estimatedPrice} Kč` : '—'
            }
          />
          {(habit.createdDate || habit.lastModifiedDate) && (
            <Typography variant="caption" color="text.secondary">
              Vytvořeno: {habit.createdDate ?? '—'} · Upraveno: {habit.lastModifiedDate ?? '—'}
            </Typography>
          )}
        </Stack>
      </Paper>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Rozvrh
      </Typography>
      <HabitScheduleMatrix selected={slotsToKeySet(habit.scheduleSlots)} onChange={() => {}} readOnly />

      <Dialog open={deleteOpen} onClose={() => !busy && setDeleteOpen(false)}>
        <DialogTitle>Smazat návyk?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Návyk „{habit.name}“ bude označen jako smazaný a zmizí ze seznamů. Tuto akci nelze v rozhraní vrátit zpět.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={busy}>
            Zrušit
          </Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate()} disabled={busy}>
            Smazat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}
