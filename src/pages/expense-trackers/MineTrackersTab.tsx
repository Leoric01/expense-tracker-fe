import {
  expenseTrackerCreate,
  expenseTrackerDeactivate,
  expenseTrackerFindAllMine,
  expenseTrackerUpdate,
} from '@api/expense-tracker-controller/expense-tracker-controller';
import { expenseTrackerAccessRequestInvite } from '@api/expense-tracker-access-request-controller/expense-tracker-access-request-controller';
import type {
  CreateExpenseTrackerRequestDto,
  ExpenseTrackerResponseDto,
  PagedModelExpenseTrackerMineResponseDto,
  UpdateExpenseTrackerRequestDto,
} from '@api/model';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useDebouncedValue } from '@hooks/useDebouncedValue';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useEffect, useMemo, useState } from 'react';
import { buildMineParams } from './buildListParams';
import { trackersTablePaperSx } from './trackersTableSurfaceSx';
import { formatDateDdMmYyyy } from './formatDateDdMmYyyy';
import { cycleSort, firstDirMine, type MineSortColumn, type SortDir } from './tableSort';

export const MineTrackersTab: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { selectedExpenseTracker, setSelectedExpenseTracker } = useSelectedExpenseTracker();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortColumn, setSortColumn] = useState<MineSortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sortParam = sortColumn ? `${sortColumn},${sortDir}` : undefined;

  const listParams = useMemo(
    () => buildMineParams(page, size, debouncedSearch, sortParam),
    [page, size, debouncedSearch, sortParam],
  );

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/expense-trackers/mine', listParams],
    queryFn: () => expenseTrackerFindAllMine(listParams),
  });

  const paged = data?.data as PagedModelExpenseTrackerMineResponseDto | undefined;
  const items = paged?.content ?? [];
  const meta = paged?.page;
  const totalElements = meta?.totalElements ?? 0;

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTrackerId, setInviteTrackerId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCurrency, setCreateCurrency] = useState('CZK');

  const handleSortClick = (col: MineSortColumn) => {
    const next = cycleSort(col, sortColumn, sortDir, firstDirMine);
    setSortColumn(next.active);
    setSortDir(next.dir);
    setPage(0);
  };

  const selectRow = (row: { id?: string; name?: string }) => {
    if (!row.id) return;
    if (selectedExpenseTracker?.id === row.id) {
      setSelectedExpenseTracker(null);
      return;
    }
    setSelectedExpenseTracker({ id: row.id, name: row.name ?? '—' });
  };

  const openEdit = (row: { id?: string; name?: string; description?: string; defaultCurrencyCode?: string }) => {
    if (!row.id) return;
    setEditId(row.id);
    setEditName(row.name ?? '');
    setEditDescription(row.description ?? '');
    setEditCurrency(row.defaultCurrencyCode ?? 'CZK');
    setEditOpen(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const payload: CreateExpenseTrackerRequestDto = {
      name: createName.trim(),
      description: createDescription.trim() || undefined,
      defaultCurrencyCode: createCurrency.trim().toUpperCase(),
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
        setSelectedExpenseTracker({ id: created.id, name: created.name ?? payload.name });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/mine'] });
    } catch {
      enqueueSnackbar('Nepodařilo se vytvořit tracker', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    const body: UpdateExpenseTrackerRequestDto = {
      name: editName.trim() || undefined,
      description: editDescription.trim() || undefined,
      defaultCurrencyCode: editCurrency.trim().toUpperCase() || undefined,
    };
    setSubmitting(true);
    try {
      const res = await expenseTrackerUpdate(editId, body);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Úprava selhala',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Tracker byl upraven', { variant: 'success' });
      setEditOpen(false);
      if (selectedExpenseTracker?.id === editId) {
        setSelectedExpenseTracker({ id: editId, name: editName.trim() || selectedExpenseTracker.name });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/mine'] });
    } catch {
      enqueueSnackbar('Úprava selhala', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setSubmitting(true);
    try {
      const res = await expenseTrackerDeactivate(deactivateId);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar('Odstranění se nepodařilo', { variant: 'error' });
        return;
      }
      enqueueSnackbar('Tracker byl odstraněn', { variant: 'success' });
      setDeactivateId(null);
      if (selectedExpenseTracker?.id === deactivateId) {
        setSelectedExpenseTracker(null);
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/mine'] });
    } catch {
      enqueueSnackbar('Odstranění se nepodařilo', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteTrackerId || !inviteEmail.trim()) return;
    setSubmitting(true);
    try {
      const res = await expenseTrackerAccessRequestInvite(inviteTrackerId, { email: inviteEmail.trim() });
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Pozvánka se nepodařila',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Pozvánka odeslána', { variant: 'success' });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteTrackerId(null);
      await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/access-requests/mine'] });
    } catch {
      enqueueSnackbar('Pozvánka se nepodařila', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'flex-end' }}>
        <TextField
          label="Hledat"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          placeholder="Filtruje při psaní…"
          autoFocus
        />
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => {
          setCreateName('');
          setCreateDescription('');
          setCreateCurrency('CZK');
          setCreateOpen(true);
        }}
        >
          Založit tracker
        </Button>
      </Stack>

      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst seznam trackerů.
        </Typography>
      )}

      <Paper sx={(theme) => trackersTablePaperSx(theme)}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sortColumn === 'name' ? sortDir : false}>
                <TableSortLabel
                  active={sortColumn === 'name'}
                  direction={sortColumn === 'name' ? sortDir : 'asc'}
                  onClick={() => handleSortClick('name')}
                >
                  Název
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortColumn === 'defaultCurrencyCode' ? sortDir : false}>
                <TableSortLabel
                  active={sortColumn === 'defaultCurrencyCode'}
                  direction={sortColumn === 'defaultCurrencyCode' ? sortDir : 'asc'}
                  onClick={() => handleSortClick('defaultCurrencyCode')}
                >
                  Měna
                </TableSortLabel>
              </TableCell>
              <TableCell>Role</TableCell>
              <TableCell sortDirection={sortColumn === 'createdDate' ? sortDir : false}>
                <TableSortLabel
                  active={sortColumn === 'createdDate'}
                  direction={sortColumn === 'createdDate' ? sortDir : 'desc'}
                  onClick={() => handleSortClick('createdDate')}
                >
                  Vytvořeno
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Akce</TableCell>
              <TableCell align="right" width={48}>
                Aktivní
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>Načítám…</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>Žádné výsledky.</TableCell>
              </TableRow>
            ) : (
              items.map((row) => {
                const isSelected = Boolean(row.id && selectedExpenseTracker?.id === row.id);
                const isOwner = (row.role ?? '').toUpperCase() === 'OWNER';
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
                    <TableCell>{formatDateDdMmYyyy(row.createdDate)}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0} justifyContent="flex-end">
                        <Tooltip title="Upravit">
                          <IconButton size="small" onClick={() => openEdit(row)} aria-label="upravit">
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Vymazat">
                          <IconButton
                            size="small"
                            onClick={() => row.id && setDeactivateId(row.id)}
                            aria-label="vymazat"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {isOwner && row.id && (
                          <Tooltip title="Pozvat uživatele">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setInviteTrackerId(row.id!);
                                setInviteEmail('');
                                setInviteOpen(true);
                              }}
                              aria-label="pozvat"
                            >
                              <PersonAddOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {isSelected ? (
                        <CheckCircleIcon color="primary" fontSize="small" aria-label="vybráno" />
                      ) : (
                        <Box component="span" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
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
        <TablePagination
          component="div"
          count={totalElements}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={size}
          onRowsPerPageChange={(e) => {
            setSize(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Řádků na stránku"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} z ${count !== -1 ? count : `více než ${to}`}`}
        />
      </Paper>

      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nový expense tracker</DialogTitle>
        <Box component="form" onSubmit={handleCreate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Popis (volitelné)"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                label="Výchozí měna (ISO)"
                value={createCurrency}
                onChange={(e) => setCreateCurrency(e.target.value)}
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

      <Dialog open={editOpen} onClose={() => !submitting && setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Upravit tracker</DialogTitle>
        <Box component="form" onSubmit={handleUpdate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField label="Název" value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth required />
              <TextField
                label="Popis"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                label="Měna"
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                fullWidth
                inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setEditOpen(false)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Uložit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(deactivateId)} onClose={() => !submitting && setDeactivateId(null)}>
        <DialogTitle>Vymazat tracker?</DialogTitle>
        <DialogContent>
          <Typography>Tracker bude odstraněn z dostupných rozpočtů. Opravdu pokračovat?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateId(null)} disabled={submitting}>
            Zrušit
          </Button>
          <Button color="error" variant="contained" onClick={handleDeactivate} disabled={submitting}>
            Odstranit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inviteOpen} onClose={() => !submitting && setInviteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Pozvat uživatele e-mailem</DialogTitle>
        <Box component="form" onSubmit={handleInvite}>
          <DialogContent>
            <TextField
              label="E-mail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
            />
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setInviteOpen(false)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Odeslat pozvánku
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};
