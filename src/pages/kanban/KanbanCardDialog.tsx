import {
  kanbanCardCreate,
  kanbanCardUpdate,
  kanbanChecklistItemCreate,
  kanbanChecklistItemDelete,
  kanbanChecklistItemUpdate,
  getKanbanCardFindBoardSnapshotQueryKey,
} from '@api/kanban-card-controller/kanban-card-controller';
import {
  kanbanTagFindAll,
  getKanbanTagFindAllQueryKey,
} from '@api/kanban-tag-controller/kanban-tag-controller';
import type {
  KanbanCardResponseDto,
  KanbanCardUpsertRequestDto,
  KanbanChecklistItemResponseDto,
  KanbanTagResponseDto,
} from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  OutlinedInput,
  Select,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react';

// ─── Checklist item row ───────────────────────────────────────────────────────

type ChecklistItemRowProps = {
  item: KanbanChecklistItemResponseDto;
  trackerId: string;
  boardId: string;
  cardId: string;
  onInvalidate: () => void;
};

const ChecklistItemRow: FC<ChecklistItemRowProps> = ({
  item, trackerId, boardId, cardId, onInvalidate,
}) => {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title ?? '');

  const updateMutation = useMutation({
    mutationFn: (title: string) =>
      kanbanChecklistItemUpdate(trackerId, boardId, cardId, item.id!, { title }),
    onSuccess: () => { onInvalidate(); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => kanbanChecklistItemDelete(trackerId, boardId, cardId, item.id!),
    onSuccess: onInvalidate,
  });

  const commitEdit = () => {
    const t = editTitle.trim();
    if (!t || t === item.title) { setEditing(false); return; }
    updateMutation.mutate(t);
  };

  const startEdit = () => {
    setEditTitle(item.title ?? '');
    setEditing(true);
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      sx={{
        borderRadius: 1,
        px: 0.5,
        py: 0.25,
        '&:hover .checklist-delete': { opacity: 1 },
      }}
    >
      {/* Title — inline edit on click */}
      {editing ? (
        <TextField
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          size="small"
          variant="standard"
          autoFocus
          fullWidth
          inputProps={{ maxLength: 180 }}
          onBlur={commitEdit}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          InputProps={{
            endAdornment: updateMutation.isPending ? <CircularProgress size={12} /> : undefined,
          }}
        />
      ) : (
        <Typography
          variant="body2"
          onClick={startEdit}
          sx={{
            flex: 1,
            cursor: 'text',
            textDecoration: item.completed ? 'line-through' : 'none',
            color: item.completed ? 'text.disabled' : 'text.primary',
            wordBreak: 'break-word',
            '&:hover': { color: 'text.primary' },
          }}
        >
          {item.title}
        </Typography>
      )}

      {/* Delete */}
      <Tooltip title="Smazat">
        <IconButton
          size="small"
          color="error"
          className="checklist-delete"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          sx={{ p: 0.25, flexShrink: 0, opacity: 0, transition: 'opacity 0.15s' }}
        >
          {deleteMutation.isPending ? (
            <CircularProgress size={12} color="error" />
          ) : (
            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
          )}
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

// ─── Checklist section ────────────────────────────────────────────────────────

type ChecklistSectionProps = {
  card: KanbanCardResponseDto;
  trackerId: string;
  boardId: string;
  onInvalidate: () => void;
};

const ChecklistSection: FC<ChecklistSectionProps> = ({ card, trackerId, boardId, onInvalidate }) => {
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const items: KanbanChecklistItemResponseDto[] = (card.checklistItems ?? [])
    .slice()
    .sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0));

  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      kanbanChecklistItemCreate(trackerId, boardId, card.id!, { title }),
    onSuccess: () => { onInvalidate(); setNewTitle(''); },
  });

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    createMutation.mutate(t);
  };

  return (
    <Box>
      {/* Header + progress */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.75}>
        <Typography variant="body2" fontWeight={600}>
          Checklist
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {done} / {total}
        </Typography>
      </Stack>

      {total > 0 && (
        <LinearProgress
          variant="determinate"
          value={progress}
          color={progress === 100 ? 'success' : 'primary'}
          sx={{ mb: 1, borderRadius: 1, height: 5 }}
        />
      )}

      {/* Items */}
      <Stack spacing={0.25}>
        {items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            trackerId={trackerId}
            boardId={boardId}
            cardId={card.id!}
            onInvalidate={onInvalidate}
          />
        ))}
      </Stack>

      {/* Add new item */}
      <Stack direction="row" spacing={0.75} alignItems="center" mt={1}>
        <TextField
          inputRef={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Přidat položku…"
          size="small"
          fullWidth
          variant="outlined"
          inputProps={{ maxLength: 180 }}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') handleAdd();
          }}
          disabled={createMutation.isPending}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={createMutation.isPending ? <CircularProgress size={14} /> : <AddIcon />}
          onClick={handleAdd}
          disabled={createMutation.isPending || !newTitle.trim()}
          sx={{ flexShrink: 0 }}
        >
          Přidat
        </Button>
      </Stack>
    </Box>
  );
};

// ─── Main dialog ──────────────────────────────────────────────────────────────

type KanbanCardDialogProps = {
  open: boolean;
  onClose: () => void;
  trackerId: string;
  boardId: string;
  stageId?: string;
  card?: KanbanCardResponseDto | null;
};

export const KanbanCardDialog: FC<KanbanCardDialogProps> = ({
  open,
  onClose,
  trackerId,
  boardId,
  stageId,
  card,
}) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(card?.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<number>(5);
  const [dueDate, setDueDate] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const tagsQuery = useQuery({
    queryKey: getKanbanTagFindAllQueryKey(trackerId),
    enabled: !!trackerId && open,
    queryFn: async ({ signal }) => {
      const res = await kanbanTagFindAll(trackerId, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as KanbanTagResponseDto[];
    },
  });

  const tags: KanbanTagResponseDto[] = tagsQuery.data ?? [];

  useEffect(() => {
    if (open) {
      setTitle(card?.title ?? '');
      setDescription(card?.description ?? '');
      setPriority(card?.priority ?? 5);
      setDueDate(card?.dueDate ?? '');
      setSelectedTagIds(card?.tags?.map((t) => t.id).filter(Boolean) as string[] ?? []);
      setError('');
    }
  }, [open, card]);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId, boardId),
    });

  const createMutation = useMutation({
    mutationFn: (data: KanbanCardUpsertRequestDto) => kanbanCardCreate(trackerId, boardId, data),
    onSuccess: () => { invalidate(); onClose(); },
    onError: () => setError('Nepodařilo se vytvořit kartu.'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: KanbanCardUpsertRequestDto) =>
      kanbanCardUpdate(trackerId, boardId, card!.id!, data),
    onSuccess: () => { invalidate(); onClose(); },
    onError: () => setError('Nepodařilo se uložit změny.'),
  });

  const handleSubmit = () => {
    if (!title.trim()) { setError('Název je povinný.'); return; }
    const payload: KanbanCardUpsertRequestDto = {
      title: title.trim(),
      description: description.trim() || undefined,
      stageId: card?.stageId ?? stageId,
      priority: priority !== 5 ? priority : undefined,
      dueDate: dueDate || undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    };
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const priorityMarks = [
    { value: 1, label: '1' },
    { value: 5, label: '5' },
    { value: 10, label: '10' },
  ];

  const priorityColor =
    priority >= 8 ? 'error.main' : priority >= 5 ? 'warning.main' : 'success.main';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{isEdit ? 'Upravit kartu' : 'Nová karta'}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField
            label="Název"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: 180 }}
            autoFocus
          />

          <TextField
            label="Popis"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            inputProps={{ maxLength: 1000 }}
          />

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
              <Typography variant="body2" color="text.secondary">Priorita</Typography>
              <Typography variant="body2" fontWeight={700} color={priorityColor}>
                {priority}
              </Typography>
            </Stack>
            <Slider
              value={priority}
              onChange={(_, v) => setPriority(v as number)}
              min={1}
              max={10}
              step={1}
              marks={priorityMarks}
              valueLabelDisplay="auto"
              color={priority >= 8 ? 'error' : priority >= 5 ? 'warning' : 'success'}
            />
          </Box>

          <TextField
            label="Termín splnění"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          {tags.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Štítky</InputLabel>
              <Select
                multiple
                value={selectedTagIds}
                onChange={(e) => setSelectedTagIds(e.target.value as string[])}
                input={<OutlinedInput label="Štítky" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((id) => {
                      const tag = tags.find((t) => t.id === id);
                      return (
                        <Chip
                          key={id}
                          label={tag?.name ?? id}
                          size="small"
                          sx={tag?.color ? { bgcolor: tag.color, color: '#fff' } : undefined}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {tags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    {tag.color && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: tag.color,
                          mr: 1,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {isEdit && card?.imageUrl && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Obrázek
              </Typography>
              <Box
                component="img"
                src={card.imageUrl}
                alt="Obrázek karty"
                sx={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 200,
                  objectFit: 'contain',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </Box>
          )}

          {/* Checklist — only in edit mode */}
          {isEdit && card && (
            <ChecklistSection
              card={card}
              trackerId={trackerId}
              boardId={boardId}
              onInvalidate={invalidate}
            />
          )}

          {error && <Typography color="error" variant="body2">{error}</Typography>}
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
