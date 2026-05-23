import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  kanbanCardFindBoardSnapshot,
  kanbanCardMove,
  kanbanCardReorder,
  kanbanChecklistItemToggle,
  getKanbanCardFindBoardSnapshotQueryKey,
} from '@api/kanban-card-controller/kanban-card-controller';
import {
  kanbanStageCreate,
  kanbanStageDelete,
  kanbanStageUpdate,
  kanbanStageReorder,
  getKanbanBoardFindByIdQueryKey,
} from '@api/kanban-board-controller/kanban-board-controller';
import { kanbanCardDelete } from '@api/kanban-card-controller/kanban-card-controller';
import type {
  KanbanBoardSnapshotResponseDto,
  KanbanCardMoveStageRequestDto,
  KanbanCardReorderRequestDto,
  KanbanCardResponseDto,
  KanbanChecklistItemResponseDto,
  KanbanStageCardsResponseDto,
  KanbanStageReorderRequestDto,
  KanbanStageUpsertRequestDto,
} from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
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
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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

// ─── Color picker ────────────────────────────────────────────────────────────

const STAGE_COLOR_PRESETS = [
  '#b71c1c',
  '#880e4f',
  '#4a148c',
  '#1a237e',
  '#006064',
  '#1b5e20',
  '#e65100',
  '#f57f17',
  '#37474f',
  '#263238',
];

type ColorPickerRowProps = { value: string; onChange: (c: string) => void };

const ColorPickerRow: FC<ColorPickerRowProps> = ({ value, onChange }) => (
  <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
    <Tooltip title="Bez barvy">
      <Box
        onClick={() => onChange('')}
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: '1px dashed',
          borderColor: 'text.disabled',
          cursor: 'pointer',
          flexShrink: 0,
          outline: !value ? '2px solid' : '2px solid transparent',
          outlineColor: !value ? 'text.primary' : 'transparent',
          outlineOffset: '1px',
        }}
      />
    </Tooltip>
    {STAGE_COLOR_PRESETS.map((c) => (
      <Box
        key={c}
        onClick={() => onChange(c)}
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          bgcolor: c,
          cursor: 'pointer',
          flexShrink: 0,
          outline: value === c ? '2px solid' : '2px solid transparent',
          outlineColor: value === c ? 'text.primary' : 'transparent',
          outlineOffset: '1px',
          '&:hover': { opacity: 0.8 },
        }}
      />
    ))}
    <Tooltip title="Vlastní barva">
      <Box
        component="input"
        type="color"
        value={value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          flexShrink: 0,
          outline: value && !STAGE_COLOR_PRESETS.includes(value) ? '2px solid' : '2px solid transparent',
          outlineColor: value && !STAGE_COLOR_PRESETS.includes(value) ? 'text.primary' : 'transparent',
          outlineOffset: '1px',
          backgroundColor: 'transparent',
          '&::-webkit-color-swatch-wrapper': { padding: 0 },
          '&::-webkit-color-swatch': { borderRadius: '50%', border: 'none' },
        }}
      />
    </Tooltip>
  </Stack>
);

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

// ─── Card-view checklist item (toggle only) ───────────────────────────────────

type CardChecklistItemProps = {
  item: KanbanChecklistItemResponseDto;
  trackerId: string;
  boardId: string;
  cardId: string;
  onInvalidate: () => void;
};

const CardChecklistItem: FC<CardChecklistItemProps> = ({
  item, trackerId, boardId, cardId, onInvalidate,
}) => {
  const toggleMutation = useMutation({
    mutationFn: (completed: boolean) =>
      kanbanChecklistItemToggle(trackerId, boardId, cardId, item.id!, { completed }),
    onSuccess: onInvalidate,
  });

  return (
    <Stack direction="row" alignItems="flex-start" spacing={0.5}>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(!item.completed); }}
        disabled={toggleMutation.isPending}
        sx={{ p: 0, flexShrink: 0, mt: '1px' }}
      >
        {toggleMutation.isPending ? (
          <CircularProgress size={14} />
        ) : item.completed ? (
          <CheckBoxIcon sx={{ fontSize: 16, color: 'success.main' }} />
        ) : (
          <CheckBoxOutlineBlankIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        )}
      </IconButton>
      <Typography
        variant="caption"
        sx={{
          flex: 1,
          lineHeight: 1.4,
          textDecoration: item.completed ? 'line-through' : 'none',
          color: item.completed ? 'text.disabled' : 'text.primary',
          wordBreak: 'break-word',
        }}
      >
        {item.title}
      </Typography>
    </Stack>
  );
};

// ─── Kanban card component ────────────────────────────────────────────────────

type KanbanCardProps = {
  card: KanbanCardResponseDto;
  trackerId: string;
  boardId: string;
  stageColor?: string;
  isDragTarget?: boolean;
  onEdit: (card: KanbanCardResponseDto) => void;
  onDragStart: (e: DragEvent, card: KanbanCardResponseDto) => void;
  onCardDragOver: (e: DragEvent, card: KanbanCardResponseDto) => void;
  onCardDrop: (e: DragEvent, card: KanbanCardResponseDto) => void;
};

const KanbanCard: FC<KanbanCardProps> = ({
  card,
  trackerId,
  boardId,
  stageColor,
  isDragTarget,
  onEdit,
  onDragStart,
  onCardDragOver,
  onCardDrop,
}) => {
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
      <Box
        onDragOver={(e) => onCardDragOver(e as unknown as DragEvent, card)}
        onDrop={(e) => onCardDrop(e as unknown as DragEvent, card)}
        sx={{
          position: 'relative',
          '&::before': isDragTarget
            ? {
                content: '""',
                position: 'absolute',
                top: -5,
                left: 0,
                right: 0,
                height: 3,
                bgcolor: 'primary.main',
                borderRadius: 0.5,
                zIndex: 2,
              }
            : {},
        }}
      >
      <Paper
        variant="outlined"
        draggable
        onDragStart={(e) => onDragStart(e, card)}
        sx={{
          p: 2,
          cursor: 'grab',
          userSelect: 'none',
          transition: 'box-shadow 0.15s',
          bgcolor: stageColor ? alpha(stageColor, 0.18) : undefined,
          borderColor: isDragTarget ? 'primary.main' : stageColor ? alpha(stageColor, 0.5) : undefined,
          '&:hover': { boxShadow: 3, borderColor: stageColor ? alpha(stageColor, 0.9) : 'primary.main' },
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

        {/* Checklist items */}
        {(card.checklistItems?.length ?? 0) > 0 && (
          <Stack spacing={0.5} mt={1.25}>
            {[...(card.checklistItems ?? [])]
              .sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0))
              .map((item) => (
                <CardChecklistItem
                  key={item.id}
                  item={item}
                  trackerId={trackerId}
                  boardId={boardId}
                  cardId={card.id!}
                  onInvalidate={invalidate}
                />
              ))}
          </Stack>
        )}

        {/* Meta row */}
        <Stack direction="row" alignItems="center" spacing={0.75} mt={1.25} flexWrap="wrap">
          {!!card.priority && card.priority !== 5 && (
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
      </Box>

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
  onDragStart: (e: DragEvent) => void;
};

const StageHeader: FC<StageHeaderProps> = ({ stage, trackerId, boardId, onDragStart }) => {
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setStageName] = useState(stage.name ?? '');
  const [visibleOnBoard, setVisibleOnBoard] = useState(stage.visibleOnBoard ?? true);
  const [stageOrder, setStageOrder] = useState<string>(
    stage.stageOrder != null ? String(stage.stageOrder) : '',
  );
  const [color, setColor] = useState(stage.color ?? '');

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

  const openEdit = () => {
    setMenuAnchor(null);
    setStageName(stage.name ?? '');
    setVisibleOnBoard(stage.visibleOnBoard ?? true);
    setStageOrder(stage.stageOrder != null ? String(stage.stageOrder) : '');
    setColor(stage.color ?? '');
    setEditOpen(true);
  };

  const submitEdit = () => {
    if (!name.trim()) return;
    updateMutation.mutate({
      name: name.trim(),
      visibleOnBoard,
      stageOrder: stageOrder !== '' ? Number(stageOrder) : undefined,
      color: color || undefined,
    });
  };

  if (editOpen) {
    return (
      <Stack spacing={1} mb={1.5}>
        <TextField
          size="small"
          label="Název sloupce"
          value={name}
          onChange={(e) => setStageName(e.target.value)}
          autoFocus
          inputProps={{ maxLength: 80 }}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') submitEdit();
            if (e.key === 'Escape') setEditOpen(false);
          }}
          InputProps={{
            endAdornment: updateMutation.isPending ? (
              <InputAdornment position="end"><CircularProgress size={14} /></InputAdornment>
            ) : undefined,
          }}
          fullWidth
        />
        <TextField
          size="small"
          label="Pořadí"
          type="number"
          value={stageOrder}
          onChange={(e) => setStageOrder(e.target.value)}
          fullWidth
          inputProps={{ min: 0, step: 1 }}
          helperText="Nechte prázdné pro automatické"
        />
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Barva sloupce
          </Typography>
          <ColorPickerRow value={color} onChange={setColor} />
          {color && (
            <Box sx={{ mt: 0.75 }}>
              <Chip
                label={name || 'Náhled'}
                size="small"
                sx={{ bgcolor: color, color: '#fff' }}
              />
            </Box>
          )}
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={visibleOnBoard}
              onChange={(e) => setVisibleOnBoard(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="caption">Zobrazovat na nástěnce</Typography>}
          sx={{ m: 0 }}
        />
        <Stack direction="row" spacing={0.75}>
          <Button
            size="small"
            variant="contained"
            onClick={submitEdit}
            disabled={updateMutation.isPending || !name.trim()}
          >
            Uložit
          </Button>
          <Button size="small" onClick={() => setEditOpen(false)}>Zrušit</Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" mb={1.5}>
      <Box
        draggable
        onDragStart={(e) => onDragStart(e as unknown as DragEvent)}
        sx={{
          cursor: 'grab',
          color: 'text.disabled',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          mr: 0.5,
          '&:hover': { color: 'text.secondary' },
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
      </Box>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" fontWeight={700} noWrap>
          {stage.name}
        </Typography>
        {stage.visibleOnBoard === false && (
          <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1 }}>
            skrytý
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5 }}>
        {stage.cards?.length ?? 0}
      </Typography>
      <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => setMenuAnchor(e.currentTarget)}>
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={openEdit}>
          <EditOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Upravit sloupec
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
    card?: KanbanCardResponseDto | null;
  }>({ open: false });

  // Card drag state
  const dragCardRef = useRef<KanbanCardResponseDto | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // Stage column drag state
  const dragStageRef = useRef<KanbanStageCardsResponseDto | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Add stage
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageVisible, setNewStageVisible] = useState(true);
  const [newStageOrder, setNewStageOrder] = useState<string>('');
  const [newStageColor, setNewStageColor] = useState('');

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
    mutationFn: ({ cardId, data }: { cardId: string; data: KanbanCardMoveStageRequestDto }) =>
      kanbanCardMove(trackerId!, cardId, data),
    onSuccess: invalidate,
  });

  // Reorder stages mutation
  const reorderStageMutation = useMutation({
    mutationFn: (data: KanbanStageReorderRequestDto) =>
      kanbanStageReorder(trackerId!, boardId!, data),
    onSuccess: invalidate,
  });

  // Reorder cards within a stage mutation
  const reorderCardMutation = useMutation({
    mutationFn: (data: KanbanCardReorderRequestDto) =>
      kanbanCardReorder(trackerId!, boardId!, data),
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
      setNewStageVisible(true);
      setNewStageOrder('');
      setNewStageColor('');
    },
  });

  // ─── DnD handlers ────────────────────────────────────────────────────────────

  // Card drag
  const handleDragStart = (e: DragEvent, card: KanbanCardResponseDto) => {
    dragCardRef.current = card;
    dragStageRef.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('kanban/card', card.id ?? '');
  };

  // Stage column drag (called from the drag handle)
  const handleColumnDragStart = (e: DragEvent, stage: KanbanStageCardsResponseDto) => {
    dragStageRef.current = stage;
    dragCardRef.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('kanban/stage', stage.id ?? '');
    e.stopPropagation();
  };

  const handleDragOver = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragStageRef.current) {
      setDragOverColumnId(stageId);
      setDragOverStageId(null);
    } else {
      setDragOverStageId(stageId);
      setDragOverColumnId(null);
    }
  };

  const handleDrop = (e: DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    setDragOverColumnId(null);
    setDragOverCardId(null);

    if (dragStageRef.current) {
      // Stage reorder
      const dragged = dragStageRef.current;
      dragStageRef.current = null;
      if (dragged.id === targetStageId) return;

      const fromIdx = stages.findIndex((s) => s.id === dragged.id);
      const toIdx = stages.findIndex((s) => s.id === targetStageId);
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = [...stages];
      const [removed] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, removed);

      reorderStageMutation.mutate({
        items: reordered.map((s, idx) => ({ stageId: s.id!, stageOrder: idx })),
      });
    } else if (dragCardRef.current) {
      // Card dropped on empty stage area → move to that stage (append)
      const card = dragCardRef.current;
      dragCardRef.current = null;
      if (card.stageId === targetStageId) return;
      moveMutation.mutate({ cardId: card.id!, data: { targetStageId } });
    }
  };

  // Card dropped on another card → reorder within stage or move to stage
  const handleCardDrop = (e: DragEvent, targetCard: KanbanCardResponseDto) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStageId(null);
    setDragOverColumnId(null);
    setDragOverCardId(null);

    const dragged = dragCardRef.current;
    dragCardRef.current = null;
    if (!dragged || dragged.id === targetCard.id) return;

    if (dragged.stageId === targetCard.stageId) {
      // Same stage: reorder
      const stage = stages.find((s) => s.id === dragged.stageId);
      const stageCards = [...(stage?.cards ?? [])].sort(
        (a, b) => (a.cardOrder ?? 0) - (b.cardOrder ?? 0),
      );
      const fromIdx = stageCards.findIndex((c) => c.id === dragged.id);
      const toIdx = stageCards.findIndex((c) => c.id === targetCard.id);
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = [...stageCards];
      const [removed] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, removed);

      reorderCardMutation.mutate({
        stageId: dragged.stageId!,
        items: reordered.map((c, idx) => ({ cardId: c.id!, cardOrder: idx })),
      });
    } else {
      // Different stage: move card to target stage
      moveMutation.mutate({ cardId: dragged.id!, data: { targetStageId: targetCard.stageId! } });
    }
  };

  // Card dragged over another card → show insert indicator
  const handleCardDragOver = (e: DragEvent, card: KanbanCardResponseDto) => {
    if (!dragCardRef.current || dragCardRef.current.id === card.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCardId(card.id ?? null);
    setDragOverStageId(null);
  };

  const handleDragEnd = () => {
    setDragOverStageId(null);
    setDragOverColumnId(null);
    setDragOverCardId(null);
    dragCardRef.current = null;
    dragStageRef.current = null;
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
          variant="text"
          size="small"
          component={Link}
          to="/kanban/tags"
          sx={{ color: 'text.secondary' }}
        >
          Štítky
        </Button>
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
            const isCardDropTarget = dragOverStageId === stage.id;
            const isColumnDropTarget = dragOverColumnId === stage.id && dragStageRef.current?.id !== stage.id;
            const cards = stage.cards ?? [];

            return (
              <Box
                key={stage.id}
                onDragOver={(e) => handleDragOver(e, stage.id!)}
                onDrop={(e) => handleDrop(e, stage.id!)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverStageId(null);
                    setDragOverColumnId(null);
                  }
                }}
                onDragEnd={handleDragEnd}
                sx={{
                  width: 280,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                  opacity: dragStageRef.current?.id === stage.id ? 0.45 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '100%',
                    bgcolor: isCardDropTarget
                      ? alpha(theme.palette.primary.main, 0.06)
                      : '#222a3c',
                    borderColor: isColumnDropTarget
                      ? 'secondary.main'
                      : isCardDropTarget
                        ? 'primary.main'
                        : undefined,
                    borderWidth: isColumnDropTarget || isCardDropTarget ? 2 : 1,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {/* Stage header */}
                  <Box sx={{ px: 1.5, pt: 1.5, flexShrink: 0 }}>
                    <StageHeader
                      stage={stage}
                      trackerId={trackerId}
                      boardId={boardId!}
                      onDragStart={(e) => handleColumnDragStart(e, stage)}
                    />
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
                        stageColor={stage.color}
                        isDragTarget={dragOverCardId === card.id}
                        onEdit={(c) => setCardDialog({ open: true, card: c })}
                        onDragStart={handleDragStart}
                        onCardDragOver={handleCardDragOver}
                        onCardDrop={handleCardDrop}
                      />
                    ))}

                    {isCardDropTarget && (
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

                    {cards.length === 0 && !isCardDropTarget && (
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
                <Stack spacing={1.25}>
                  <TextField
                    size="small"
                    label="Název sloupce"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    fullWidth
                    autoFocus
                    inputProps={{ maxLength: 80 }}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Escape') {
                        setAddStageOpen(false);
                        setNewStageName('');
                        setNewStageVisible(true);
                        setNewStageOrder('');
                      }
                    }}
                    disabled={addStageMutation.isPending}
                  />
                  <TextField
                    size="small"
                    label="Pořadí"
                    type="number"
                    value={newStageOrder}
                    onChange={(e) => setNewStageOrder(e.target.value)}
                    fullWidth
                    inputProps={{ min: 0, step: 1 }}
                    disabled={addStageMutation.isPending}
                    helperText="Nechte prázdné pro automatické"
                  />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Barva sloupce
                    </Typography>
                    <ColorPickerRow value={newStageColor} onChange={setNewStageColor} />
                    {newStageColor && (
                      <Box sx={{ mt: 0.75 }}>
                        <Chip
                          label={newStageName || 'Náhled'}
                          size="small"
                          sx={{ bgcolor: newStageColor, color: '#fff' }}
                        />
                      </Box>
                    )}
                  </Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={newStageVisible}
                        onChange={(e) => setNewStageVisible(e.target.checked)}
                        size="small"
                      />
                    }
                    label={<Typography variant="caption">Zobrazovat na nástěnce</Typography>}
                    sx={{ m: 0 }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        if (newStageName.trim())
                          addStageMutation.mutate({
                            name: newStageName.trim(),
                            visibleOnBoard: newStageVisible,
                            stageOrder: newStageOrder !== '' ? Number(newStageOrder) : undefined,
                            color: newStageColor || undefined,
                          });
                      }}
                      disabled={addStageMutation.isPending || !newStageName.trim()}
                    >
                      Přidat
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setAddStageOpen(false);
                        setNewStageName('');
                        setNewStageVisible(true);
                        setNewStageOrder('');
                        setNewStageColor('');
                      }}
                    >
                      Zrušit
                    </Button>
                  </Stack>
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
