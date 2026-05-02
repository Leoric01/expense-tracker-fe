import {
  expenseTrackerCreate,
  expenseTrackerDeactivate,
  expenseTrackerFindAllMine,
  expenseTrackerUpdate,
} from '@api/expense-tracker-controller/expense-tracker-controller';
import { assetFindAll, getAssetFindAllQueryKey } from '@api/asset-controller/asset-controller';
import { AssetResponseDtoMarketDataSource } from '@api/model';
import { expenseTrackerAccessRequestInvite } from '@api/expense-tracker-access-request-controller/expense-tracker-access-request-controller';
import type {
  AssetResponseDto,
  CreateExpenseTrackerRequestDto,
  ExpenseTrackerResponseDto,
  PagedModelExpenseTrackerMineResponseDto,
  PagedModelAssetResponseDto,
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
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { DISPLAY_CURRENCY_POPULAR_CODES } from '@utils/displayCurrencyPopularCodes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, type SubmitEvent, useEffect, useMemo, useState } from 'react';
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
  const [editPreferredDisplayAssetId, setEditPreferredDisplayAssetId] = useState('');
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTrackerId, setInviteTrackerId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPreferredDisplayAssetId, setCreatePreferredDisplayAssetId] = useState('');

  const { data: assetsRes } = useQuery({
    queryKey: getAssetFindAllQueryKey({ page: 0, size: 500 }),
    queryFn: async () => {
      const res = await assetFindAll({ page: 0, size: 500 });
      if (res.status < 200 || res.status >= 300) throw new Error('assets');
      return res.data as PagedModelAssetResponseDto;
    },
    staleTime: 60_000,
  });

  const displayAssetOptions = useMemo(() => {
    const rows = assetsRes?.content ?? [];
    return rows
      .filter(
        (a) =>
          a.active !== false &&
          a.id &&
          a.marketDataSource !== AssetResponseDtoMarketDataSource.NONE &&
          a.marketDataSource !== AssetResponseDtoMarketDataSource.MANUAL,
      )
      .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { sensitivity: 'base' }));
  }, [assetsRes]);

  const popularDisplayAssetOptions = useMemo(() => {
    const byCode = new Map(displayAssetOptions.map((a) => [(a.code ?? '').toUpperCase(), a]));
    return DISPLAY_CURRENCY_POPULAR_CODES.map((code) => byCode.get(code)).filter((a): a is AssetResponseDto =>
      Boolean(a?.id),
    );
  }, [displayAssetOptions]);

  const otherDisplayAssetOptions = useMemo(() => {
    const popularIds = new Set(popularDisplayAssetOptions.map((a) => a.id));
    return displayAssetOptions.filter((a) => !popularIds.has(a.id));
  }, [displayAssetOptions, popularDisplayAssetOptions]);

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

  const openEdit = (row: {
    id?: string;
    name?: string;
    description?: string;
    preferredDisplayAssetId?: string;
  }) => {
    if (!row.id) return;
    setEditId(row.id);
    setEditName(row.name ?? '');
    setEditDescription(row.description ?? '');
    setEditPreferredDisplayAssetId(row.preferredDisplayAssetId ?? '');
    setEditOpen(true);
  };

  const handleCreate = async (e: SubmitEvent) => {
    e.preventDefault();
    const payload: CreateExpenseTrackerRequestDto = {
      name: createName.trim(),
      description: createDescription.trim() || undefined,
      preferredDisplayAssetId: createPreferredDisplayAssetId || (null as unknown as string),
    };
    if (!payload.name) {
      enqueueSnackbar('Vyplň název trackeru', { variant: 'warning' });
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

  const handleUpdate = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!editId) return;
    const body: UpdateExpenseTrackerRequestDto = {
      name: editName.trim() || undefined,
      description: editDescription.trim() || undefined,
      preferredDisplayAssetId: editPreferredDisplayAssetId || (null as unknown as string),
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

  const handleInvite = async (e: SubmitEvent) => {
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
          setCreatePreferredDisplayAssetId('');
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
              <TableCell sortDirection={sortColumn === 'preferredDisplayAssetCode' ? sortDir : false}>
                <TableSortLabel
                  active={sortColumn === 'preferredDisplayAssetCode'}
                  direction={sortColumn === 'preferredDisplayAssetCode' ? sortDir : 'asc'}
                  onClick={() => handleSortClick('preferredDisplayAssetCode')}
                >
                  Display měna
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
                    <TableCell>{row.preferredDisplayAssetCode ?? '—'}</TableCell>
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
              <FormControl fullWidth>
                <InputLabel id="create-display-asset-label">Preferovaná měna pro zobrazení</InputLabel>
                <Select
                  labelId="create-display-asset-label"
                  label="Preferovaná měna pro zobrazení"
                  value={createPreferredDisplayAssetId}
                  onChange={(e) => setCreatePreferredDisplayAssetId(e.target.value)}
                >
                  <MenuItem value="">Bez konverze</MenuItem>
                  {popularDisplayAssetOptions.map((asset: AssetResponseDto) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      {asset.code} - {asset.name}
                    </MenuItem>
                  ))}
                  {otherDisplayAssetOptions.length > 0 && <Divider />}
                  {otherDisplayAssetOptions.map((asset: AssetResponseDto) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      {asset.code} - {asset.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
              <FormControl fullWidth>
                <InputLabel id="edit-display-asset-label">Preferovaná měna pro zobrazení</InputLabel>
                <Select
                  labelId="edit-display-asset-label"
                  label="Preferovaná měna pro zobrazení"
                  value={editPreferredDisplayAssetId}
                  onChange={(e) => setEditPreferredDisplayAssetId(e.target.value)}
                >
                  <MenuItem value="">Bez konverze</MenuItem>
                  {popularDisplayAssetOptions.map((asset: AssetResponseDto) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      {asset.code} - {asset.name}
                    </MenuItem>
                  ))}
                  {otherDisplayAssetOptions.length > 0 && <Divider />}
                  {otherDisplayAssetOptions.map((asset: AssetResponseDto) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      {asset.code} - {asset.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
