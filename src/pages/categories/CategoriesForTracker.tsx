import {
  categoryCreate,
  categoryDeactivate,
  categoryFindAllActive,
  categoryUpdate,
} from '@api/category-controller/category-controller';
import type {
  CategoryResponseDto,
  CreateCategoryRequestDto,
  PagedModelCategoryResponseDto,
  UpdateCategoryRequestDto,
} from '@api/model';
import { CreateCategoryRequestDtoCategoryKind } from '@api/model';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageHeading } from '@components/PageHeading';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useMemo, useRef, useState } from 'react';
import {
  asCategoryChildren,
  categoryKindChipColor,
  categoryKindLabel,
  collectIdsInSubtree,
  findNodeById,
  rootAncestorCategory,
  toCategoryTree,
} from './categoryTreeUtils';

const LIST_PARAMS = { page: 0, size: 2000 } as const;

type CreateMode = { type: 'root' } | { type: 'child'; parentId: string };

type EditMode = { category: CategoryResponseDto };

export type CategoriesForTrackerProps = {
  trackerId: string;
  trackerName: string;
  /** V záložce na Domě — bez vlastního hlavního nadpisu „Kategorie“. */
  embedded?: boolean;
};

export const CategoriesForTracker: FC<CategoriesForTrackerProps> = ({
  trackerId,
  trackerName,
  embedded,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/category/${trackerId}/active`, LIST_PARAMS],
    queryFn: () => categoryFindAllActive(trackerId, LIST_PARAMS),
  });

  const paged = data?.data as PagedModelCategoryResponseDto | undefined;
  const flat = paged?.content ?? [];
  const tree = useMemo(() => toCategoryTree(flat), [flat]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>({ type: 'root' });
  const [editState, setEditState] = useState<EditMode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCascade, setDeleteCascade] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formKind, setFormKind] = useState<CreateCategoryRequestDtoCategoryKind>(
    CreateCategoryRequestDtoCategoryKind.EXPENSE,
  );
  const [formParentId, setFormParentId] = useState<string>('');
  const createNameInputRef = useRef<HTMLInputElement | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [`/api/category/${trackerId}/active`] });

  const openCreateRoot = () => {
    setCreateMode({ type: 'root' });
    setFormName('');
    setFormKind(CreateCategoryRequestDtoCategoryKind.EXPENSE);
    setFormParentId('');
    setCreateOpen(true);
  };

  const openCreateChild = (parentId: string) => {
    const root = rootAncestorCategory(tree, flat, parentId);
    const parentKind =
      (root?.categoryKind as CreateCategoryRequestDtoCategoryKind | undefined) ??
      CreateCategoryRequestDtoCategoryKind.EXPENSE;
    setCreateMode({ type: 'child', parentId });
    setFormName('');
    setFormKind(parentKind);
    setFormParentId(parentId);
    setCreateOpen(true);
  };

  const openEdit = (category: CategoryResponseDto) => {
    setEditState({ category });
    setFormName(category.name ?? '');
    setFormKind(
      (category.categoryKind as CreateCategoryRequestDtoCategoryKind) ??
        CreateCategoryRequestDtoCategoryKind.EXPENSE,
    );
    setFormParentId(category.parentId ?? '');
    setCreateOpen(false);
  };

  const parentOptionsForEdit = useMemo(() => {
    if (!editState?.category?.id) return [] as { id: string; label: string }[];
    const node = findNodeById(tree, editState.category.id!);
    const exclude = node ? collectIdsInSubtree(node) : new Set<string>();
    const walk = (nodes: CategoryResponseDto[], depth: number): { id: string; label: string }[] => {
      const out: { id: string; label: string }[] = [];
      nodes.forEach((n) => {
        if (!n.id || exclude.has(n.id)) return;
        const pad = `${'\u00A0\u00A0'.repeat(depth)}`;
        out.push({ id: n.id, label: `${pad}${n.name ?? '—'}`.trim() });
        out.push(...walk(asCategoryChildren(n.children), depth + 1));
      });
      return out;
    };
    return walk(tree, 0);
  }, [editState?.category?.id, tree]);

  const parentOptionsForCreate = useMemo(() => {
    const walk = (nodes: CategoryResponseDto[], depth: number): { id: string; label: string }[] => {
      const out: { id: string; label: string }[] = [];
      nodes.forEach((n) => {
        if (!n.id) return;
        const pad = `${'\u00A0\u00A0'.repeat(depth)}`;
        out.push({ id: n.id, label: `${pad}${n.name ?? '—'}`.trim() });
        out.push(...walk(asCategoryChildren(n.children), depth + 1));
      });
      return out;
    };
    return walk(tree, 0);
  }, [tree]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      enqueueSnackbar('Vyplň název', { variant: 'warning' });
      return;
    }
    const payload: CreateCategoryRequestDto = {
      name,
      categoryKind: formKind,
    };
    if (createMode.type === 'child') {
      payload.parentId = createMode.parentId;
    } else if (formParentId) {
      payload.parentId = formParentId;
    }

    setSubmitting(true);
    try {
      const res = await categoryCreate(trackerId, payload);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Kategorii se nepodařilo vytvořit',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Kategorie byla vytvořena', { variant: 'success' });
      setCreateOpen(false);
      await invalidate();
    } catch {
      enqueueSnackbar('Kategorii se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editState?.category?.id) return;
    const name = formName.trim();
    if (!name) {
      enqueueSnackbar('Vyplň název', { variant: 'warning' });
      return;
    }
    const body: UpdateCategoryRequestDto = {
      name,
      categoryKind: formKind,
      parentId: formParentId || undefined,
    };
    setSubmitting(true);
    try {
      const res = await categoryUpdate(trackerId, editState.category.id, body);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Úprava se nepodařila',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Kategorie byla upravena', { variant: 'success' });
      setEditState(null);
      await invalidate();
    } catch {
      enqueueSnackbar('Úprava se nepodařila', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      const res = await categoryDeactivate(trackerId, deleteId, { cascade: deleteCascade });
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Odstranění se nepodařilo'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Kategorie byla odstraněna', { variant: 'success' });
      setDeleteId(null);
      setDeleteCascade(false);
      await invalidate();
    } catch {
      enqueueSnackbar('Odstranění se nepodařilo (síť nebo neočekávaná chyba)', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const budgetBlurb = (
    <>
      Rozpočet: <strong>{trackerName}</strong> — zobrazeny jsou jen aktivní kategorie; typ příjem / výdaj,
      lze přidávat podkategorie.
    </>
  );

  return (
    <Box>
      {!embedded && (
        <PageHeading component="h1" gutterBottom>
          Kategorie
        </PageHeading>
      )}

      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst kategorie.
        </Typography>
      )}

      {isLoading ? (
        <>
          <Typography color="text.secondary" variant={embedded ? 'body2' : 'body1'} sx={{ mb: 2 }}>
            {budgetBlurb}
          </Typography>
          <Typography color="text.secondary">Načítám…</Typography>
        </>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 2,
              mb: 2,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              color="text.secondary"
              variant={embedded ? 'body2' : 'body1'}
              sx={{ flex: '1 1 200px', minWidth: 0 }}
            >
              {budgetBlurb}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={openCreateRoot}
              sx={{ flexShrink: 0 }}
            >
              Přidat kategorii
            </Button>
          </Box>
          <Paper variant="outlined" sx={{ p: 2 }}>
            {tree.length === 0 ? (
              <Typography color="text.secondary">Zatím žádná kategorie — přidej první.</Typography>
            ) : (
              <Stack spacing={0}>
                {tree.map((node) => (
                  <CategoryTreeRows
                    key={node.id ?? node.name}
                    node={node}
                    depth={0}
                    onAddChild={openCreateChild}
                    onEdit={openEdit}
                    onDelete={(id) => {
                      setDeleteCascade(false);
                      setDeleteId(id);
                    }}
                  />
                ))}
              </Stack>
            )}
          </Paper>
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => !submitting && setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
        disableAutoFocus
        slotProps={{
          transition: {
            onEntered: () => {
              createNameInputRef.current?.focus();
            },
          },
        }}
      >
        <DialogTitle>
          {createMode.type === 'child' ? 'Nová podkategorie' : 'Nová kategorie'}
        </DialogTitle>
        <Box component="form" onSubmit={handleCreate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                fullWidth
                inputRef={createNameInputRef}
              />
              <FormControl fullWidth>
                <InputLabel id="create-kind">Druh</InputLabel>
                <Select
                  labelId="create-kind"
                  label="Druh"
                  value={formKind}
                  onChange={(e) =>
                    setFormKind(e.target.value as CreateCategoryRequestDtoCategoryKind)
                  }
                >
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.EXPENSE}>Výdaj</MenuItem>
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.INCOME}>Příjem</MenuItem>
                </Select>
              </FormControl>
              {createMode.type === 'root' && (
                <FormControl fullWidth>
                  <InputLabel id="create-parent">Nadřazená (volitelné)</InputLabel>
                  <Select
                    labelId="create-parent"
                    label="Nadřazená (volitelné)"
                    value={formParentId}
                    onChange={(e) => setFormParentId(e.target.value as string)}
                  >
                    <MenuItem value="">
                      <em>Kořen</em>
                    </MenuItem>
                    {parentOptionsForCreate.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
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

      <Dialog open={Boolean(editState)} onClose={() => !submitting && setEditState(null)} fullWidth maxWidth="sm">
        <DialogTitle>Upravit kategorii</DialogTitle>
        <Box component="form" onSubmit={handleUpdate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="edit-kind">Druh</InputLabel>
                <Select
                  labelId="edit-kind"
                  label="Druh"
                  value={formKind}
                  onChange={(e) =>
                    setFormKind(e.target.value as CreateCategoryRequestDtoCategoryKind)
                  }
                >
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.EXPENSE}>Výdaj</MenuItem>
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.INCOME}>Příjem</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="edit-parent">Nadřazená</InputLabel>
                <Select
                  labelId="edit-parent"
                  label="Nadřazená"
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value as string)}
                >
                  <MenuItem value="">
                    <em>Kořen</em>
                  </MenuItem>
                  {parentOptionsForEdit.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setEditState(null)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Uložit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(deleteId)}
        onClose={() => {
          if (submitting) return;
          setDeleteId(null);
          setDeleteCascade(false);
        }}
      >
        <DialogTitle>Odstranit kategorii?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Opravdu chceš tuto kategorii odstranit? Bez kaskády může server odmítnout mazání, pokud existují
            podkategorie.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={deleteCascade}
                onChange={(_, c) => setDeleteCascade(c)}
                disabled={submitting}
              />
            }
            label="Smazat včetně podkategorií (kaskáda)"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteId(null);
              setDeleteCascade(false);
            }}
            disabled={submitting}
          >
            Zrušit
          </Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={submitting}>
            Odstranit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

type RowProps = {
  node: CategoryResponseDto;
  depth: number;
  onAddChild: (parentId: string) => void;
  onEdit: (c: CategoryResponseDto) => void;
  onDelete: (id: string) => void;
};

const CategoryTreeRows: FC<RowProps> = ({ node, depth, onAddChild, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const id = node.id;
  const children = asCategoryChildren(node.children);
  const hasChildren = children.length > 0;

  const toggleExpanded = () => {
    if (hasChildren) setExpanded((v) => !v);
  };

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          pl: depth * 2.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hasChildren ? (
            <IconButton
              size="small"
              aria-expanded={expanded}
              aria-label={expanded ? 'Sbalit podkategorie' : 'Rozbalit podkategorie'}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
            >
              <ChevronRightIcon
                fontSize="small"
                sx={{
                  transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shorter }),
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
            </IconButton>
          ) : null}
        </Box>
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            cursor: hasChildren ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          noWrap
          title={node.name}
          onClick={toggleExpanded}
        >
          {node.name ?? '—'}
        </Typography>
        <Chip
          size="small"
          label={categoryKindLabel(node.categoryKind)}
          variant="outlined"
          color={categoryKindChipColor(node.categoryKind)}
        />
        {id && (
          <>
            <Tooltip title="Podkategorie">
              <IconButton
                size="small"
                aria-label="přidat podkategorii"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(id);
                }}
              >
                <AddOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Upravit">
              <IconButton
                size="small"
                aria-label="upravit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(node);
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Odstranit">
              <IconButton
                size="small"
                aria-label="odstranit"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(id);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box>
            {children.map((ch) => (
              <CategoryTreeRows
                key={ch.id ?? ch.name}
                node={ch}
                depth={depth + 1}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};
