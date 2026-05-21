import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  kanbanBoardCreate,
  kanbanBoardDelete,
  kanbanBoardFindAll,
  kanbanBoardUpdate,
  getKanbanBoardFindAllQueryKey,
} from '@api/kanban-board-controller/kanban-board-controller';
import type { KanbanBoardResponseDto, KanbanBoardUpsertRequestDto } from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, useState } from 'react';
import { Link } from 'react-router-dom';

// ─── Board form dialog ────────────────────────────────────────────────────────

type BoardFormDialogProps = {
  open: boolean;
  onClose: () => void;
  trackerId: string;
  board?: KanbanBoardResponseDto | null;
};

const BoardFormDialog: FC<BoardFormDialogProps> = ({ open, onClose, trackerId, board }) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(board?.id);
  const [name, setName] = useState(board?.name ?? '');
  const [description, setDescription] = useState(board?.description ?? '');
  const [error, setError] = useState('');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getKanbanBoardFindAllQueryKey(trackerId) });

  const createMutation = useMutation({
    mutationFn: (data: KanbanBoardUpsertRequestDto) => kanbanBoardCreate(trackerId, data),
    onSuccess: () => { invalidate(); onClose(); },
    onError: () => setError('Nepodařilo se vytvořit nástěnku.'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: KanbanBoardUpsertRequestDto) => kanbanBoardUpdate(trackerId, board!.id!, data),
    onSuccess: () => { invalidate(); onClose(); },
    onError: () => setError('Nepodařilo se uložit změny.'),
  });

  const handleSubmit = () => {
    if (!name.trim()) { setError('Název je povinný.'); return; }
    const payload: KanbanBoardUpsertRequestDto = {
      name: name.trim(),
      description: description.trim() || undefined,
      active: true,
    };
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Reset on open
  const handleEnter = () => {
    setName(board?.name ?? '');
    setDescription(board?.description ?? '');
    setError('');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" TransitionProps={{ onEnter: handleEnter }}>
      <DialogTitle>{isEdit ? 'Upravit nástěnku' : 'Nová nástěnka'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Název"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: 120 }}
            autoFocus
          />
          <TextField
            label="Popis"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
          />
          {error && <Typography color="error" variant="caption">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Zrušit</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isPending}>
          {isEdit ? 'Uložit' : 'Vytvořit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Boards page ──────────────────────────────────────────────────────────────

export const KanbanBoardsPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editBoard, setEditBoard] = useState<KanbanBoardResponseDto | null>(null);

  const boardsQuery = useQuery({
    queryKey: getKanbanBoardFindAllQueryKey(trackerId ?? ''),
    enabled: !!trackerId,
    queryFn: async ({ signal }) => {
      const res = await kanbanBoardFindAll(trackerId!, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as KanbanBoardResponseDto[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (boardId: string) => kanbanBoardDelete(trackerId!, boardId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: getKanbanBoardFindAllQueryKey(trackerId!) }),
  });

  const openCreate = () => { setEditBoard(null); setFormOpen(true); };
  const openEdit = (board: KanbanBoardResponseDto) => { setEditBoard(board); setFormOpen(true); };

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>Kanban</PageHeading>
        <Alert severity="info" sx={{ maxWidth: 480 }}>
          Nejprve vyberte tracker v levém menu.
        </Alert>
      </Box>
    );
  }

  const boards: KanbanBoardResponseDto[] = boardsQuery.data ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={1}>
        <PageHeading component="h1">Kanban nástěnky</PageHeading>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nová nástěnka
        </Button>
      </Stack>

      {boardsQuery.isLoading && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={120} />)}
        </Box>
      )}

      {boardsQuery.isError && <Alert severity="error">Nepodařilo se načíst nástěnky.</Alert>}

      {!boardsQuery.isLoading && !boardsQuery.isError && boards.length === 0 && (
        <Alert severity="info" sx={{ maxWidth: 480 }}>
          Zatím žádné nástěnky. Vytvořte první pomocí tlačítka výše.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          maxWidth: 900,
        }}
      >
        {boards.map((board) => (
          <Card
            key={board.id}
            variant="outlined"
            sx={{
              position: 'relative',
              transition: (t) => t.transitions.create(['box-shadow', 'border-color']),
              '&:hover': { borderColor: 'primary.main', boxShadow: 2 },
              '&:hover .board-actions': { opacity: 1 },
            }}
          >
            <CardActionArea component={Link} to={`/kanban/boards/${board.id}`} sx={{ p: 0 }}>
              <CardContent sx={{ pb: '16px !important' }}>
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box
                    sx={(t) => ({
                      flexShrink: 0,
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(t.palette.error.main, 0.1),
                      color: t.palette.error.main,
                    })}
                  >
                    <DashboardOutlinedIcon />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {board.name}
                    </Typography>
                    {board.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }} noWrap>
                        {board.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="primary" fontWeight={600} sx={{ mt: 0.5, display: 'block' }}>
                      Otevřít →
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>

            {/* Hover actions */}
            <Stack
              className="board-actions"
              direction="row"
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                opacity: 0,
                transition: 'opacity 0.15s',
                bgcolor: 'background.paper',
                borderRadius: 1,
                boxShadow: 1,
              }}
            >
              <Tooltip title="Upravit">
                <IconButton
                  size="small"
                  onClick={(e) => { e.preventDefault(); openEdit(board); }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Smazat">
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => { e.preventDefault(); deleteMutation.mutate(board.id!); }}
                  disabled={deleteMutation.isPending}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Card>
        ))}
      </Box>

      <BoardFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        trackerId={trackerId}
        board={editBoard}
      />
    </Box>
  );
};
