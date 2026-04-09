import {
  getGoalPlanFindAllQueryKey,
  goalPlanActivate,
  goalPlanDeactivate,
  goalPlanFindAll,
  goalPlanUpdate,
} from '@api/goal-plan-controller/goal-plan-controller';
import type { UpdateGoalPlanRequestDto } from '@api/model/updateGoalPlanRequestDto';
import type { GoalPlanResponseDto } from '@api/model/goalPlanResponseDto';
import type { PagedModelGoalPlanResponseDto } from '@api/model/pagedModelGoalPlanResponseDto';
import { CreateGoalPlanRequestDtoGoalType } from '@api/model/createGoalPlanRequestDtoGoalType';
import { CreateGoalPlanRequestDtoStartBodyFatSource } from '@api/model/createGoalPlanRequestDtoStartBodyFatSource';
import { CreateGoalPlanRequestDtoProteinStrategy } from '@api/model/createGoalPlanRequestDtoProteinStrategy';
import { CreateGoalPlanRequestDtoFatStrategy } from '@api/model/createGoalPlanRequestDtoFatStrategy';
import { CreateGoalPlanRequestDtoCarbStrategy } from '@api/model/createGoalPlanRequestDtoCarbStrategy';
import { PageHeading } from '@components/PageHeading';
import { usePersistStore } from '@components/store/persistStore';
import { useAuth } from '@auth/AuthContext';
import { useNutritionActiveGoalPlanId } from '@hooks/useNutritionActiveGoalPlanId';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GOAL_TYPE_LABELS,
  WEEKLY_OPTIONS,
  buildUpdatePayload,
  diffGoalPlanPatch,
  formatPlanDate,
  formatWeeklyDeltaKg,
  goalTypeLabel,
  planToUpdateForm,
  type GoalPlanEditFormState,
} from './goalPlanShared';

const GoalPlanEditDialog: FC<{
  open: boolean;
  plan: GoalPlanResponseDto | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (goalPlanId: string, data: UpdateGoalPlanRequestDto) => void;
}> = ({ open, plan, isSubmitting, onClose, onSave }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<GoalPlanEditFormState>(() => planToUpdateForm({} as GoalPlanResponseDto));
  const [baselinePayload, setBaselinePayload] = useState<UpdateGoalPlanRequestDto | null>(null);

  useEffect(() => {
    if (plan) {
      const f = planToUpdateForm(plan);
      setForm(f);
      setBaselinePayload(buildUpdatePayload(f));
    }
  }, [plan]);

  if (!plan?.id) {
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!baselinePayload) {
      return;
    }
    const next = buildUpdatePayload(form);
    const patch = diffGoalPlanPatch(baselinePayload, next);
    if (Object.keys(patch).length === 0) {
      enqueueSnackbar('Žádné změny k uložení', { variant: 'info' });
      return;
    }
    onSave(plan.id!, patch);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Upravit plán: {plan.name ?? ''}</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="cs">
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                  <TextField
                    label="Název"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    fullWidth
                    required
                  />
                  <FormControl fullWidth>
                    <InputLabel id="edit-goal-type-label">Typ cíle</InputLabel>
                    <Select
                      labelId="edit-goal-type-label"
                      label="Typ cíle"
                      value={form.goalType}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          goalType: e.target.value as GoalPlanEditFormState['goalType'],
                        }))
                      }
                    >
                      {GOAL_TYPE_LABELS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <DatePicker
                    label="Start datum"
                    value={form.startDate}
                    onChange={(v) => v && setForm((f) => ({ ...f, startDate: v }))}
                    format="DD. MM. YYYY"
                    slotProps={{ textField: { fullWidth: true, required: true } }}
                  />
                  <DatePicker
                    label="End datum (volitelné)"
                    value={form.endDate}
                    onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                    format="DD. MM. YYYY"
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                  <FormControl fullWidth>
                    <InputLabel id="edit-weekly-label">Týdenní změna (kg)</InputLabel>
                    <Select
                      labelId="edit-weekly-label"
                      label="Týdenní změna (kg)"
                      value={form.targetWeeklyWeightChangeKg}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          targetWeeklyWeightChangeKg: Number(e.target.value),
                        }))
                      }
                    >
                      {WEEKLY_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                  <TextField
                    label="Start váha (kg)"
                    type="number"
                    inputProps={{ min: 0.1, step: 0.1 }}
                    value={form.startWeightKg}
                    onChange={(e) => setForm((f) => ({ ...f, startWeightKg: e.target.value }))}
                    fullWidth
                    required
                  />
                  <Tooltip title="Pokud neznáš BF, nech prázdné." placement="top" enterDelay={300}>
                    <TextField
                      label="Start BF % (volitelné)"
                      type="number"
                      inputProps={{ min: 0, max: 100, step: 0.1 }}
                      value={form.startBodyFatPercent}
                      onChange={(e) => setForm((f) => ({ ...f, startBodyFatPercent: e.target.value }))}
                      fullWidth
                    />
                  </Tooltip>
                  <FormControl fullWidth>
                    <InputLabel id="edit-bf-source-label">BF source</InputLabel>
                    <Select
                      labelId="edit-bf-source-label"
                      label="BF source"
                      value={form.startBodyFatSource}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          startBodyFatSource: e.target.value as GoalPlanEditFormState['startBodyFatSource'],
                        }))
                      }
                    >
                      <MenuItem value={CreateGoalPlanRequestDtoStartBodyFatSource.MANUAL}>
                        MANUAL — ruční zadání
                      </MenuItem>
                      <MenuItem value={CreateGoalPlanRequestDtoStartBodyFatSource.CIRCUMFERENCE}>
                        CIRCUMFERENCE — z obvodů
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel id="edit-protein-label">Protein</InputLabel>
                    <Select
                      labelId="edit-protein-label"
                      label="Protein"
                      value={form.proteinStrategy}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          proteinStrategy: e.target.value as GoalPlanEditFormState['proteinStrategy'],
                        }))
                      }
                    >
                      <MenuItem value={CreateGoalPlanRequestDtoProteinStrategy.STANDARD}>
                        STANDARD — auto dle BF%
                      </MenuItem>
                      <MenuItem value={CreateGoalPlanRequestDtoProteinStrategy.HIGH}>
                        HIGH — +10 % oproti standardu
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel id="edit-fat-label">Fat</InputLabel>
                    <Select
                      labelId="edit-fat-label"
                      label="Fat"
                      value={form.fatStrategy}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          fatStrategy: e.target.value as GoalPlanEditFormState['fatStrategy'],
                        }))
                      }
                    >
                      <MenuItem value={CreateGoalPlanRequestDtoFatStrategy.STANDARD}>STANDARD — auto</MenuItem>
                      <MenuItem value={CreateGoalPlanRequestDtoFatStrategy.HIGHER}>
                        HIGHER — +3 p. b. tuku
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel id="edit-carb-label">Carbs</InputLabel>
                    <Select
                      labelId="edit-carb-label"
                      label="Carbs"
                      value={form.carbStrategy}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          carbStrategy: e.target.value as GoalPlanEditFormState['carbStrategy'],
                        }))
                      }
                    >
                      <MenuItem value={CreateGoalPlanRequestDtoCarbStrategy.REMAINDER}>
                        REMAINDER — zbytek kalorií po P+F
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
              <TextField
                label="Poznámky (volitelné)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
              />
            </Stack>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Uložit změny
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export const NutritionGoalPlanPage: FC = () => {
  const { userData } = useAuth();
  const userId = userData?.id ?? '';
  const setNutritionActiveGoalPlan = usePersistStore(userId).setNutritionActiveGoalPlan;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const persistedActiveGoalPlanId = useNutritionActiveGoalPlanId(trackerId);
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const listParams = useMemo(
    () => ({
      page,
      size: rowsPerPage,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      sort: ['startDate,desc'],
    }),
    [page, rowsPerPage, debouncedSearch],
  );

  const listQuery = useQuery({
    queryKey: trackerId ? getGoalPlanFindAllQueryKey(trackerId, listParams) : ['goalPlanFindAll', 'disabled'],
    enabled: !!trackerId,
    queryFn: async (): Promise<PagedModelGoalPlanResponseDto> => {
      const res = await goalPlanFindAll(trackerId!, listParams);
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.data as unknown as PagedModelGoalPlanResponseDto;
    },
  });

  const displayPlans = useMemo(() => {
    const raw = listQuery.data?.content ?? [];
    return [...raw].sort((a, b) => {
      if (a.active && !b.active) {
        return -1;
      }
      if (!a.active && b.active) {
        return 1;
      }
      return (b.startDate ?? '').localeCompare(a.startDate ?? '');
    });
  }, [listQuery.data?.content]);

  const totalElements = listQuery.data?.page?.totalElements ?? 0;

  const activateMutation = useMutation({
    mutationFn: async (goalPlanId: string) => {
      const res = await goalPlanActivate(trackerId!, goalPlanId);
      if (res.status < 200 || res.status >= 300) {
        throw new Error('activate failed');
      }
    },
    onSuccess: async (_, goalPlanId) => {
      await queryClient.invalidateQueries({ queryKey: getGoalPlanFindAllQueryKey(trackerId!) });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
      setNutritionActiveGoalPlan(trackerId!, goalPlanId);
      enqueueSnackbar('Plán je aktivní', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Aktivace plánu selhala', { variant: 'error' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (goalPlanId: string) => {
      const res = await goalPlanDeactivate(trackerId!, goalPlanId);
      if (res.status < 200 || res.status >= 300) {
        throw new Error('deactivate failed');
      }
    },
    onSuccess: async (_, goalPlanId) => {
      await queryClient.invalidateQueries({ queryKey: getGoalPlanFindAllQueryKey(trackerId!) });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
      if (persistedActiveGoalPlanId === goalPlanId) {
        setNutritionActiveGoalPlan(trackerId!, null);
      }
      enqueueSnackbar('Plán deaktivován (archiv)', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Deaktivace plánu selhala', { variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { goalPlanId: string; data: UpdateGoalPlanRequestDto }) => {
      const res = await goalPlanUpdate(trackerId!, vars.goalPlanId, vars.data);
      if (res.status < 200 || res.status >= 300) {
        throw new Error('update failed');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGoalPlanFindAllQueryKey(trackerId!) });
      await queryClient.invalidateQueries({ queryKey: ['nutritionDashboard', trackerId] });
      await queryClient.invalidateQueries({ queryKey: ['goalPlanFindById', trackerId] });
      setEditingPlan(null);
      enqueueSnackbar('Plán uložen', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Uložení plánu selhalo', { variant: 'error' });
    },
  });

  const [editingPlan, setEditingPlan] = useState<GoalPlanResponseDto | null>(null);

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Moje plány
        </PageHeading>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nejprve vyber rozpočet (tracker) v menu u položky Trackery.
        </Typography>
        <Button component={Link} to="/trackers" variant="contained">
          Otevřít trackery
        </Button>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={2}
      >
        <PageHeading component="h1" gutterBottom sx={{ mb: 0 }}>
          Moje plány
        </PageHeading>
        <Button component={Link} to="/nutrition/goal-plan/new" variant="contained">
          + Nový plán
        </Button>
      </Stack>

      <TextField
        label="Hledat v názvu"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        size="small"
        sx={{ maxWidth: 360 }}
        placeholder="např. cut"
      />

      {listQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : listQuery.isError ? (
        <Typography color="error">Seznam plánů se nepodařilo načíst.</Typography>
      ) : displayPlans.length === 0 ? (
        <Typography color="text.secondary">
          Žádný plán nenalezen.{' '}
          <Link to="/nutrition/goal-plan/new">Založ nový plán</Link>.
        </Typography>
      ) : (
        <>
          <Stack spacing={2} sx={{ maxWidth: 720 }}>
            {displayPlans.map((plan) => {
              const pid = plan.id;
              return (
                <Paper
                  key={pid ?? plan.name}
                  variant="outlined"
                  onClick={() => {
                    if (pid) {
                      navigate(`/nutrition/goal-plan/${pid}`);
                    }
                  }}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    cursor: pid ? 'pointer' : 'default',
                    borderLeftWidth: plan.active ? 4 : 1,
                    borderLeftColor: plan.active ? 'primary.main' : 'divider',
                    bgcolor: plan.active ? 'action.hover' : 'background.paper',
                    transition: 'background-color 0.15s',
                    '&:hover': pid
                      ? {
                          bgcolor: 'action.selected',
                        }
                      : undefined,
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1} flexWrap="wrap">
                      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        {plan.active ? (
                          <CheckCircleIcon color="success" fontSize="small" titleAccess="Aktivní" />
                        ) : null}
                        <Typography fontWeight={700}>{plan.name ?? '—'}</Typography>
                        {plan.active ? (
                          <Chip size="small" color="primary" label="ACTIVE" />
                        ) : (
                          <Chip size="small" variant="outlined" label="Archiv" />
                        )}
                      </Stack>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {goalTypeLabel(plan.goalType)} | {formatPlanDate(plan.startDate)} →{' '}
                      {formatPlanDate(plan.endDate)}
                    </Typography>
                    <Typography variant="body2">
                      Start: {plan.startWeightKg != null ? `${plan.startWeightKg} kg` : '—'} | Target:{' '}
                      {formatWeeklyDeltaKg(plan.targetWeeklyWeightChangeKg)}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap onClick={(e) => e.stopPropagation()}>
                      {pid ? (
                        <Button size="small" variant="outlined" onClick={() => setEditingPlan(plan)}>
                          Upravit
                        </Button>
                      ) : null}
                      {pid && plan.active ? (
                        <Button
                          size="small"
                          color="warning"
                          variant="outlined"
                          disabled={deactivateMutation.isPending || activateMutation.isPending}
                          onClick={() => deactivateMutation.mutate(pid)}
                        >
                          Deaktivovat
                        </Button>
                      ) : null}
                      {pid && !plan.active ? (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={activateMutation.isPending || deactivateMutation.isPending}
                          onClick={() => activateMutation.mutate(pid)}
                        >
                          Aktivovat
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          <TablePagination
            component="div"
            count={totalElements}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 20, 50]}
            labelRowsPerPage="Řádků:"
          />
        </>
      )}

      <GoalPlanEditDialog
        open={editingPlan !== null}
        plan={editingPlan}
        isSubmitting={updateMutation.isPending}
        onClose={() => setEditingPlan(null)}
        onSave={(goalPlanId, data) => updateMutation.mutate({ goalPlanId, data })}
      />
    </Stack>
  );
};
