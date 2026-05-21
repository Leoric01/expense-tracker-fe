import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  todoTagCreate,
  todoTagCreateBulk,
  todoTagDelete,
  todoTagFindAll,
  todoTagUpdate,
  getTodoTagFindAllQueryKey,
} from '@api/todo-tag-controller/todo-tag-controller';
import type { TodoTagResponseDto, TodoTagUpsertRequestDto } from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, useState } from 'react';

const COLOR_PRESETS = [
  '#e53935',
  '#8e24aa',
  '#1e88e5',
  '#00897b',
  '#43a047',
  '#f4511e',
  '#fb8c00',
  '#fdd835',
  '#6d4c41',
  '#546e7a',
];

type TagRowProps = {
  tag: TodoTagResponseDto;
  trackerId: string;
};

const TagRow: FC<TagRowProps> = ({ tag, trackerId }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name ?? '');
  const [color, setColor] = useState(tag.color ?? '');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getTodoTagFindAllQueryKey(trackerId) });
  };

  const updateMutation = useMutation({
    mutationFn: (data: TodoTagUpsertRequestDto) => todoTagUpdate(trackerId, tag.id!, data),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => todoTagDelete(trackerId, tag.id!),
    onSuccess: invalidate,
  });

  const handleSave = () => {
    if (!name.trim()) return;
    updateMutation.mutate({ name: name.trim(), color: color || undefined });
  };

  const handleCancel = () => {
    setName(tag.name ?? '');
    setColor(tag.color ?? '');
    setEditing(false);
  };

  if (editing) {
    return (
      <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
        <Stack spacing={1.5}>
          <TextField
            label="Název"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            fullWidth
            autoFocus
          />
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <TextField
              label="Barva (hex)"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              size="small"
              sx={{ maxWidth: 160 }}
              inputProps={{ maxLength: 20 }}
            />
            {COLOR_PRESETS.map((c) => (
              <Box
                key={c}
                onClick={() => setColor(c)}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: c,
                  cursor: 'pointer',
                  border: color === c ? '2px solid' : '2px solid transparent',
                  borderColor: color === c ? 'text.primary' : 'transparent',
                  '&:hover': { opacity: 0.85 },
                }}
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckIcon />}
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              Uložit
            </Button>
            <Button size="small" startIcon={<CloseIcon />} onClick={handleCancel}>
              Zrušit
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center' }}>
      <Chip
        label={tag.name}
        size="small"
        sx={tag.color ? { bgcolor: tag.color, color: '#fff', mr: 1 } : { mr: 1 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {tag.color ?? '—'}
      </Typography>
      <Tooltip title="Upravit">
        <IconButton size="small" onClick={() => setEditing(true)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Smazat">
        <IconButton
          size="small"
          color="error"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
};

type NewTagFormProps = {
  trackerId: string;
  onCreated: () => void;
};

const NewTagForm: FC<NewTagFormProps> = ({ trackerId, onCreated }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: TodoTagUpsertRequestDto) => todoTagCreate(trackerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getTodoTagFindAllQueryKey(trackerId) });
      setName('');
      setColor('');
      setError('');
      onCreated();
    },
    onError: () => setError('Nepodařilo se vytvořit štítek.'),
  });

  const handleSubmit = () => {
    if (!name.trim()) { setError('Název je povinný.'); return; }
    createMutation.mutate({ name: name.trim(), color: color || undefined });
  };

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>Nový štítek</Typography>
      <Stack spacing={1.5}>
        <TextField
          label="Název"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
        />
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <TextField
            label="Barva (hex)"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            size="small"
            sx={{ maxWidth: 160 }}
            inputProps={{ maxLength: 20 }}
          />
          {COLOR_PRESETS.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                border: color === c ? '2px solid' : '2px solid transparent',
                borderColor: color === c ? 'text.primary' : 'transparent',
                '&:hover': { opacity: 0.85 },
              }}
            />
          ))}
        </Stack>
        {color && (
          <Box>
            <Chip label={name || 'Náhled'} size="small" sx={{ bgcolor: color, color: '#fff' }} />
          </Box>
        )}
        {error && <Typography color="error" variant="caption">{error}</Typography>}
        <Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            Vytvořit
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
};

type BulkRow = { name: string; color: string };

const BulkTagForm: FC<{ trackerId: string; onCreated: () => void }> = ({ trackerId, onCreated }) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BulkRow[]>([
    { name: '', color: '' },
    { name: '', color: '' },
  ]);
  const [error, setError] = useState('');

  const addRow = () => setRows((r) => [...r, { name: '', color: '' }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof BulkRow, val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  const bulkMutation = useMutation({
    mutationFn: (data: TodoTagUpsertRequestDto[]) => todoTagCreateBulk(trackerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getTodoTagFindAllQueryKey(trackerId) });
      setRows([{ name: '', color: '' }, { name: '', color: '' }]);
      setError('');
      onCreated();
    },
    onError: () => setError('Nepodařilo se hromadně vytvořit štítky.'),
  });

  const handleSubmit = () => {
    const valid = rows.filter((r) => r.name.trim());
    if (valid.length === 0) { setError('Zadejte alespoň jeden název.'); return; }
    bulkMutation.mutate(valid.map((r) => ({ name: r.name.trim(), color: r.color || undefined })));
  };

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>Hromadné přidání štítků</Typography>
      <Stack spacing={1.5}>
        {rows.map((row, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="center">
            <TextField
              label={`Název ${i + 1}`}
              value={row.name}
              onChange={(e) => updateRow(i, 'name', e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{ maxLength: 50 }}
            />
            <TextField
              label="Barva"
              value={row.color}
              onChange={(e) => updateRow(i, 'color', e.target.value)}
              size="small"
              sx={{ width: 110 }}
              inputProps={{ maxLength: 20 }}
              InputProps={{
                startAdornment: row.color ? (
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: row.color,
                      mr: 0.5,
                      flexShrink: 0,
                    }}
                  />
                ) : undefined,
              }}
            />
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {COLOR_PRESETS.slice(0, 5).map((c) => (
                <Box
                  key={c}
                  onClick={() => updateRow(i, 'color', c)}
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    border: row.color === c ? '2px solid' : '1px solid transparent',
                    borderColor: row.color === c ? 'text.primary' : 'transparent',
                  }}
                />
              ))}
            </Stack>
            <IconButton size="small" color="error" onClick={() => removeRow(i)} disabled={rows.length <= 1}>
              <RemoveCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}

        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<AddIcon />} onClick={addRow} variant="text">
            Přidat řádek
          </Button>
        </Stack>

        {error && <Typography color="error" variant="caption">{error}</Typography>}

        <Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<CheckIcon />}
            onClick={handleSubmit}
            disabled={bulkMutation.isPending}
          >
            Vytvořit vše ({rows.filter((r) => r.name.trim()).length})
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
};

export const TodoTagsPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'single' | 'bulk'>('single');

  const tagsQuery = useQuery({
    queryKey: getTodoTagFindAllQueryKey(trackerId ?? ''),
    enabled: !!trackerId,
    queryFn: async ({ signal }) => {
      const res = await todoTagFindAll(trackerId!, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as TodoTagResponseDto[];
    },
  });

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>Štítky</PageHeading>
        <Alert severity="info" sx={{ maxWidth: 480 }}>
          Nejprve vyberte tracker v levém menu.
        </Alert>
      </Box>
    );
  }

  const tags: TodoTagResponseDto[] = tagsQuery.data ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <PageHeading component="h1">Štítky</PageHeading>
        {!showForm && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setFormMode('single'); setShowForm(true); }}>
              Nový štítek
            </Button>
            <Button variant="outlined" startIcon={<PlaylistAddIcon />} onClick={() => { setFormMode('bulk'); setShowForm(true); }}>
              Hromadně
            </Button>
          </Stack>
        )}
      </Stack>

      {showForm && (
        <Box mb={2} maxWidth={520}>
          <Stack direction="row" spacing={1} mb={1.5}>
            <Button
              size="small"
              variant={formMode === 'single' ? 'contained' : 'outlined'}
              onClick={() => setFormMode('single')}
            >
              Jeden štítek
            </Button>
            <Button
              size="small"
              variant={formMode === 'bulk' ? 'contained' : 'outlined'}
              onClick={() => setFormMode('bulk')}
            >
              Hromadně
            </Button>
          </Stack>

          {formMode === 'single' ? (
            <NewTagForm trackerId={trackerId} onCreated={() => setShowForm(false)} />
          ) : (
            <BulkTagForm trackerId={trackerId} onCreated={() => setShowForm(false)} />
          )}

          <Divider sx={{ my: 1.5 }} />
          <Button size="small" onClick={() => setShowForm(false)}>
            Skrýt formulář
          </Button>
        </Box>
      )}

      {tagsQuery.isLoading && (
        <Stack spacing={1} maxWidth={520}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={48} />)}
        </Stack>
      )}

      {tagsQuery.isError && (
        <Alert severity="error">Nepodařilo se načíst štítky.</Alert>
      )}

      {!tagsQuery.isLoading && !tagsQuery.isError && tags.length === 0 && !showForm && (
        <Alert severity="info" sx={{ maxWidth: 480 }}>
          Zatím žádné štítky. Vytvořte první pomocí tlačítka výše.
        </Alert>
      )}

      <Stack spacing={1} maxWidth={520}>
        {tags.map((tag) => (
          <TagRow key={tag.id} tag={tag} trackerId={trackerId} />
        ))}
      </Stack>
    </Box>
  );
};
