import {
  todoCreate,
  todoUpdate,
  getTodoFindTreeQueryKey,
} from '@api/todo-controller/todo-controller';
import { todoTagFindAll, getTodoTagFindAllQueryKey } from '@api/todo-tag-controller/todo-tag-controller';
import type {
  TodoFindTree200Item,
  TodoFindTreeParams,
  TodoResponseDto,
  TodoTagResponseDto,
  TodoUpsertRequestDto,
  TodoUpsertRequestDtoPriority,
  TodoUpsertRequestDtoStatus,
} from '@api/model';
import { TodoUpsertRequestDtoPriority as PriorityEnum, TodoUpsertRequestDtoStatus as StatusEnum } from '@api/model';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, useEffect, useState } from 'react';
import { TODO_PRIORITY_LABELS, TODO_STATUS_LABELS } from './todoUiConstants';

type TodoFormDialogProps = {
  open: boolean;
  onClose: () => void;
  trackerId: string;
  todo?: TodoResponseDto | TodoFindTree200Item | null;
  parentTodoId?: string;
  filterParams?: TodoFindTreeParams;
};

export const TodoFormDialog: FC<TodoFormDialogProps> = ({
  open,
  onClose,
  trackerId,
  todo,
  parentTodoId,
  filterParams,
}) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(todo?.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TodoUpsertRequestDtoStatus>(StatusEnum.TODO);
  const [priority, setPriority] = useState<TodoUpsertRequestDtoPriority>(PriorityEnum.MEDIUM);
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [note, setNote] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const tagsQuery = useQuery({
    queryKey: getTodoTagFindAllQueryKey(trackerId),
    enabled: !!trackerId && open,
    queryFn: async ({ signal }) => {
      const res = await todoTagFindAll(trackerId, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as TodoTagResponseDto[];
    },
  });

  const tags: TodoTagResponseDto[] = tagsQuery.data ?? [];

  useEffect(() => {
    if (open) {
      setTitle(todo?.title ?? '');
      setDescription(todo?.description ?? '');
      setStatus((todo?.status as TodoUpsertRequestDtoStatus) ?? StatusEnum.TODO);
      setPriority((todo?.priority as TodoUpsertRequestDtoPriority) ?? PriorityEnum.MEDIUM);
      setDueDate(todo?.dueDate ?? '');
      setEstimatedMinutes(todo?.estimatedMinutes != null ? String(todo.estimatedMinutes) : '');
      setNote(todo?.note ?? '');
      setSelectedTagIds(todo?.tags?.map((t) => t.id).filter(Boolean) as string[] ?? []);
      setError('');
    }
  }, [open, todo]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getTodoFindTreeQueryKey(trackerId, filterParams) });
  };

  const createMutation = useMutation({
    mutationFn: (data: TodoUpsertRequestDto) => todoCreate(trackerId, data),
    onSuccess: () => { invalidate(); onClose(); },
    onError: () => setError('Nepodařilo se vytvořit úkol.'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: TodoUpsertRequestDto) => todoUpdate(trackerId, todo!.id!, data),
    onSuccess: () => { invalidate(); onClose(); },
    onError: () => setError('Nepodařilo se uložit změny.'),
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Název úkolu je povinný.');
      return;
    }
    const payload: TodoUpsertRequestDto = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      dueDate: dueDate || undefined,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
      note: note.trim() || undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      parentTodoId: parentTodoId ?? todo?.parentTodoId,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{isEdit ? 'Upravit úkol' : 'Nový úkol'}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
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
            minRows={2}
            inputProps={{ maxLength: 1000 }}
          />

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Stav</InputLabel>
              <Select
                value={status}
                label="Stav"
                onChange={(e) => setStatus(e.target.value as TodoUpsertRequestDtoStatus)}
              >
                {Object.entries(TODO_STATUS_LABELS).map(([val, label]) => (
                  <MenuItem key={val} value={val}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Priorita</InputLabel>
              <Select
                value={priority}
                label="Priorita"
                onChange={(e) => setPriority(e.target.value as TodoUpsertRequestDtoPriority)}
              >
                {Object.entries(TODO_PRIORITY_LABELS).map(([val, label]) => (
                  <MenuItem key={val} value={val}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Termín splnění"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Odhadovaný čas (min)"
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              fullWidth
              inputProps={{ min: 0 }}
            />
          </Stack>

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
                        sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', bgcolor: tag.color, mr: 1 }}
                      />
                    )}
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Poznámka"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: 1000 }}
          />

          {todo?.imageUrl && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Obrázek
              </Typography>
              <Box
                component="img"
                src={todo.imageUrl}
                alt="Obrázek úkolu"
                sx={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 260,
                  objectFit: 'contain',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </Box>
          )}

          {error && (
            <Typography color="error" variant="body2">{error}</Typography>
          )}
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
