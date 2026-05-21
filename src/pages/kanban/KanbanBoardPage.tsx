import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  kanbanCardFindBoardSnapshot,
  kanbanCardMove,
  getKanbanCardFindBoardSnapshotQueryKey,
} from '@api/kanban-card-controller/kanban-card-controller';
import {
  kanbanStageCreate,
  kanbanStageDelete,
  kanbanStageUpdate,
  getKanbanBoardFindByIdQueryKey,
} from '@api/kanban-board-controller/kanban-board-controller';
import { kanbanCardDelete } from '@api/kanban-card-controller/kanban-card-controller';
import type {
  KanbanBoardSnapshotResponseDto,
  KanbanCardMoveRequestDto,
  KanbanStageCardsResponseDto,
  KanbanStageCardsResponseDtoCardsItem,
  KanbanStageUpsertRequestDto,
} from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
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
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DragEvent, FC, KeyboardEvent, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { KanbanCardDialog } from './KanbanCardDialog';

// ─── Priority color helper ────────────────────────────────────────────────────

function priorityColor(p: number | undefined): string {
  if (!p) return 'text.disabled';
  if (p >= 8) return 'error.main';
  if (p >= 5) return 'warning.main';
  return 'success.main';
}

function priorityLabel(p: number | undefined): string {
  if (!p) return '';
  if (p >= 8) return 'Vysoká';
  if (p >= 5) return 'Střední';
  return 'Nízká';
}

// ─── Kanban card component ────────────────────────────────────────────────────

type KanbanCardProps = {
  card: KanbanStageCardsResponseDtoCardsItem;
  trackerId: string;
  boardId: string;
  onEdit: (card: KanbanStageCardsResponseDtoCardsItem) => void;
  onDragStart: (e: DragEvent, card: KanbanStageCardsResponseDtoCardsItem) => void;
};

const KanbanCard: FC<KanbanCardProps> = ({ card, trackerId, boardId, onEdit, onDragStart }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId, boardId),
    });

  const deleteMutation = useMutation({
    mutationFn: () => kanbanCardDelete(trackerId, boardId, card.id!),
    onSuccess: invalidate,
  });

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();

  return (
    <>
      <Paper
        variant="outlined"
        draggable
        onDragStart={(e) => onDragStart(e, card)}
        sx={{
          p: 1.5,
          cursor: 'grab',
          userSelect: 'none',
          transition: 'box-shadow 0.15s',
          '&:hover': { boxShadow: 3, borderColor: 'primary.main' },
          '&:hover .card-actions': { opacity: 1 },
          '&:active': { cursor: 'grabbing' },
        }}
      >
        {/* Top row: drag handle + title + actions */}
        <Stack direction="row" alignItems="flex-start" spacing={0.5}>
          <DragIndicatorIcon
            sx={{ fontSize: 16, color: 'text.disabled', mt: 0.25, flexShrink: 0 }}
          />
          <Typography variant="body2" fontWeight={500} sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
            {card.title}
          </Typography>
          <Stack
            className="card-actions"
            direction="row"
            sx={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
          >
            <Tooltip title="Upravit">
              <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onEdit(card)}>
                <EditOutlinedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Smazat">
              <IconButton
                size="small"
                color="error"
                sx={{ p: 0.25 }}
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <CircularProgress size={12} color="error" />
                ) : (
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Description snippet */}
        {card.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, lineHeight: 1.3 }}
            noWrap
          >
            {card.description}
          </Typography>
        )}

        {/* Image thumbnail */}
        {card.imageUrl && (
          <Box
            component="img"
            src={card.imageUrl}
            alt="náhled"
            onClick={() => setImagePreviewOpen(true)}
            sx={{
              display: 'block',
              width: '100%',
              maxHeight: 120,
              objectFit: 'cover',
              borderRadius: 1,
              mt: 1,
              cursor: 'pointer',
              '&:hover': { opacity: 0.85 },
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        {/* Meta row */}
        <Stack direction="row" alignItems="center" spacing={0.75} mt={1} flexWrap="wrap">
          {card.priority && card.priority !== 5 && (
            <Chip
              label={priorityLabel(card.priority)}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                px: 0.25,
                color: priorityColor(card.priority),
                borderColor: priorityColor(card.priority),
              }}
              variant="outlined"
            />
          )}

          {card.tags?.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                px: 0.25,
                ...(tag.color ? { bgcolor: tag.color, color: '#fff' } : {}),
              }}
            />
          ))}

          {card.dueDate && (
            <Typography
              variant="caption"
              sx={{ color: isOverdue ? 'error.main' : 'text.disabled', ml: 'auto !important' }}
            >
              {new Date(card.dueDate).toLocaleDateString('cs-CZ')}
            </Typography>
          )}

          {card.imageUrl && !card.imageUrl.startsWith('data') && (
            <ImageOutlinedIcon sx={{ fontSize: 12, color: 'info.main', ml: 'auto !important' }} />
          )}
        </Stack>
      </Paper>

      {/* Image preview */}
      {imagePreviewOpen && card.imageUrl && (
        <Dialog open onClose={() => setImagePreviewOpen(false)} maxWidth="md">
          <DialogContent sx={{ p: 1 }}>
            <Box
              component="img"
              src={card.imageUrl}
              alt="Náhled"
              sx={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', borderRadius: 1 }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

// ─── Stage column header (edit/delete via menu) ───────────────────────────────

type StageHeaderProps = {
  stage: KanbanStageCardsResponseDto;
  trackerId: string;
  boardId: string;
};

const StageHeader: FC<StageHeaderProps> = ({ stage, trackerId, boardId }) => {
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setStageName] = useState(stage.name ?? '');

  const invalidateSnapshot = () =>
    queryClient.invalidateQueries({
      queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId, boardId),
    });
  const invalidateBoard = () =>
    queryClient.invalidateQueries({
      queryKey: getKanbanBoardFindByIdQueryKey(trackerId, boardId),
    });

  const updateMutation = useMutation({
    mutationFn: (data: KanbanStageUpsertRequestDto) =>
      kanbanStageUpdate(trackerId, boardId, stage.id!, data),
    onSuccess: () => { invalidateSnapshot(); invalidateBoard(); setEditOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => kanbanStageDelete(trackerId, boardId, stage.id!),
    onSuccess: () => { invalidateSnapshot(); invalidateBoard(); },
  });

  if (editOpen) {
    return (
      <Stack direction="row" spacing={0.5} alignItems="center" mb={1.5}>
        <TextField
          size="small"
          value={name}
          onChange={(e) => setStageName(e.target.value)}
          autoFocus
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') updateMutation.mutate({ name: name.trim(), visibleOnBoard: stage.visibleOnBoard });
            if (e.key === 'Escape') setEditOpen(false);
          }}
          InputProps={{
            endAdornment: updateMutation.isPending ? (
              <InputAdornment position="end"><CircularProgress size={14} /></InputAdornment>
            ) : undefined,
          }}
          sx={{ flex: 1 }}
        />
        <IconButton size="small" onClick={() => setEditOpen(false)}><DeleteOutlineIcon fontSize="small" /></IconButton>
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" mb={1.5}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }} noWrap>
        {stage.name}
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5 }}>
        {stage.cards?.length ?? 0}
      </Typography>
      <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => setMenuAnchor(e.currentTarget)}>
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setMenuAnchor(null); setStageName(stage.name ?? ''); setEditOpen(true); }}>
          <EditOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Přejmenovat
        </MenuItem>
        <MenuItem
          onClick={() => { setMenuAnchor(null); deleteMutation.mutate(); }}
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Smazat sloupec
        </MenuItem>
      </Menu>
    </Stack>
  );
};

// ─── Main board page ──────────────────────────────────────────────────────────

export const KanbanBoardPage: FC = () => {
  const theme = useTheme();
  const { boardId } = useParams<{ boardId: string }>();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const queryClient = useQueryClient();

  const [cardDialog, setCardDialog] = useState<{
    open: boolean;
    stageId?: string;
    card?: KanbanStageCardsResponseDtoCardsItem | null;
  }>({ open: false });

  // Drag state
  const dragCardRef = useRef<KanbanStageCardsResponseDtoCardsItem | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Add stage
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');

  // Snapshot query (all cards by stage)
  const snapshotQuery = useQuery({
    queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId ?? '', boardId ?? ''),
    enabled: !!trackerId && !!boardId,
    queryFn: async ({ signal }) => {
      const res = await kanbanCardFindBoardSnapshot(trackerId!, boardId!, {}, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as KanbanBoardSnapshotResponseDto;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId!, boardId!),
    });

  // Move card mutation
  const moveMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: KanbanCardMoveRequestDto }) =>
      kanbanCardMove(trackerId!, boardId!, cardId, data),
    onSuccess: invalidate,
  });

  // Add stage mutation
  const addStageMutation = useMutation({
    mutationFn: (data: KanbanStageUpsertRequestDto) =>
      kanbanStageCreate(trackerId!, boardId!, data),
    onSuccess: () => {
      invalidate();
      setAddStageOpen(false);
      setNewStageName('');
    },
  });

  // ─── DnD handlers ────────────────────────────────────────────────────────────

  const handleDragStart = (
    e: DragEvent,
    card: KanbanStageCardsResponseDtoCardsItem,
  ) => {
    dragCardRef.current = card;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  };

  const handleDrop = (e: DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    const card = dragCardRef.current;
    if (!card || card.stageId === targetStageId) return;
    moveMutation.mutate({ cardId: card.id!, data: { stageId: targetStageId } });
    dragCardRef.current = null;
  };

  const handleDragEnd = () => {
    setDragOverStageId(null);
    dragCardRef.current = null;
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>Kanban</PageHeading>
        <Alert severity="info" sx={{ maxWidth: 480 }}>Nejprve vyberte tracker v levém menu.</Alert>
      </Box>
    );
  }

  const snapshot = snapshotQuery.data;
  const stages: KanbanStageCardsResponseDto[] = snapshot?.stages ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" mb={2} spacing={1} flexWrap="wrap">
        <IconButton component={Link} to="/kanban/boards" size="small">
          <ArrowBackIcon />
        </IconButton>
        <PageHeading component="h1" sx={{ flex: 1 }}>
          {snapshotQuery.isLoading ? (
            <Skeleton width={200} sx={{ display: 'inline-block' }} />
          ) : (
            snapshot?.boardName ?? 'Nástěnka'
          )}
        </PageHeading>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAddStageOpen(true)}
        >
          Nový sloupec
        </Button>
      </Stack>

      {snapshotQuery.isError && (
        <Alert severity="error">Nepodařilo se načíst nástěnku.</Alert>
      )}

      {/* Board: horizontal scroll */}
      <Box
        sx={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          pb: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ height: '100%', minHeight: 400, alignItems: 'flex-start' }}
        >
          {snapshotQuery.isLoading &&
            [1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" width={280} height={400} sx={{ flexShrink: 0 }} />
            ))}

          {stages.map((stage) => {
            const isDropTarget = dragOverStageId === stage.id;
            const cards = stage.cards ?? [];

            return (
              <Box
                key={stage.id}
                onDragOver={(e) => handleDragOver(e, stage.id!)}
                onDrop={(e) => handleDrop(e, stage.id!)}
                onDragLeave={() => setDragOverStageId(null)}
                sx={{
                  width: 280,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '100%',
                    bgcolor: isDropTarget
                      ? alpha(theme.palette.primary.main, 0.06)
                      : alpha(theme.palette.action.hover, 0.04),
                    borderColor: isDropTarget ? 'primary.main' : undefined,
                    borderWidth: isDropTarget ? 2 : 1,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {/* Stage header */}
                  <Box sx={{ px: 1.5, pt: 1.5, flexShrink: 0 }}>
                    <StageHeader stage={stage} trackerId={trackerId} boardId={boardId!} />
                  </Box>

                  {/* Cards list */}
                  <Stack
                    spacing={1}
                    sx={{
                      flex: 1,
                      overflowY: 'auto',
                      px: 1.5,
                      pb: 1,
                      minHeight: 60,
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {cards.map((card) => (
                      <KanbanCard
                        key={card.id}
                        card={card}
                        trackerId={trackerId}
                        boardId={boardId!}
                        onEdit={(c) => setCardDialog({ open: true, card: c })}
                        onDragStart={handleDragStart}
                      />
                    ))}

                    {isDropTarget && (
                      <Box
                        sx={{
                          height: 40,
                          border: '2px dashed',
                          borderColor: 'primary.main',
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" color="primary">
                          Pustit sem
                        </Typography>
                      </Box>
                    )}

                    {cards.length === 0 && !isDropTarget && (
                      <Box
                        sx={{
                          py: 2,
                          textAlign: 'center',
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 1,
                        }}
                      >
                        <CheckBoxOutlineBlankIcon sx={{ color: 'divider', fontSize: 20 }} />
                        <Typography variant="caption" color="text.disabled" display="block">
                          Žádné karty
                        </Typography>
                      </Box>
                    )}
                  </Stack>

                  {/* Add card button */}
                  <Box sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setCardDialog({ open: true, stageId: stage.id, card: null })}
                      fullWidth
                      sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
                    >
                      Přidat kartu
                    </Button>
                  </Box>
                </Paper>
              </Box>
            );
          })}

          {/* Add stage inline input */}
          {addStageOpen && (
            <Box sx={{ width: 280, flexShrink: 0 }}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <TextField
                  size="small"
                  label="Název sloupce"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  fullWidth
                  autoFocus
                  inputProps={{ maxLength: 80 }}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter' && newStageName.trim()) {
                      addStageMutation.mutate({ name: newStageName.trim(), visibleOnBoard: true });
                    }
                    if (e.key === 'Escape') {
                      setAddStageOpen(false);
                      setNewStageName('');
                    }
                  }}
                  disabled={addStageMutation.isPending}
                />
                <Stack direction="row" spacing={1} mt={1}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      if (newStageName.trim())
                        addStageMutation.mutate({ name: newStageName.trim(), visibleOnBoard: true });
                    }}
                    disabled={addStageMutation.isPending || !newStageName.trim()}
                  >
                    Přidat
                  </Button>
                  <Button
                    size="small"
                    onClick={() => { setAddStageOpen(false); setNewStageName(''); }}
                  >
                    Zrušit
                  </Button>
                </Stack>
              </Paper>
            </Box>
          )}
        </Stack>
      </Box>

      {/* Card dialog (create / edit) */}
      <KanbanCardDialog
        open={cardDialog.open}
        onClose={() => setCardDialog({ open: false })}
        trackerId={trackerId}
        boardId={boardId!}
        stageId={cardDialog.stageId}
        card={cardDialog.card}
      />
    </Box>
  );
};
