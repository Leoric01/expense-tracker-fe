import { expenseTrackerFindAllButMine } from '@api/expense-tracker-controller/expense-tracker-controller';
import { expenseTrackerAccessRequestCreate } from '@api/expense-tracker-access-request-controller/expense-tracker-access-request-controller';
import type { PagedModelExpenseTrackerResponseDto } from '@api/model';
import {
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import { useDebouncedValue } from '@hooks/useDebouncedValue';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, useEffect, useMemo, useState } from 'react';
import { buildFindAllButMineParams } from './buildListParams';
import { formatDateDdMmYyyy } from './formatDateDdMmYyyy';
import { cycleSort, firstDirTracker, type SortDir } from './tableSort';

export const BrowseTrackersTab: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortColumn, setSortColumn] = useState<'name' | 'createdDate' | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const sortParam = sortColumn ? `${sortColumn},${sortDir}` : undefined;

  const listParams = useMemo(
    () => buildFindAllButMineParams(page, size, debouncedSearch, sortParam),
    [page, size, debouncedSearch, sortParam],
  );

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/expense-trackers/discover', listParams],
    queryFn: () => expenseTrackerFindAllButMine(listParams),
  });

  const paged = data?.data as PagedModelExpenseTrackerResponseDto | undefined;
  const items = paged?.content ?? [];
  const meta = paged?.page;
  const totalElements = meta?.totalElements ?? 0;

  const handleSortClick = (col: 'name' | 'createdDate') => {
    const next = cycleSort(col, sortColumn, sortDir, firstDirTracker);
    setSortColumn(next.active);
    setSortDir(next.dir);
    setPage(0);
  };

  const requestAccess = async (trackerId: string) => {
    setRequestingId(trackerId);
    try {
      const res = await expenseTrackerAccessRequestCreate(trackerId);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Žádost se nepodařila odeslat',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Žádost o přístup byla odeslána', { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/access-requests/mine'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/discover'] });
    } catch {
      enqueueSnackbar('Žádost se nepodařila odeslat', { variant: 'error' });
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Najdi tracker (např. rodinný) a požádej o přístup. Po schválení se objeví v záložce „Moje trackery“.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'flex-end' }}>
        <TextField
          label="Hledat"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          placeholder="Filtruje při psaní…"
        />
      </Stack>

      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst trackery.
        </Typography>
      )}

      <Paper sx={{ overflow: 'auto' }}>
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
              <TableCell>Vlastník</TableCell>
              <TableCell>Měna</TableCell>
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
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>Načítám…</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Žádné výsledky.</TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id ?? row.name}>
                  <TableCell>{row.name ?? '—'}</TableCell>
                  <TableCell>{row.ownerFullName ?? '—'}</TableCell>
                  <TableCell>{row.defaultCurrencyCode ?? '—'}</TableCell>
                  <TableCell>{formatDateDdMmYyyy(row.createdDate)}</TableCell>
                  <TableCell align="right">
                    {row.id && (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={requestingId === row.id}
                        onClick={() => requestAccess(row.id!)}
                      >
                        {requestingId === row.id ? 'Odesílám…' : 'Požádat o přístup'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
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
    </Box>
  );
};
