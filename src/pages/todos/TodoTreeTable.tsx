import {
  todoCreate,
  todoDelete,
  todoUpdateStatus,
  getTodoFindTreeQueryKey,
} from '@api/todo-controller/todo-controller';
import type {
  TodoFindTree200Item,
  TodoFindTreeParams,
  TodoStatusUpdateRequestDto,
  TodoUpsertRequestDto,
} from '@api/model';
import { TodoResponseDtoStatus } from '@api/model';
import AddIcon from '@mui/icons-material/Add';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FC, KeyboardEvent, useCallback, useMemo, useState } from 'react';
import { TodoFormDialog } from './TodoFormDialog';
import {
  TODO_PRIORITY_COLOR,
  TODO_PRIORITY_LABELS,
  TODO_STATUS_COLOR,
  TODO_STATUS_LABELS,
} from './todoUiConstants';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TodoTreeNode = Omit<TodoFindTree200Item, 'children'> & {
  children?: TodoTreeNode[];
};

type FlatRow = {
  node: TodoTreeNode;
  depth: number;
  hasChildren: boolean;
  isLastSibling: boolean;
  /** For each ancestor depth 0..depth-1: true if that ancestor still has siblings below */
  ancestorHasSiblings: boolean[];
};

// ─── Flatten ─────────────────────────────────────────────────────────────────

function flattenTree(
  nodes: TodoTreeNode[],
  expandedIds: Set<string>,
  depth = 0,
  ancestorHasSiblings: boolean[] = [],
): FlatRow[] {
  return nodes.flatMap((node, idx) => {
    const isLastSibling = idx === nodes.length - 1;
    const children = (node.children ?? []) as TodoTreeNode[];
    const hasChildren = children.length > 0;
    const row: FlatRow = { node, depth, hasChildren, isLastSibling, ancestorHasSiblings };
    const childAncestors = [...ancestorHasSiblings, !isLastSibling];
    const childRows =
      hasChildren && expandedIds.has(node.id!)
        ? flattenTree(children, expandedIds, depth + 1, childAncestors)
        : [];
    return [row, ...childRows];
  });
}

// ─── Depth guide lines ───────────────────────────────────────────────────────

const INDENT = 20;

const DepthGuide: FC<{ depth: number; ancestorHasSiblings: boolean[]; isLastSibling: boolean }> = ({
  depth,
  ancestorHasSiblings,
  isLastSibling,
}) => {
  if (depth === 0) return null;
  return (
    <Stack direction="row" sx={{ flexShrink: 0, alignSelf: 'stretch' }}>
      {ancestorHasSiblings.map((hasSibling, i) => (
        <Box
          key={i}
          sx={{
            width: INDENT,
            flexShrink: 0,
            position: 'relative',
            '&::before': hasSibling
              ? {
                  content: '""',
                  position: 'absolute',
                  left: INDENT / 2 - 1,
                  top: 0,
                  bottom: 0,
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                }
              : undefined,
          }}
        />
      ))}
      {/* connector for this item */}
      <Box
        sx={{
          width: INDENT,
          flexShrink: 0,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: INDENT / 2 - 1,
            top: 0,
            bottom: isLastSibling ? '50%' : 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: INDENT / 2 - 1,
            top: '50%',
            right: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
          },
        }}
      />
    </Stack>
  );
};

// ─── Image preview dialog ─────────────────────────────────────────────────────

const ImagePreviewDialog: FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
  <Dialog open onClose={onClose} maxWidth="md">
    <DialogContent sx={{ p: 1 }}>
      <Box
        component="img"
        src={url}
        alt="Náhled"
        sx={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', borderRadius: 1 }}
      />
    </DialogContent>
  </Dialog>
);

// ─── Inline quick-add row ─────────────────────────────────────────────────────

type InlineAddRowProps = {
  depth: number;
  ancestorHasSiblings: boolean[];
  trackerId: string;
  parentTodoId: string | undefined;
  filterParams: TodoFindTreeParams | undefined;
  onDone: () => void;
};

const InlineAddRow: FC<InlineAddRowProps> = ({
  depth,
  ancestorHasSiblings,
  trackerId,
  parentTodoId,
  filterParams,
  onDone,
}) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: TodoUpsertRequestDto) => todoCreate(trackerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getTodoFindTreeQueryKey(trackerId, filterParams) });
      setTitle('');
      onDone();
    },
  });

  const submit = () => {
    if (!title.trim()) { onDone(); return; }
    createMutation.mutate({ title: title.trim(), parentTodoId });
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { onDone(); }
  };

  return (
    <Stack direction="row" alignItems="center" sx={{ minHeight: 40, px: 0.5 }}>
      <DepthGuide depth={depth} ancestorHasSiblings={ancestorHasSiblings} isLastSibling />
      <Box sx={{ width: 28, flexShrink: 0 }} />
      <TextField
        autoFocus
        size="small"
        placeholder="Název úkolu… (Enter uloží, Esc zruší)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKey}
        onBlur={submit}
        disabled={createMutation.isPending}
        sx={{ flex: 1, '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
        InputProps={{
          endAdornment: createMutation.isPending ? (
            <InputAdornment position="end">
              <CircularProgress size={14} />
            </InputAdornment>
          ) : undefined,
        }}
      />
    </Stack>
  );
};

// ─── Single tree row ──────────────────────────────────────────────────────────

type TreeRowProps = {
  row: FlatRow;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isInlineAddOpen: boolean;
  onOpenInlineAdd: () => void;
  onEdit: (node: TodoTreeNode) => void;
  trackerId: string;
  filterParams: TodoFindTreeParams | undefined;
};

const TreeRow: FC<TreeRowProps> = ({
  row,
  isExpanded,
  onToggleExpand,
  isInlineAddOpen,
  onOpenInlineAdd,
  onEdit,
  trackerId,
  filterParams,
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { node, depth, hasChildren, isLastSibling, ancestorHasSiblings } = row;
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const isDone = node.status === TodoResponseDtoStatus.DONE;
  const isCancelled = node.status === TodoResponseDtoStatus.CANCELLED;
  const isStrikethrough = isDone || isCancelled;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getTodoFindTreeQueryKey(trackerId, filterParams) });
  }, [queryClient, trackerId, filterParams]);

  const statusMutation = useMutation({
    mutationFn: (data: TodoStatusUpdateRequestDto) => todoUpdateStatus(trackerId, node.id!, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => todoDelete(trackerId, node.id!),
    onSuccess: invalidate,
  });

  const handleToggleDone = () => {
    const newStatus = isDone ? TodoResponseDtoStatus.TODO : TodoResponseDtoStatus.DONE;
    statusMutation.mutate({ status: newStatus as TodoStatusUpdateRequestDto['status'] });
  };

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          minHeight: 40,
          px: 0.5,
          borderRadius: 1,
          opacity: isStrikethrough ? 0.55 : 1,
          transition: 'opacity 0.15s, background 0.1s',
          '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.06) },
          '&:hover .row-actions': { opacity: 1 },
        }}
      >
        {/* Depth guide lines */}
        <DepthGuide depth={depth} ancestorHasSiblings={ancestorHasSiblings} isLastSibling={isLastSibling} />

        {/* Expand toggle */}
        <Box sx={{ width: 24, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          {hasChildren ? (
            <IconButton size="small" onClick={onToggleExpand} sx={{ p: 0.25 }}>
              {isExpanded ? (
                <ExpandLessIcon sx={{ fontSize: 16 }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          ) : null}
        </Box>

        {/* Checkbox */}
        <IconButton
          size="small"
          onClick={handleToggleDone}
          disabled={statusMutation.isPending}
          sx={{ p: 0.25, flexShrink: 0, color: isDone ? 'success.main' : 'action.active' }}
        >
          {statusMutation.isPending ? (
            <CircularProgress size={16} />
          ) : isDone ? (
            <CheckBoxOutlinedIcon sx={{ fontSize: 18 }} />
          ) : (
            <CheckBoxOutlineBlankIcon sx={{ fontSize: 18 }} />
          )}
        </IconButton>

        {/* Title + metadata */}
        <Box sx={{ flex: 1, minWidth: 0, py: 0.5 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography
              variant="body2"
              fontWeight={500}
              sx={{
                textDecoration: isStrikethrough ? 'line-through' : 'none',
                color: isStrikethrough ? 'text.secondary' : 'text.primary',
                wordBreak: 'break-word',
              }}
            >
              {node.title}
            </Typography>

            {node.priority && node.priority !== 'MEDIUM' && (
              <Chip
                label={TODO_PRIORITY_LABELS[node.priority]}
                size="small"
                color={TODO_PRIORITY_COLOR[node.priority]}
                variant="outlined"
                sx={{ height: 16, fontSize: '0.6rem', px: 0.25 }}
              />
            )}

            {node.status &&
              node.status !== TodoResponseDtoStatus.TODO &&
              node.status !== TodoResponseDtoStatus.DONE && (
                <Chip
                  label={TODO_STATUS_LABELS[node.status]}
                  size="small"
                  color={TODO_STATUS_COLOR[node.status]}
                  sx={{ height: 16, fontSize: '0.6rem', px: 0.25 }}
                />
              )}

            {node.tags?.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  px: 0.25,
                  ...(tag.color ? { bgcolor: tag.color, color: '#fff' } : {}),
                }}
              />
            ))}

            {node.dueDate && (
              <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                {new Date(node.dueDate).toLocaleDateString('cs-CZ')}
              </Typography>
            )}
          </Stack>

          {node.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.1, lineHeight: 1.3 }}
              noWrap
            >
              {node.description}
            </Typography>
          )}
        </Box>

        {/* Image thumbnail */}
        {node.imageUrl && (
          <Tooltip title="Zobrazit obrázek">
            <Box
              component="img"
              src={node.imageUrl}
              alt="náhled"
              onClick={() => setImagePreviewOpen(true)}
              sx={{
                width: 28,
                height: 28,
                objectFit: 'cover',
                borderRadius: 0.5,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
                '&:hover': { opacity: 0.85 },
              }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </Tooltip>
        )}

        {/* Children count badge (when collapsed) */}
        {hasChildren && !isExpanded && (
          <Tooltip title={`${(node.children ?? []).length} podúkol(ů)`}>
            <Box
              sx={{
                minWidth: 18,
                height: 18,
                borderRadius: 1,
                bgcolor: 'action.selected',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 0.5,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={onToggleExpand}
            >
              <Typography variant="caption" fontSize="0.6rem" color="text.secondary">
                {(node.children ?? []).length}
              </Typography>
            </Box>
          </Tooltip>
        )}

        {/* Actions (fade in on hover) */}
        <Stack
          className="row-actions"
          direction="row"
          sx={{ flexShrink: 0, opacity: 0, transition: 'opacity 0.15s' }}
        >
          <Tooltip title="Přidat podúkol">
            <IconButton
              size="small"
              onClick={onOpenInlineAdd}
              sx={{ p: 0.25, color: isInlineAddOpen ? 'primary.main' : undefined }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Upravit">
            <IconButton size="small" onClick={() => onEdit(node)} sx={{ p: 0.25 }}>
              <EditOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={node.imageUrl ? 'Obrázek' : undefined}>
            {node.imageUrl ? (
              <IconButton size="small" sx={{ p: 0.25, color: 'info.main' }}>
                <ImageOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            ) : <span />}
          </Tooltip>
          <Tooltip title="Smazat">
            <IconButton
              size="small"
              color="error"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              sx={{ p: 0.25 }}
            >
              {deleteMutation.isPending ? (
                <CircularProgress size={14} color="error" />
              ) : (
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {imagePreviewOpen && node.imageUrl && (
        <ImagePreviewDialog url={node.imageUrl} onClose={() => setImagePreviewOpen(false)} />
      )}
    </>
  );
};

// ─── Main tree table ──────────────────────────────────────────────────────────

type TodoTreeTableProps = {
  todos: TodoTreeNode[];
  trackerId: string;
  filterParams?: TodoFindTreeParams;
  isLoading?: boolean;
  isError?: boolean;
};

export const TodoTreeTable: FC<TodoTreeTableProps> = ({
  todos,
  trackerId,
  filterParams,
  isLoading,
  isError,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Expand all root nodes by default
    const ids = new Set<string>();
    const addAll = (nodes: TodoTreeNode[]) => {
      for (const n of nodes) {
        if (n.id && (n.children?.length ?? 0) > 0) {
          ids.add(n.id);
          addAll((n.children ?? []) as TodoTreeNode[]);
        }
      }
    };
    addAll(todos);
    return ids;
  });

  // Key: parentId (or '__root__' for top-level) → inline add is open
  const [inlineAddParentId, setInlineAddParentId] = useState<string | null>(null);

  const [editTodo, setEditTodo] = useState<TodoTreeNode | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Keep expand state in sync when todos change (new nodes auto-expand)
  const prevTodos = useMemo(() => todos, [todos]);
  useMemo(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      const addNew = (nodes: TodoTreeNode[]) => {
        for (const n of nodes) {
          if (n.id && (n.children?.length ?? 0) > 0 && !prev.has(n.id)) {
            next.add(n.id);
          }
          addNew((n.children ?? []) as TodoTreeNode[]);
        }
      };
      addNew(prevTodos);
      return next;
    });
  }, [prevTodos]);

  const flatRows = useMemo(
    () => flattenTree(todos as TodoTreeNode[], expandedIds),
    [todos, expandedIds],
  );

  const openEdit = (node: TodoTreeNode) => {
    setEditTodo(node);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <Stack spacing={0.75}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={40} sx={{ borderRadius: 1 }} />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return <Alert severity="error">Nepodařilo se načíst úkoly.</Alert>;
  }

  if (todos.length === 0) {
    return (
      <Alert severity="info" sx={{ maxWidth: 480 }}>
        Žádné úkoly. Vytvořte první pomocí tlačítka výše.
      </Alert>
    );
  }

  return (
    <>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {flatRows.map((row, idx) => {
          const nodeId = row.node.id!;
          const isExpanded = expandedIds.has(nodeId);

          // Show inline-add row right after this row if it's the open parent
          const inlineAddAfterThis = inlineAddParentId === nodeId;

          // Also show inline-add at root level after last root item
          const isLastRoot =
            inlineAddParentId === '__root__' &&
            row.depth === 0 &&
            idx === flatRows.length - 1;

          return (
            <Box key={nodeId}>
              <Box
                sx={{
                  borderBottom:
                    idx < flatRows.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <TreeRow
                  row={row}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpand(nodeId)}
                  isInlineAddOpen={inlineAddParentId === nodeId}
                  onOpenInlineAdd={() => {
                    // Expand the node if it has children but is collapsed
                    if (row.hasChildren && !isExpanded) toggleExpand(nodeId);
                    setInlineAddParentId((prev) => (prev === nodeId ? null : nodeId));
                  }}
                  onEdit={openEdit}
                  trackerId={trackerId}
                  filterParams={filterParams}
                />
              </Box>

              {inlineAddAfterThis && (
                <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                  <InlineAddRow
                    depth={row.depth + 1}
                    ancestorHasSiblings={[...row.ancestorHasSiblings, !row.isLastSibling]}
                    trackerId={trackerId}
                    parentTodoId={nodeId}
                    filterParams={filterParams}
                    onDone={() => setInlineAddParentId(null)}
                  />
                </Box>
              )}

              {isLastRoot && (
                <Box sx={{ bgcolor: 'action.hover' }}>
                  <InlineAddRow
                    depth={0}
                    ancestorHasSiblings={[]}
                    trackerId={trackerId}
                    parentTodoId={undefined}
                    filterParams={filterParams}
                    onDone={() => setInlineAddParentId(null)}
                  />
                </Box>
              )}
            </Box>
          );
        })}

        {/* Inline add at root level (when no todos yet handled by empty state above) */}
        {inlineAddParentId === '__root__' && flatRows.length === 0 && (
          <Box sx={{ bgcolor: 'action.hover' }}>
            <InlineAddRow
              depth={0}
              ancestorHasSiblings={[]}
              trackerId={trackerId}
              parentTodoId={undefined}
              filterParams={filterParams}
              onDone={() => setInlineAddParentId(null)}
            />
          </Box>
        )}
      </Paper>

      <TodoFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTodo(null); }}
        trackerId={trackerId}
        todo={editTodo}
        filterParams={filterParams}
      />
    </>
  );
};
