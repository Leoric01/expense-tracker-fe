import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  kanbanTagCreateBulk,
  kanbanTagDelete,
  kanbanTagFindAll,
  kanbanTagUpdate,
  getKanbanTagFindAllQueryKey,
} from '@api/kanban-tag-controller/kanban-tag-controller';
import type { KanbanTagResponseDto, KanbanTagUpsertRequestDto } from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
  Alert,
  Box,
  Button,
  Chip,
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

// ─── Color picker ────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#e53935', '#8e24aa', '#1e88e5', '#00897b',
  '#43a047', '#f4511e', '#fb8c00', '#fdd835',
  '#6d4c41', '#546e7a',
];

type ColorPickerRowProps = { value: string; onChange: (color: string) => void };

const ColorPickerRow: FC<ColorPickerRowProps> = ({ value, onChange }) => (
  <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
    {COLOR_PRESETS.map((c) => (
      <Box
        key={c}
        onClick={() => onChange(c)}
        sx={{
          width: 22, height: 22, borderRadius: '50%', bgcolor: c,
          cursor: 'pointer', flexShrink: 0,
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
          width: 22, height: 22, borderRadius: '50%', border: 'none',
          padding: 0, cursor: 'pointer', flexShrink: 0,
          outline: value && !COLOR_PRESETS.includes(value) ? '2px solid' : '2px solid transparent',
          outlineColor: value && !COLOR_PRESETS.includes(value) ? 'text.primary' : 'transparent',
          outlineOffset: '1px', backgroundColor: 'transparent',
          '&::-webkit-color-swatch-wrapper': { padding: 0 },
          '&::-webkit-color-swatch': { borderRadius: '50%', border: 'none' },
        }}
      />
    </Tooltip>
  </Stack>
);

// ─── Tag row (edit / delete) ─────────────────────────────────────────────────

type TagRowProps = { tag: KanbanTagResponseDto; trackerId: string };

const TagRow: FC<TagRowProps> = ({ tag, trackerId }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name ?? '');
  const [color, setColor] = useState(tag.color ?? '');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getKanbanTagFindAllQueryKey(trackerId) });

  const updateMutation = useMutation({
    mutationFn: (data: KanbanTagUpsertRequestDto) => kanbanTagUpdate(trackerId, tag.id!, data),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => kanbanTagDelete(trackerId, tag.id!),
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
            label="Název" value={name}
            onChange={(e) => setName(e.target.value)}
            size="small" fullWidth autoFocus
          />
          <ColorPickerRow value={color} onChange={setColor} />
          {color && (
            <Box>
              <Chip label={name || 'Náhled'} size="small" sx={{ bgcolor: color, color: '#fff' }} />
            </Box>
          )}
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" startIcon={<CheckIcon />}
              onClick={handleSave} disabled={updateMutation.isPending}>
              Uložit
            </Button>
            <Button size="small" startIcon={<CloseIcon />} onClick={handleCancel}>Zrušit</Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center' }}>
      <Chip
        label={tag.name} size="small"
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
        <IconButton size="small" color="error"
          onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
};

// ─── Bulk create form ────────────────────────────────────────────────────────

type BulkRow = { name: string; color: string };

const BulkTagForm: FC<{ trackerId: string }> = ({ trackerId }) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BulkRow[]>([{ name: '', color: '' }, { name: '', color: '' }]);
  const [error, setError] = useState('');

  const addRow = () => setRows((r) => [...r, { name: '', color: '' }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof BulkRow, val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  const bulkMutation = useMutation({
    mutationFn: (data: KanbanTagUpsertRequestDto[]) => kanbanTagCreateBulk(trackerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getKanbanTagFindAllQueryKey(trackerId) });
      setRows([{ name: '', color: '' }, { name: '', color: '' }]);
      setError('');
    },
    onError: () => setError('Nepodařilo se hromadně vytvořit štítky.'),
  });

  const handleSubmit = () => {
    const valid = rows.filter((r) => r.name.trim());
    if (valid.length === 0) { setError('Zadejte alespoň jeden název.'); return; }
    bulkMutation.mutate(valid.map((r) => ({ name: r.name.trim(), color: r.color || undefined })));
  };

  return (
    <Stack spacing={1.5}>
      {rows.map((row, i) => (
        <Stack key={i} spacing={0.75}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label={`Název ${i + 1}`} value={row.name}
              onChange={(e) => updateRow(i, 'name', e.target.value)}
              size="small" sx={{ flex: 1 }} inputProps={{ maxLength: 50 }}
            />
            {row.color && (
              <Chip label={row.name || '·'} size="small"
                sx={{ bgcolor: row.color, color: '#fff', flexShrink: 0 }} />
            )}
            <IconButton size="small" color="error"
              onClick={() => removeRow(i)} disabled={rows.length <= 1}>
              <RemoveCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
          <ColorPickerRow value={row.color} onChange={(c) => updateRow(i, 'color', c)} />
        </Stack>
      ))}

      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addRow} variant="text">
          Přidat řádek
        </Button>
      </Box>

      {error && <Typography color="error" variant="caption">{error}</Typography>}

      <Box>
        <Button variant="contained" size="small" startIcon={<CheckIcon />}
          onClick={handleSubmit} disabled={bulkMutation.isPending}>
          Vytvořit vše ({rows.filter((r) => r.name.trim()).length})
        </Button>
      </Box>
    </Stack>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const KanbanTagsPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const [showForm, setShowForm] = useState(false);

  const tagsQuery = useQuery({
    queryKey: getKanbanTagFindAllQueryKey(trackerId ?? ''),
    enabled: !!trackerId,
    queryFn: async ({ signal }) => {
      const res = await kanbanTagFindAll(trackerId!, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as KanbanTagResponseDto[];
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

  const tags: KanbanTagResponseDto[] = tagsQuery.data ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <PageHeading component="h1">Štítky</PageHeading>
        <Button
          variant={showForm ? 'outlined' : 'contained'}
          startIcon={showForm ? <CloseIcon /> : <AddIcon />}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Zavřít' : 'Nový štítek'}
        </Button>
      </Stack>

      {showForm && (
        <Paper variant="outlined" sx={{ px: 2.5, py: 2, mb: 3, maxWidth: 560 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Nový štítek
          </Typography>
          <BulkTagForm trackerId={trackerId} />
        </Paper>
      )}

      {tagsQuery.isLoading && (
        <Stack spacing={1} maxWidth={520}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={48} />)}
        </Stack>
      )}
      {tagsQuery.isError && <Alert severity="error">Nepodařilo se načíst štítky.</Alert>}
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
