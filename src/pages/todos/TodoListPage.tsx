import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  todoDelete,
  todoFindTree,
  todoUpdateStatus,
  getTodoFindTreeQueryKey,
} from '@api/todo-controller/todo-controller';
import type {
  TodoFindTree200Item,
  TodoFindTreeParams,
  TodoFindTreePriority,
  TodoFindTreeStatus,
  TodoStatusUpdateRequestDto,
} from '@api/model';
import { TodoResponseDtoStatus } from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, useState } from 'react';
import { TodoFormDialog } from './TodoFormDialog';
import {
  TODO_PRIORITY_COLOR,
  TODO_PRIORITY_LABELS,
  TODO_STATUS_COLOR,
  TODO_STATUS_LABELS,
} from './todoUiConstants';

type TodoItemProps = {
  todo: TodoFindTree200Item;
  trackerId: string;
  depth?: number;
  filterParams?: TodoFindTreeParams;
  onEdit: (todo: TodoFindTree200Item) => void;
  onAddChild: (parentId: string) => void;
};

const TodoItem: FC<TodoItemProps> = ({ todo, trackerId, depth = 0, filterParams, onEdit, onAddChild }) => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);

  const children = (todo.children ?? []) as TodoFindTree200Item[];
  const isDone = todo.status === TodoResponseDtoStatus.DONE;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getTodoFindTreeQueryKey(trackerId, filterParams) });
  };

  const statusMutation = useMutation({
    mutationFn: (data: TodoStatusUpdateRequestDto) =>
      todoUpdateStatus(trackerId, todo.id!, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => todoDelete(trackerId, todo.id!),
    onSuccess: invalidate,
  });

  const handleToggleDone = () => {
    const newStatus = isDone ? TodoResponseDtoStatus.TODO : TodoResponseDtoStatus.DONE;
    statusMutation.mutate({ status: newStatus as TodoStatusUpdateRequestDto['status'] });
  };

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          ml: depth * 3,
          mb: 0.75,
          px: 1.5,
          py: 1,
          opacity: isDone ? 0.6 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {depth > 0 && (
            <SubdirectoryArrowRightIcon
              fontSize="small"
              sx={{ color: 'text.disabled', flexShrink: 0 }}
            />
          )}

          <Checkbox
            checked={isDone}
            onChange={handleToggleDone}
            disabled={statusMutation.isPending}
            size="small"
            sx={{ p: 0.5 }}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <Typography
                variant="body2"
                fontWeight={500}
                sx={{
                  textDecoration: isDone ? 'line-through' : 'none',
                  color: isDone ? 'text.secondary' : 'text.primary',
                  wordBreak: 'break-word',
                }}
              >
                {todo.title}
              </Typography>

              {todo.priority && (
                <Chip
                  label={TODO_PRIORITY_LABELS[todo.priority]}
                  size="small"
                  color={TODO_PRIORITY_COLOR[todo.priority]}
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              )}

              {todo.status && todo.status !== TodoResponseDtoStatus.TODO && todo.status !== TodoResponseDtoStatus.DONE && (
                <Chip
                  label={TODO_STATUS_LABELS[todo.status]}
                  size="small"
                  color={TODO_STATUS_COLOR[todo.status]}
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              )}

              {todo.tags?.map((tag) => (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    ...(tag.color ? { bgcolor: tag.color, color: '#fff' } : {}),
                  }}
                />
              ))}

              {todo.dueDate && (
                <Typography variant="caption" color="text.secondary">
                  {new Date(todo.dueDate).toLocaleDateString('cs-CZ')}
                </Typography>
              )}
            </Stack>

            {todo.description && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {todo.description}
              </Typography>
            )}
          </Box>

          <Stack direction="row" alignItems="center" spacing={0}>
            <Tooltip title="Přidat podúkol">
              <IconButton size="small" onClick={() => onAddChild(todo.id!)}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Upravit">
              <IconButton size="small" onClick={() => onEdit(todo)}>
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
            {children.length > 0 && (
              <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            )}
          </Stack>
        </Stack>
      </Paper>

      {children.length > 0 && (
        <Collapse in={expanded}>
          {children.map((child) => (
            <TodoItem
              key={child.id}
              todo={child}
              trackerId={trackerId}
              depth={depth + 1}
              filterParams={filterParams}
              onEdit={onEdit}
              onAddChild={onAddChild}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
};

export const TodoListPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TodoFindTreeStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TodoFindTreePriority | ''>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editTodo, setEditTodo] = useState<TodoFindTree200Item | null>(null);
  const [addChildParentId, setAddChildParentId] = useState<string | undefined>();

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
      return res.data as unknown as TodoFindTree200Item[];
    },
  });

  const openCreate = () => {
    setEditTodo(null);
    setAddChildParentId(undefined);
    setFormOpen(true);
  };

  const openEdit = (todo: TodoFindTree200Item) => {
    setEditTodo(todo);
    setAddChildParentId(undefined);
    setFormOpen(true);
  };

  const openAddChild = (parentId: string) => {
    setEditTodo(null);
    setAddChildParentId(parentId);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditTodo(null);
    setAddChildParentId(undefined);
  };

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

  const todos: TodoFindTree200Item[] = todosQuery.data ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <PageHeading component="h1">ToDo</PageHeading>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
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

      {todosQuery.isLoading && (
        <Stack spacing={1}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={52} />
          ))}
        </Stack>
      )}

      {todosQuery.isError && (
        <Alert severity="error">Nepodařilo se načíst úkoly.</Alert>
      )}

      {!todosQuery.isLoading && !todosQuery.isError && todos.length === 0 && (
        <Alert severity="info" sx={{ maxWidth: 480 }}>
          Žádné úkoly. Vytvořte první pomocí tlačítka výše.
        </Alert>
      )}

      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          trackerId={trackerId}
          filterParams={filterParams}
          onEdit={openEdit}
          onAddChild={openAddChild}
        />
      ))}

      <TodoFormDialog
        open={formOpen}
        onClose={handleFormClose}
        trackerId={trackerId}
        todo={editTodo}
        parentTodoId={addChildParentId}
        filterParams={filterParams}
      />
    </Box>
  );
};
