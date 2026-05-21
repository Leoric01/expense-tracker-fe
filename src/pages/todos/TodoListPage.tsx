import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { todoFindTree, getTodoFindTreeQueryKey } from '@api/todo-controller/todo-controller';
import type { TodoFindTreeParams, TodoFindTreePriority, TodoFindTreeStatus } from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FC, useState } from 'react';
import { TodoFormDialog } from './TodoFormDialog';
import { TODO_PRIORITY_LABELS, TODO_STATUS_LABELS } from './todoUiConstants';
import { TodoTreeTable, type TodoTreeNode } from './TodoTreeTable';

export const TodoListPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TodoFindTreeStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TodoFindTreePriority | ''>('');

  const [createOpen, setCreateOpen] = useState(false);

  const filterParams: TodoFindTreeParams = {
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    active: true,
  };

  const todosQuery = useQuery({
    queryKey: getTodoFindTreeQueryKey(trackerId ?? '', filterParams),
    enabled: !!trackerId,
    queryFn: async ({ signal }) => {
      const res = await todoFindTree(trackerId!, filterParams, { signal });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data as unknown as TodoTreeNode[];
    },
  });

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>ToDo</PageHeading>
        <Alert severity="info" sx={{ maxWidth: 480 }}>
          Nejprve vyberte tracker v levém menu.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <PageHeading component="h1">ToDo</PageHeading>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Nový úkol
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} mb={2} flexWrap="wrap" alignItems="center">
        <TextField
          label="Hledat"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 200 }}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Stav</InputLabel>
          <Select
            value={statusFilter}
            label="Stav"
            onChange={(e) => setStatusFilter(e.target.value as TodoFindTreeStatus | '')}
          >
            <MenuItem value="">Vše</MenuItem>
            {Object.entries(TODO_STATUS_LABELS).map(([val, label]) => (
              <MenuItem key={val} value={val}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Priorita</InputLabel>
          <Select
            value={priorityFilter}
            label="Priorita"
            onChange={(e) => setPriorityFilter(e.target.value as TodoFindTreePriority | '')}
          >
            <MenuItem value="">Vše</MenuItem>
            {Object.entries(TODO_PRIORITY_LABELS).map(([val, label]) => (
              <MenuItem key={val} value={val}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <TodoTreeTable
        todos={todosQuery.data ?? []}
        trackerId={trackerId}
        filterParams={filterParams}
        isLoading={todosQuery.isLoading}
        isError={todosQuery.isError}
      />

      <TodoFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        trackerId={trackerId}
        filterParams={filterParams}
      />
    </Box>
  );
};
