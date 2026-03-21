import {
  expenseTrackerCreate,
  expenseTrackerFindAllMine,
} from '@api/expense-tracker-controller/expense-tracker-controller';
import type {
  CreateExpenseTrackerRequestDto,
  ExpenseTrackerResponseDto,
  PagedModelExpenseTrackerMineResponseDto,
} from '@api/model';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useEffect, useState } from 'react';

const MINE_QUERY_KEY = ['/api/expense-trackers/mine', { page: 0, size: 50 }] as const;

export const ExpenseTrackers: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { selectedExpenseTracker, setSelectedExpenseTracker } = useSelectedExpenseTracker();
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultCurrencyCode, setDefaultCurrencyCode] = useState('CZK');

  const { data, isLoading, isError } = useQuery({
    queryKey: MINE_QUERY_KEY,
    queryFn: () => expenseTrackerFindAllMine({ page: 0, size: 50 }),
  });

  const page = data?.data as PagedModelExpenseTrackerMineResponseDto | undefined;
  const items = page?.content ?? [];

  useEffect(() => {
    if (!selectedExpenseTracker?.id || items.length === 0) return;
    const exists = items.some((i) => i.id === selectedExpenseTracker.id);
    if (!exists) {
      setSelectedExpenseTracker(null);
    }
  }, [items, selectedExpenseTracker?.id, setSelectedExpenseTracker]);

  const selectRow = (row: { id?: string; name?: string }) => {
    if (!row.id) return;
    setSelectedExpenseTracker({ id: row.id, name: row.name ?? '—' });
  };

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setDefaultCurrencyCode('CZK');
    setCreateOpen(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const payload: CreateExpenseTrackerRequestDto = {
      name: name.trim(),
      description: description.trim() || undefined,
      defaultCurrencyCode: defaultCurrencyCode.trim().toUpperCase(),
    };
    if (!payload.name || !payload.defaultCurrencyCode) {
      enqueueSnackbar('Vyplň název a měnu', { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await expenseTrackerCreate(payload);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Nepodařilo se vytvořit tracker',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Expense tracker byl vytvořen', { variant: 'success' });
      setCreateOpen(false);
      const created = res.data as ExpenseTrackerResponseDto | undefined;
      if (created?.id) {
        setSelectedExpenseTracker({
          id: created.id,
          name: created.name ?? payload.name,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/mine'] });
    } catch {
      enqueueSnackbar('Nepodařilo se vytvořit tracker', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Moje expense trackery
          </Typography>
          <Typography color="text.secondary">
            Založ si vlastní tracker — výdaje a sdílení pak doplníme.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleOpenCreate}>
          Založit tracker
        </Button>
      </Stack>

      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst seznam trackerů.
        </Typography>
      )}

      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Název</TableCell>
              <TableCell>Měna</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Stav</TableCell>
              <TableCell align="right" width={56}>
                Aktivní
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>Načítám…</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Zatím žádný tracker — založ první.</TableCell>
              </TableRow>
            ) : (
              items.map((row) => {
                const isSelected = Boolean(row.id && selectedExpenseTracker?.id === row.id);
                return (
                  <TableRow
                    key={row.id ?? row.name}
                    hover
                    selected={isSelected}
                    onClick={() => selectRow(row)}
                    sx={{ cursor: row.id ? 'pointer' : 'default' }}
                  >
                    <TableCell>{row.name ?? '—'}</TableCell>
                    <TableCell>{row.defaultCurrencyCode ?? '—'}</TableCell>
                    <TableCell>{row.role ?? '—'}</TableCell>
                    <TableCell>{row.active === false ? 'Neaktivní' : 'Aktivní'}</TableCell>
                    <TableCell align="right">
                      {isSelected ? (
                        <CheckCircleIcon color="primary" fontSize="small" aria-label="vybráno" />
                      ) : (
                        <Box component="span" sx={{ color: 'text.disabled', fontSize: 12 }}>
                          —
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nový expense tracker</DialogTitle>
        <Box component="form" onSubmit={handleCreate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                autoFocus
              />
              <TextField
                label="Popis (volitelné)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                label="Výchozí měna (ISO, např. CZK)"
                value={defaultCurrencyCode}
                onChange={(e) => setDefaultCurrencyCode(e.target.value)}
                required
                fullWidth
                inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Vytvořit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};
