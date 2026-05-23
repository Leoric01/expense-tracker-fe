import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  kanbanBoardCreate,
  kanbanBoardDelete,
  kanbanBoardFindAll,
  kanbanBoardUpdate,
  kanbanBoardReorder,
  getKanbanBoardFindAllQueryKey,
} from '@api/kanban-board-controller/kanban-board-controller';
import type {
  KanbanBoardReorderRequestDto,
  KanbanBoardResponseDto,
  KanbanBoardUpsertRequestDto,
} from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
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
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DragEvent, FC, useRef, useState } from 'react';
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
  const [boardOrder, setBoardOrder] = useState<string>(
    board?.boardOrder != null ? String(board.boardOrder) : '',
  );
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
      boardOrder: boardOrder !== '' ? Number(boardOrder) : undefined,
    };
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleEnter = () => {
    setName(board?.name ?? '');
    setDescription(board?.description ?? '');
    setBoardOrder(board?.boardOrder != null ? String(board.boardOrder) : '');
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
          <TextField
            label="Pořadí"
            type="number"
            value={boardOrder}
            onChange={(e) => setBoardOrder(e.target.value)}
            fullWidth
            inputProps={{ min: 0, step: 1 }}
            helperText="Nechte prázdné pro automatické"
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
  const theme = useTheme();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editBoard, setEditBoard] = useState<KanbanBoardResponseDto | null>(null);

  // Drag state
  const dragBoardRef = useRef<KanbanBoardResponseDto | null>(null);
  const [dragOverBoardId, setDragOverBoardId] = useState<string | null>(null);

  const boardsQuery = useQuery({
    queryKey: getKanbanBoardFindAllQueryKey(trackerId ?? ''),
    enabled: !!trackerId,
    queryFn: async ({ signal }) => {
      const res = await kanbanBoardFindAll(trackerId!, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as KanbanBoardResponseDto[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getKanbanBoardFindAllQueryKey(trackerId!) });

  const deleteMutation = useMutation({
    mutationFn: (boardId: string) => kanbanBoardDelete(trackerId!, boardId),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (data: KanbanBoardReorderRequestDto) => kanbanBoardReorder(trackerId!, data),
    onSuccess: invalidate,
  });

  // ─── DnD handlers ────────────────────────────────────────────────────────────

  const handleDragStart = (e: DragEvent, board: KanbanBoardResponseDto) => {
    dragBoardRef.current = board;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('kanban/board', board.id ?? '');
  };

  const handleDragOver = (e: DragEvent, boardId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBoardId(boardId);
  };

  const handleDrop = (e: DragEvent, targetBoardId: string) => {
    e.preventDefault();
    setDragOverBoardId(null);
    const dragged = dragBoardRef.current;
    dragBoardRef.current = null;
    if (!dragged || dragged.id === targetBoardId) return;

    const currentBoards = boardsQuery.data ?? [];
    const fromIdx = currentBoards.findIndex((b) => b.id === dragged.id);
    const toIdx = currentBoards.findIndex((b) => b.id === targetBoardId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...currentBoards];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);

    reorderMutation.mutate({
      items: reordered.map((b, idx) => ({ boardId: b.id!, boardOrder: idx })),
    });
  };

  const handleDragEnd = () => {
    setDragOverBoardId(null);
    dragBoardRef.current = null;
  };

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
        {boards.map((board) => {
          const isDragSource = dragBoardRef.current?.id === board.id;
          const isDropTarget = dragOverBoardId === board.id && !isDragSource;

          return (
            <Card
              key={board.id}
              variant="outlined"
              draggable
              onDragStart={(e) => handleDragStart(e, board)}
              onDragOver={(e) => handleDragOver(e, board.id!)}
              onDrop={(e) => handleDrop(e, board.id!)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setDragOverBoardId(null);
              }}
              onDragEnd={handleDragEnd}
              sx={{
                position: 'relative',
                cursor: 'grab',
                transition: (t) => t.transitions.create(['box-shadow', 'border-color', 'opacity']),
                opacity: isDragSource ? 0.45 : 1,
                borderColor: isDropTarget ? 'primary.main' : undefined,
                borderWidth: isDropTarget ? 2 : 1,
                bgcolor: isDropTarget ? alpha(theme.palette.primary.main, 0.06) : undefined,
                '&:hover': { borderColor: isDropTarget ? 'primary.main' : 'primary.light', boxShadow: 2 },
                '&:hover .board-actions': { opacity: 1 },
                '&:active': { cursor: 'grabbing' },
              }}
            >
              {/* Drag handle */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  color: 'text.disabled',
                  display: 'flex',
                  alignItems: 'center',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              >
                <DragIndicatorIcon sx={{ fontSize: 16 }} />
              </Box>

              <CardActionArea
                component={Link}
                to={`/kanban/boards/${board.id}`}
                sx={{ p: 0 }}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              >
                <CardContent sx={{ pb: '16px !important', pl: 4 }}>
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
          );
        })}
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
