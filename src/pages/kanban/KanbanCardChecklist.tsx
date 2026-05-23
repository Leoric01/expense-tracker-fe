import {
  kanbanChecklistItemCreate,
  kanbanChecklistItemDelete,
  kanbanChecklistItemToggle,
  kanbanChecklistItemUpdate,
} from '@api/kanban-card-controller/kanban-card-controller';
import type { KanbanCardResponseDto, KanbanChecklistItemResponseDto } from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { FC, KeyboardEvent, useRef, useState } from 'react';

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

  const toggleMutation = useMutation({
    mutationFn: (completed: boolean) =>
      kanbanChecklistItemToggle(trackerId, boardId, cardId, item.id!, { completed }),
    onSuccess: onInvalidate,
  });

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

  const busy = toggleMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

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
      <IconButton
        size="small"
        onClick={() => toggleMutation.mutate(!item.completed)}
        disabled={busy}
        sx={{ p: 0, flexShrink: 0 }}
      >
        {toggleMutation.isPending ? (
          <CircularProgress size={14} />
        ) : item.completed ? (
          <CheckBoxIcon sx={{ fontSize: 18, color: 'success.main' }} />
        ) : (
          <CheckBoxOutlineBlankIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        )}
      </IconButton>

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

      <Tooltip title="Smazat">
        <IconButton
          size="small"
          color="error"
          className="checklist-delete"
          onClick={() => deleteMutation.mutate()}
          disabled={busy}
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

type KanbanCardChecklistProps = {
  card: KanbanCardResponseDto;
  trackerId: string;
  boardId: string;
  onInvalidate: () => void;
};

export const KanbanCardChecklist: FC<KanbanCardChecklistProps> = ({
  card, trackerId, boardId, onInvalidate,
}) => {
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
