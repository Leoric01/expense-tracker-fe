import {
  kanbanCardCreate,
  kanbanCardUpdate,
  getKanbanCardFindBoardSnapshotQueryKey,
  getKanbanCardFindByIdQueryKey,
} from '@api/kanban-card-controller/kanban-card-controller';
import {
  kanbanTagFindAll,
  getKanbanTagFindAllQueryKey,
} from '@api/kanban-tag-controller/kanban-tag-controller';
import type {
  KanbanCardResponseDto,
  KanbanCardUpsertRequestDto,
  KanbanTagResponseDto,
} from '@api/model';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Checkbox,
  IconButton,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, useEffect, useState } from 'react';
import { KanbanCardChecklist } from './KanbanCardChecklist';

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
  const [completed, setCompleted] = useState(false);
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
  const selectedTags = tags.filter((t) => t.id && selectedTagIds.includes(t.id));

  useEffect(() => {
    if (open) {
      setTitle(card?.title ?? '');
      setDescription(card?.description ?? '');
      setPriority(card?.priority ?? 5);
      setDueDate(card?.dueDate ?? '');
      setCompleted(Boolean(card?.completedDate));
      setSelectedTagIds(card?.tags?.map((t) => t.id).filter(Boolean) as string[] ?? []);
      setError('');
    }
  }, [open, card]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getKanbanCardFindBoardSnapshotQueryKey(trackerId, boardId),
    });
    if (card?.id) {
      queryClient.invalidateQueries({
        queryKey: getKanbanCardFindByIdQueryKey(trackerId, boardId, card.id),
      });
    }
  };

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
      completed: isEdit ? completed : undefined,
      tagIds: selectedTagIds,
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
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={tags}
              value={selectedTags}
              onChange={(_, newTags) =>
                setSelectedTagIds(newTags.map((t) => t.id!).filter(Boolean))
              }
              getOptionLabel={(tag) => tag.name ?? ''}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={(props, tag, { selected }) => {
                const { key, ...optionProps } = props;
                return (
                  <Box
                    component="li"
                    key={key}
                    {...optionProps}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <Checkbox
                      icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                      checkedIcon={<CheckBoxIcon fontSize="small" />}
                      checked={selected}
                      sx={{ p: 0.25 }}
                    />
                    {tag.color && (
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: tag.color,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {tag.name}
                  </Box>
                );
              }}
              renderTags={(value, getTagProps) =>
                value.map((tag, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={tag.id}
                    label={tag.name}
                    size="small"
                    sx={tag.color ? { bgcolor: tag.color, color: '#fff' } : undefined}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Štítky"
                  placeholder={selectedTagIds.length === 0 ? 'Vyberte jeden nebo více štítků…' : undefined}
                />
              )}
            />
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

          {/* Completion state — only in edit mode */}
          {isEdit && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  color="success"
                />
              }
              label="Dokončeno"
            />
          )}

          {/* Checklist — only in edit mode */}
          {isEdit && card && (
            <KanbanCardChecklist
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
