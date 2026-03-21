import {
  expenseTrackerAccessRequestAccept,
  expenseTrackerAccessRequestApprove,
  expenseTrackerAccessRequestCancel,
  expenseTrackerAccessRequestFindAllMine,
  expenseTrackerAccessRequestReject,
} from '@api/expense-tracker-access-request-controller/expense-tracker-access-request-controller';
import { profileMe } from '@api/profile-controller/profile-controller';
import type { ExpenseTrackerAccessRequestResponseDto } from '@api/model';
import { ExpenseTrackerAccessRequestResponseDtoStatus } from '@api/model/expenseTrackerAccessRequestResponseDtoStatus';
import { ExpenseTrackerAccessRequestResponseDtoType } from '@api/model/expenseTrackerAccessRequestResponseDtoType';
import type { PagedModelExpenseTrackerAccessRequestResponseDto } from '@api/model/pagedModelExpenseTrackerAccessRequestResponseDto';
import {
  Box,
  Button,
  Chip,
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
import { buildAccessRequestMineParams } from './buildListParams';
import { trackersTablePaperSx } from './trackersTableSurfaceSx';
import { formatDateDdMmYyyy } from './formatDateDdMmYyyy';
import { cycleSort, firstDirAccessRequest, type SortDir } from './tableSort';

function statusLabel(s?: string): string {
  switch (s) {
    case ExpenseTrackerAccessRequestResponseDtoStatus.PENDING:
      return 'Čeká';
    case ExpenseTrackerAccessRequestResponseDtoStatus.APPROVED:
      return 'Schváleno';
    case ExpenseTrackerAccessRequestResponseDtoStatus.REJECTED:
      return 'Zamítnuto';
    case ExpenseTrackerAccessRequestResponseDtoStatus.CANCELLED:
      return 'Zrušeno';
    default:
      return s ?? '—';
  }
}

function typeLabel(t?: string): string {
  switch (t) {
    case ExpenseTrackerAccessRequestResponseDtoType.REQUEST:
      return 'Žádost';
    case ExpenseTrackerAccessRequestResponseDtoType.INVITE:
      return 'Pozvánka';
    default:
      return t ?? '—';
  }
}

type MeProfile = { id?: string; email?: string };

export const AccessRequestsTab: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const { data: meRes } = useQuery({
    queryKey: ['/profile/me'],
    queryFn: () => profileMe(),
  });
  const me = (meRes?.data ?? {}) as MeProfile;
  const myId = me.id?.trim();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortColumn, setSortColumn] = useState<'expenseTrackerName' | 'requestDate' | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [busyId, setBusyId] = useState<string | null>(null);

  const sortParam = sortColumn ? `${sortColumn},${sortDir}` : undefined;

  const listParams = useMemo(
    () => buildAccessRequestMineParams(page, size, debouncedSearch, sortParam),
    [page, size, debouncedSearch, sortParam],
  );

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/expense-trackers/access-requests/mine', listParams],
    queryFn: () => expenseTrackerAccessRequestFindAllMine(listParams),
  });

  const paged = data?.data as PagedModelExpenseTrackerAccessRequestResponseDto | undefined;
  const items = (paged?.content ?? []) as ExpenseTrackerAccessRequestResponseDto[];
  const meta = paged?.page;
  const totalElements = meta?.totalElements ?? 0;

  const handleSortClick = (col: 'expenseTrackerName' | 'requestDate') => {
    const next = cycleSort(col, sortColumn, sortDir, firstDirAccessRequest);
    setSortColumn(next.active);
    setSortDir(next.dir);
    setPage(0);
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/access-requests/mine'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/mine'] });
  };

  const run = async (fn: () => Promise<{ status: number }>, okMsg: string) => {
    try {
      const res = await fn();
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar('Operace selhala', { variant: 'error' });
        return;
      }
      enqueueSnackbar(okMsg, { variant: 'success' });
      await invalidate();
    } catch {
      enqueueSnackbar('Operace selhala', { variant: 'error' });
    }
  };

  const handleApprove = (requestId: string) => {
    setBusyId(requestId);
    void run(() => expenseTrackerAccessRequestApprove(requestId), 'Žádost schválena').finally(() =>
      setBusyId(null),
    );
  };

  const handleReject = (requestId: string) => {
    setBusyId(requestId);
    void run(() => expenseTrackerAccessRequestReject(requestId), 'Žádost zamítnuta').finally(() =>
      setBusyId(null),
    );
  };

  const handleAccept = (requestId: string) => {
    setBusyId(requestId);
    void run(() => expenseTrackerAccessRequestAccept(requestId), 'Pozvánka přijata').finally(() =>
      setBusyId(null),
    );
  };

  const handleCancel = (requestId: string) => {
    setBusyId(requestId);
    void run(() => expenseTrackerAccessRequestCancel(requestId), 'Žádost zrušena').finally(() =>
      setBusyId(null),
    );
  };

  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Žádosti a pozvánky k trackerům. Po schválení nebo přijetí se tracker objeví mezi „Moje trackery“.
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
          Nepodařilo se načíst žádosti.
        </Typography>
      )}

      <Paper sx={(theme) => trackersTablePaperSx(theme)}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sortColumn === 'expenseTrackerName' ? sortDir : false}>
                <TableSortLabel
                  active={sortColumn === 'expenseTrackerName'}
                  direction={sortColumn === 'expenseTrackerName' ? sortDir : 'asc'}
                  onClick={() => handleSortClick('expenseTrackerName')}
                >
                  Tracker
                </TableSortLabel>
              </TableCell>
              <TableCell>Typ</TableCell>
              <TableCell>Stav</TableCell>
              <TableCell sortDirection={sortColumn === 'requestDate' ? sortDir : false}>
                <TableSortLabel
                  active={sortColumn === 'requestDate'}
                  direction={sortColumn === 'requestDate' ? sortDir : 'desc'}
                  onClick={() => handleSortClick('requestDate')}
                >
                  Vytvořeno
                </TableSortLabel>
              </TableCell>
              <TableCell>Kontakt</TableCell>
              <TableCell align="right">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>Načítám…</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>Žádné žádosti.</TableCell>
              </TableRow>
            ) : (
              items.map((row) => {
                const isPending = row.status === ExpenseTrackerAccessRequestResponseDtoStatus.PENDING;
                const isInvite = row.type === ExpenseTrackerAccessRequestResponseDtoType.INVITE;
                const isRequest = row.type === ExpenseTrackerAccessRequestResponseDtoType.REQUEST;
                const rid = row.id;
                const busy = Boolean(rid && busyId === rid);
                const uid = row.userId?.trim();
                const imTargetUser = Boolean(myId && uid && myId === uid);

                let actions: 'invite_target' | 'invite_owner' | 'request_self' | 'request_owner' | null = null;
                if (isPending && myId) {
                  if (isInvite) actions = imTargetUser ? 'invite_target' : 'invite_owner';
                  else if (isRequest) actions = imTargetUser ? 'request_self' : 'request_owner';
                }

                return (
                  <TableRow key={rid ?? `${row.expenseTrackerId}-${row.userEmail}`}>
                    <TableCell>{row.expenseTrackerName ?? '—'}</TableCell>
                    <TableCell>{typeLabel(row.type)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={statusLabel(row.status)} variant="outlined" />
                    </TableCell>
                    <TableCell>{formatDateDdMmYyyy(row.requestDate)}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        noWrap
                        title={
                          isInvite
                            ? [row.invitedByFullName, row.userEmail, row.userFullName].filter(Boolean).join(' · ')
                            : (row.userEmail ?? row.userFullName ?? '')
                        }
                      >
                        {isInvite && row.invitedByFullName
                          ? `${row.invitedByFullName} → ${row.userEmail ?? row.userFullName ?? '—'}`
                          : (row.userFullName ?? row.userEmail ?? '—')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {rid && isPending && actions === 'invite_target' && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                          <Button size="small" disabled={busy} onClick={() => handleAccept(rid)}>
                            Přijmout
                          </Button>
                          <Button size="small" disabled={busy} onClick={() => handleReject(rid)}>
                            Odmítnout
                          </Button>
                        </Stack>
                      )}
                      {rid && isPending && actions === 'invite_owner' && (
                        <Button size="small" disabled={busy} onClick={() => handleCancel(rid)}>
                          Zrušit pozvánku
                        </Button>
                      )}
                      {rid && isPending && actions === 'request_owner' && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                          <Button size="small" disabled={busy} onClick={() => handleApprove(rid)}>
                            Schválit
                          </Button>
                          <Button size="small" disabled={busy} onClick={() => handleReject(rid)}>
                            Zamítnout
                          </Button>
                        </Stack>
                      )}
                      {rid && isPending && actions === 'request_self' && (
                        <Button size="small" disabled={busy} onClick={() => handleCancel(rid)}>
                          Zrušit žádost
                        </Button>
                      )}
                      {isPending && !actions && (
                        <Typography variant="caption" color="text.secondary">
                          Nelze určit roli
                        </Typography>
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
    </Box>
  );
};
