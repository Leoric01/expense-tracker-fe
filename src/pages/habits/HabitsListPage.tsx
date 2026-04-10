import { habitFindAll, getHabitFindAllQueryKey } from '@api/habit-controller/habit-controller';
import type { HabitFindAllParams } from '@api/model/habitFindAllParams';
import type { HabitResponseDto } from '@api/model/habitResponseDto';
import type { PagedModelHabitResponseDto } from '@api/model/pagedModelHabitResponseDto';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FC, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HABIT_TYPE_LABELS } from './habitUiConstants';

type ActiveFilter = 'all' | 'active' | 'inactive';

export const HabitsListPage: FC = () => {
  const navigate = useNavigate();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id ?? '';

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const listParams: HabitFindAllParams = useMemo(() => {
    const p: HabitFindAllParams = {
      page,
      size: rowsPerPage,
    };
    if (debouncedSearch) {
      p.search = debouncedSearch;
    }
    if (activeFilter === 'active') {
      p.active = true;
    } else if (activeFilter === 'inactive') {
      p.active = false;
    }
    return p;
  }, [page, rowsPerPage, debouncedSearch, activeFilter]);

  const listQuery = useQuery({
    queryKey: getHabitFindAllQueryKey(trackerId, listParams),
    enabled: !!trackerId,
    queryFn: async ({ signal }) => {
      const res = await habitFindAll(trackerId, listParams, { signal });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as PagedModelHabitResponseDto;
    },
  });

  const rows: HabitResponseDto[] = listQuery.data?.content ?? [];
  const total = listQuery.data?.page?.totalElements ?? 0;

  const noTracker = useMemo(
    () => (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Návyky
        </PageHeading>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nejprve vyber rozpočet (tracker) v menu u položky Trackery.
        </Typography>
        <Button component={Link} to="/trackers" variant="contained">
          Otevřít trackery
        </Button>
      </Box>
    ),
    [],
  );

  if (!trackerId) {
    return noTracker;
  }

  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        Návyky
      </PageHeading>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <TextField
          label="Hledat"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ minWidth: { md: 280 } }}
          placeholder="Název nebo popis…"
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={activeFilter}
          onChange={(_, v: ActiveFilter | null) => {
            if (v != null) {
              setActiveFilter(v);
              setPage(0);
            }
          }}
          aria-label="Stav návyku"
        >
          <ToggleButton value="all">Vše</ToggleButton>
          <ToggleButton value="active">Aktivní</ToggleButton>
          <ToggleButton value="inactive">Neaktivní</ToggleButton>
        </ToggleButtonGroup>
        <Button component={Link} to="/habits/new" variant="contained" startIcon={<AddIcon />}>
          Nový návyk
        </Button>
      </Stack>

      {listQuery.isLoading && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          Načítám…
        </Typography>
      )}
      {listQuery.isError && (
        <Typography color="error" sx={{ py: 2 }}>
          Seznam se nepodařilo načíst.
        </Typography>
      )}

      {!listQuery.isLoading && !listQuery.isError && (
        <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxWidth: '100%' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Název</TableCell>
                  <TableCell>Typ</TableCell>
                  <TableCell align="right">Min</TableCell>
                  <TableCell>Stav</TableCell>
                  <TableCell>Platnost</TableCell>
                  <TableCell align="right">Sloty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="text.secondary" variant="body2">
                        Žádné návyky — vytvoř první tlačítkem výše.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const id = row.id;
                    const typeKey = row.habitType as keyof typeof HABIT_TYPE_LABELS | undefined;
                    const typeLabel =
                      typeKey && HABIT_TYPE_LABELS[typeKey] ? HABIT_TYPE_LABELS[typeKey] : row.habitType ?? '—';
                    const slots = row.scheduleSlots?.length ?? 0;
                    return (
                      <TableRow
                        key={id ?? row.name}
                        hover
                        onClick={id ? () => navigate(`/habits/${id}`) : undefined}
                        sx={id ? { cursor: 'pointer' } : undefined}
                      >
                        <TableCell>
                          {id ? (
                            <Link
                              to={`/habits/${id}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}
                            >
                              {row.name ?? '—'}
                            </Link>
                          ) : (
                            <Typography component="span" fontWeight={600}>
                              {row.name ?? '—'}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{typeLabel}</TableCell>
                        <TableCell align="right">{row.expectedMinutes ?? '—'}</TableCell>
                        <TableCell>
                          {row.active ? (
                            <Chip label="Aktivní" color="success" size="small" variant="outlined" />
                          ) : (
                            <Chip label="Neaktivní" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {row.validFrom
                            ? `${row.validFrom}${row.validTo ? ` → ${row.validTo}` : ' → ∞'}`
                            : '—'}
                        </TableCell>
                        <TableCell align="right">{slots}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number.parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="Řádků"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} z ${count !== -1 ? count : `více než ${to}`}`}
          />
        </Paper>
      )}
    </Box>
  );
};
