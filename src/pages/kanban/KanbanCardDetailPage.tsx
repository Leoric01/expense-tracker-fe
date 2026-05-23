import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  kanbanCardDelete,
  kanbanCardFindById,
  kanbanCardFindBoardSnapshot,
  kanbanCardUpdate,
  getKanbanCardFindBoardSnapshotQueryKey,
  getKanbanCardFindByIdQueryKey,
} from '@api/kanban-card-controller/kanban-card-controller';
import type {
  KanbanBoardSnapshotResponseDto,
  KanbanCardResponseDto,
  KanbanCardUpsertRequestDto,
} from '@api/model';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, type ReactNode, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { KanbanCardChecklist } from './KanbanCardChecklist';
import { KanbanCardDialog } from './KanbanCardDialog';
import { KanbanCardImages } from './KanbanCardImages';
import {
  formatKanbanDate,
  formatKanbanDateTime,
  priorityColor,
  priorityLabel,
} from './kanbanUiHelpers';

type MetaRowProps = { label: string; value: ReactNode };

const MetaRow: FC<MetaRowProps> = ({ label, value }) => (
  <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.75 }}>
    <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ textAlign: 'right', wordBreak: 'break-word' }}>
      {value}
    </Typography>
  </Stack>
);

export const KanbanCardDetailPage: FC = () => {
  const { boardId, cardId } = useParams<{ boardId: string; cardId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cardQuery = useQuery({
    queryKey: getKanbanCardFindByIdQueryKey(trackerId ?? '', boardId ?? '', cardId ?? ''),
    enabled: !!trackerId && !!boardId && !!cardId,
    queryFn: async ({ signal }) => {
      const res = await kanbanCardFindById(trackerId!, boardId!, cardId!, { signal });
      if ((res.status as number) === 404) throw new Error('NOT_FOUND');
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as KanbanCardResponseDto;
    },
  });

  const snapshotQuery = useQuery({
    queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId ?? '', boardId ?? ''),
    enabled: !!trackerId && !!boardId,
    queryFn: async ({ signal }) => {
      const res = await kanbanCardFindBoardSnapshot(trackerId!, boardId!, {}, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as KanbanBoardSnapshotResponseDto;
    },
  });

  const card = cardQuery.data;
  const isCompleted = Boolean(card?.completedDate);
  const stageName = snapshotQuery.data?.stages?.find((s) => s.id === card?.stageId)?.name;
  const isOverdue = !isCompleted && card?.dueDate && new Date(card.dueDate) < new Date();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getKanbanCardFindByIdQueryKey(trackerId!, boardId!, cardId!),
    });
    queryClient.invalidateQueries({
      queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId!, boardId!),
    });
  };

  const completeMutation = useMutation({
    mutationFn: (completed: boolean) => {
      const payload: KanbanCardUpsertRequestDto = {
        title: card!.title!,
        stageId: card!.stageId,
        description: card!.description,
        priority: card!.priority,
        dueDate: card!.dueDate,
        tagIds: card!.tags?.map((t) => t.id!).filter(Boolean) ?? [],
        completed,
      };
      return kanbanCardUpdate(trackerId!, boardId!, cardId!, payload);
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => kanbanCardDelete(trackerId!, boardId!, cardId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId!, boardId!),
      });
      setDeleteOpen(false);
      navigate(`/kanban/boards/${boardId}`, { replace: true });
    },
  });

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Karta
        </PageHeading>
        <Alert severity="info" sx={{ maxWidth: 480 }}>
          Nejprve vyberte tracker v levém menu.
        </Alert>
      </Box>
    );
  }

  if (!boardId || !cardId) {
    return <Navigate to="/kanban/boards" replace />;
  }

  if (cardQuery.isLoading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton width={240} height={40} />
        </Stack>
        <Skeleton variant="rounded" sx={{ flex: 1, minHeight: 400 }} />
      </Box>
    );
  }

  if (cardQuery.isError || !card) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <IconButton component={Link} to={`/kanban/boards/${boardId}`} size="small">
            <ArrowBackIcon />
          </IconButton>
          <PageHeading component="h1" sx={{ mb: 0 }}>
            Karta nenalezena
          </PageHeading>
        </Stack>
        <Alert severity="error" sx={{ mb: 2 }}>
          Kartu se nepodařilo načíst nebo neexistuje.
        </Alert>
        <Button component={Link} to={`/kanban/boards/${boardId}`} variant="outlined">
          Zpět na nástěnku
        </Button>
      </Box>
    );
  }

  const busy = completeMutation.isPending || deleteMutation.isPending;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1} mb={2} flexWrap="wrap">
        <IconButton
          component={Link}
          to={`/kanban/boards/${boardId}`}
          size="small"
          sx={{ mt: 0.5 }}
        >
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {snapshotQuery.data?.boardName ?? 'Nástěnka'}
            {stageName ? ` · ${stageName}` : ''}
          </Typography>
          <PageHeading
            component="h1"
            sx={{
              mb: 0,
              textDecoration: isCompleted ? 'line-through' : 'none',
              color: isCompleted ? 'text.disabled' : 'text.primary',
            }}
          >
            {card.title}
          </PageHeading>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ pt: 0.5 }}>
          <Button
            variant="outlined"
            startIcon={<EditOutlinedIcon />}
            onClick={() => setEditOpen(true)}
            disabled={busy}
          >
            Upravit
          </Button>
          <Button
            variant="outlined"
            color={isCompleted ? 'warning' : 'success'}
            startIcon={
              completeMutation.isPending ? (
                <CircularProgress size={16} />
              ) : isCompleted ? (
                <CheckCircleIcon />
              ) : (
                <CheckCircleOutlineIcon />
              )
            }
            onClick={() => completeMutation.mutate(!isCompleted)}
            disabled={busy}
          >
            {isCompleted ? 'Označit nedokončené' : 'Označit dokončené'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
          >
            Smazat
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={2}>
              {isCompleted && (
                <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                  Karta byla dokončena
                  {card.completedDate ? ` ${formatKanbanDateTime(card.completedDate)}` : ''}.
                </Alert>
              )}

              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Popis
                </Typography>
                {card.description ? (
                  <Typography
                    variant="body1"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {card.description}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Bez popisu
                  </Typography>
                )}
              </Paper>

              <KanbanCardImages
                imageUrl={card.imageUrl}
                trackerId={trackerId}
                boardId={boardId}
                cardId={cardId}
                onInvalidate={invalidate}
              />

              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <KanbanCardChecklist
                  card={card}
                  trackerId={trackerId}
                  boardId={boardId}
                  onInvalidate={invalidate}
                />
              </Paper>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" gutterBottom>
                Detaily
              </Typography>
              <Divider sx={{ mb: 1 }} />

              <MetaRow
                label="Priorita"
                value={
                  card.priority && card.priority !== 5 ? (
                    <Chip
                      label={`${priorityLabel(card.priority)} (${card.priority})`}
                      size="small"
                      variant="outlined"
                      sx={{ color: priorityColor(card.priority), borderColor: priorityColor(card.priority) }}
                    />
                  ) : (
                    'Výchozí'
                  )
                }
              />
              <MetaRow
                label="Termín"
                value={
                  card.dueDate ? (
                    <Typography
                      component="span"
                      variant="body2"
                      color={isOverdue ? 'error.main' : 'text.primary'}
                    >
                      {formatKanbanDate(card.dueDate)}
                      {isOverdue ? ' (po termínu)' : ''}
                    </Typography>
                  ) : (
                    '—'
                  )
                }
              />
              <MetaRow label="Sloupec" value={stageName ?? '—'} />
              <MetaRow
                label="Stav"
                value={isCompleted ? 'Dokončeno' : 'Aktivní'}
              />

              {(card.tags?.length ?? 0) > 0 && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Štítky
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {card.tags!.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        size="small"
                        sx={tag.color ? { bgcolor: tag.color, color: '#fff' } : undefined}
                      />
                    ))}
                  </Stack>
                </>
              )}

              <Divider sx={{ my: 1.5 }} />
              <MetaRow label="Vytvořeno" value={formatKanbanDateTime(card.createdDate)} />
              <MetaRow label="Upraveno" value={formatKanbanDateTime(card.lastModifiedDate)} />
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <KanbanCardDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        trackerId={trackerId}
        boardId={boardId}
        card={card}
      />

      <Dialog open={deleteOpen} onClose={() => !deleteMutation.isPending && setDeleteOpen(false)}>
        <DialogTitle>Smazat kartu?</DialogTitle>
        <DialogContent>
          <Typography>
            Opravdu chcete smazat kartu „{card.title}“? Tuto akci nelze vrátit.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>
            Zrušit
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Mažu…' : 'Smazat'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
