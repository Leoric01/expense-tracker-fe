import { assetFindAll, getAssetFindAllQueryKey } from '@api/asset-controller/asset-controller';
import {
  budgetPlanCreate,
  budgetPlanDeactivate,
  budgetPlanUpdate,
} from '@api/budget-plan-controller/budget-plan-controller';
import type {
  AssetResponseDto,
  BudgetPlanResponseDto,
  CategoryResponseDto,
  CreateBudgetPlanRequestDto,
  PagedModelAssetResponseDto,
  RecurringBudgetResponseDto,
  UpdateBudgetPlanRequestDto,
} from '@api/model';
import { CreateBudgetPlanRequestDtoPeriodType } from '@api/model';
import { UpdateBudgetPlanRequestDtoPeriodType } from '@api/model';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AmountTextFieldCs } from '@pages/home/AmountTextFieldCs';
import { assetSelectLabel, inferAssetMeta } from '@pages/home/holdingAdapter';
import {
  formatAmountDisplayCs,
  parseAmount,
} from '@pages/home/transactionFormUtils';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import {
  calendarDayEndUtcIso,
  calendarDayStartUtcIso,
  formatDateDdMmYyyyFromDate,
  parseCsDateTime,
  startOfCurrentLocalMonthDate,
} from '@utils/dateTimeCs';
import { majorToMinorUnitsForScale, minorUnitsToMajorForScale } from '@utils/moneyMinorUnits';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, type SubmitEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { budgetPeriodLabelCs } from './categoryBudgetPeriodLabels';
import { CategoryBudgetPlanUsageLine } from './categoryBudgetUsage';
import { CategoryRecurringBudgetTab } from './CategoryRecurringBudgetTab';

type Props = {
  open: boolean;
  category: CategoryResponseDto | null;
  trackerId: string;
  /** Jednorázové rozpočty (budget-plan). */
  plans: BudgetPlanResponseDto[];
  /** Opakující se šablony (recurring-budget). */
  recurringPlans: RecurringBudgetResponseDto[];
  onClose: () => void;
  onInvalidate: () => void;
};

const PERIOD_OPTIONS = Object.values(CreateBudgetPlanRequestDtoPeriodType);
const ASSET_LIST_PARAMS = { page: 0, size: 500 } as const;

/** Menší výška řádků (OutlinedInput). */
const outlineDenseSx = {
  '& .MuiOutlinedInput-root': { minHeight: 34 },
  '& .MuiOutlinedInput-input': { py: 0.45, px: 1, fontSize: '0.8125rem' },
} as const;

const selectDenseSx = {
  '& .MuiOutlinedInput-root': { minHeight: 34 },
  '& .MuiSelect-select': { py: 0.45, px: 1, fontSize: '0.8125rem', display: 'flex', alignItems: 'center' },
} as const;

const compactField = {
  size: 'small' as const,
  helperText: ' ' as const,
  FormHelperTextProps: { sx: { m: 0, minHeight: 0, display: 'none' } },
};

const oneOffFormRootSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '7fr 3fr' },
  columnGap: 1,
  rowGap: 0.25,
  alignItems: 'flex-start',
} as const;

const oneOffFooterSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
  columnGap: 0.75,
  rowGap: 0.25,
  alignItems: 'flex-start',
  gridColumn: { xs: '1', sm: '1 / -1' },
} as const;

function isoToDdMmYyyyInput(iso?: string): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDateDdMmYyyyFromDate(d);
}

function parseDdMmYyyyToStartIso(s: string): string | null {
  const d = parseCsDateTime(s.trim());
  if (!d) return null;
  return calendarDayStartUtcIso(d);
}

function parseDdMmYyyyToEndIso(s: string): string | null {
  const d = parseCsDateTime(s.trim());
  if (!d) return null;
  return calendarDayEndUtcIso(d);
}

export const CategoryBudgetPlansDialog: FC<Props> = ({
  open,
  category,
  trackerId,
  plans,
  recurringPlans,
  onClose,
  onInvalidate,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [budgetTab, setBudgetTab] = useState(0);
  const [editing, setEditing] = useState<BudgetPlanResponseDto | null>(null);

  const [createName, setCreateName] = useState('');
  const [createAmountCanon, setCreateAmountCanon] = useState('');
  const [createAssetId, setCreateAssetId] = useState('');
  const [createPeriod, setCreatePeriod] = useState<CreateBudgetPlanRequestDtoPeriodType>(
    CreateBudgetPlanRequestDtoPeriodType.MONTHLY,
  );
  const [createValidFrom, setCreateValidFrom] = useState('');
  const [createValidTo, setCreateValidTo] = useState('');

  const [editName, setEditName] = useState('');
  const [editAmountCanon, setEditAmountCanon] = useState('');
  const [editAssetId, setEditAssetId] = useState('');
  const [editPeriod, setEditPeriod] = useState<UpdateBudgetPlanRequestDtoPeriodType>(
    UpdateBudgetPlanRequestDtoPeriodType.MONTHLY,
  );
  const [editValidFrom, setEditValidFrom] = useState('');
  const [editValidTo, setEditValidTo] = useState('');

  const { data: assetsRes } = useQuery({
    queryKey: getAssetFindAllQueryKey(ASSET_LIST_PARAMS),
    queryFn: async () => {
      const res = await assetFindAll(ASSET_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('asset');
      return res.data as PagedModelAssetResponseDto;
    },
    staleTime: 60_000,
  });

  const assetsSorted = useMemo(() => {
    const raw = assetsRes?.content ?? [];
    const list = raw.filter((a: AssetResponseDto) => a.id && a.active !== false && (a.code ?? '').trim());
    return [...list].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { sensitivity: 'base' }));
  }, [assetsRes?.content]);

  const defaultAssetId = useMemo(() => {
    if (assetsSorted.length === 0) return '';
    const cz = assetsSorted.find((a) => a.code?.trim().toUpperCase() === 'CZK');
    return (cz ?? assetsSorted[0]).id ?? '';
  }, [assetsSorted]);

  const resetCreate = useCallback((cat: CategoryResponseDto | null) => {
    setCreateName(cat?.name ? `Rozpočet — ${cat.name}` : 'Rozpočet');
    setCreateAmountCanon('');
    setCreateAssetId('');
    setCreatePeriod(CreateBudgetPlanRequestDtoPeriodType.MONTHLY);
    setCreateValidFrom(formatDateDdMmYyyyFromDate(startOfCurrentLocalMonthDate()));
    setCreateValidTo('');
  }, []);

  useEffect(() => {
    if (!open || !category) return;
    resetCreate(category);
    setEditing(null);
  }, [open, category?.id, resetCreate, category]);

  useEffect(() => {
    if (open) setBudgetTab(0);
  }, [open, category?.id]);

  useEffect(() => {
    setEditing(null);
  }, [budgetTab]);

  useEffect(() => {
    if (!defaultAssetId) return;
    setCreateAssetId((id) => id || defaultAssetId);
  }, [defaultAssetId, category?.id]);

  useEffect(() => {
    if (!editing) return;
    setEditName(editing.name ?? '');
    const code = (editing.assetCode ?? 'CZK').trim().toUpperCase() || 'CZK';
    const scale = editing.assetScale ?? inferAssetMeta(code).scale;
    const major = minorUnitsToMajorForScale(editing.amount, scale);
    setEditAmountCanon(major !== undefined && Number.isFinite(major) ? String(major) : '');
    const match = assetsSorted.find(
      (a) => (a.code ?? '').trim().toUpperCase() === (editing.assetCode ?? '').trim().toUpperCase(),
    );
    setEditAssetId(match?.id ?? '');
    setEditPeriod(
      (editing.periodType as UpdateBudgetPlanRequestDtoPeriodType) ??
        UpdateBudgetPlanRequestDtoPeriodType.MONTHLY,
    );
    setEditValidFrom(isoToDdMmYyyyInput(editing.validFrom));
    setEditValidTo(isoToDdMmYyyyInput(editing.validTo));
  }, [editing, assetsSorted]);

  const handleCreate = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!category?.id) return;
    const name = createName.trim();
    if (!name) {
      enqueueSnackbar('Vyplň název rozpočtu', { variant: 'warning' });
      return;
    }
    const major = parseAmount(formatAmountDisplayCs(createAmountCanon));
    if (major == null || major < 0) {
      enqueueSnackbar('Zadej platnou částku', { variant: 'warning' });
      return;
    }
    const createAsset = assetsSorted.find((a) => a.id === createAssetId);
    const code = createAsset?.code?.trim().toUpperCase() ?? '';
    if (!code) {
      enqueueSnackbar('Vyber aktivum', { variant: 'warning' });
      return;
    }
    const fromIso = parseDdMmYyyyToStartIso(createValidFrom || '');
    if (!fromIso) {
      enqueueSnackbar('Platnost od — zadej datum jako dd.MM.yyyy', { variant: 'warning' });
      return;
    }
    const toRaw = createValidTo.trim();
    if (!toRaw) {
      enqueueSnackbar('Platnost do je povinná', { variant: 'warning' });
      return;
    }
    const toIso = parseDdMmYyyyToEndIso(toRaw);
    if (!toIso) {
      enqueueSnackbar('Platnost do — neplatné datum', { variant: 'warning' });
      return;
    }

    const scale = createAsset?.scale ?? inferAssetMeta(code).scale;
    const payload: CreateBudgetPlanRequestDto = {
      name,
      amount: majorToMinorUnitsForScale(major, scale),
      assetCode: code,
      periodType: createPeriod,
      validFrom: fromIso,
      validTo: toIso,
      categoryId: category.id,
    };

    setSubmitting(true);
    try {
      const res = await budgetPlanCreate(trackerId, payload);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Rozpočet se nepodařilo vytvořit'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Rozpočet byl vytvořen', { variant: 'success' });
      resetCreate(category);
      onInvalidate();
    } catch {
      enqueueSnackbar('Rozpočet se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!editing?.id || !category?.id) return;
    const name = editName.trim();
    if (!name) {
      enqueueSnackbar('Vyplň název', { variant: 'warning' });
      return;
    }
    const major = parseAmount(formatAmountDisplayCs(editAmountCanon));
    if (major == null || major < 0) {
      enqueueSnackbar('Zadej platnou částku', { variant: 'warning' });
      return;
    }
    const editAsset = assetsSorted.find((a) => a.id === editAssetId);
    const code = editAsset?.code?.trim().toUpperCase() ?? '';
    if (!code) {
      enqueueSnackbar('Vyber aktivum', { variant: 'warning' });
      return;
    }
    const fromIso = parseDdMmYyyyToStartIso(editValidFrom || '');
    if (!fromIso) {
      enqueueSnackbar('Platnost od — zadej datum jako dd.MM.yyyy', { variant: 'warning' });
      return;
    }
    const toRaw = editValidTo.trim();
    if (!toRaw) {
      enqueueSnackbar('Platnost do je povinná', { variant: 'warning' });
      return;
    }
    const toIso = parseDdMmYyyyToEndIso(toRaw);
    if (!toIso) {
      enqueueSnackbar('Platnost do — neplatné datum', { variant: 'warning' });
      return;
    }

    const scale = editAsset?.scale ?? inferAssetMeta(code).scale;
    const body: UpdateBudgetPlanRequestDto = {
      name,
      amount: majorToMinorUnitsForScale(major, scale),
      assetCode: code,
      periodType: editPeriod,
      validFrom: fromIso,
      validTo: toIso,
      categoryId: category.id,
    };

    setSubmitting(true);
    try {
      const res = await budgetPlanUpdate(trackerId, editing.id, body);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Úprava se nepodařila'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Rozpočet byl upraven', { variant: 'success' });
      setEditing(null);
      onInvalidate();
    } catch {
      enqueueSnackbar('Úprava se nepodařila', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (plan: BudgetPlanResponseDto) => {
    if (!plan.id) return;
    if (!window.confirm(`Deaktivovat rozpočet „${plan.name ?? plan.id}“?`)) return;
    setSubmitting(true);
    try {
      const res = await budgetPlanDeactivate(trackerId, plan.id);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Deaktivace se nepodařila'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Rozpočet byl deaktivován', { variant: 'success' });
      if (editing?.id === plan.id) setEditing(null);
      onInvalidate();
    } catch {
      enqueueSnackbar('Deaktivace se nepodařila', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const catName = category?.name ?? '—';

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ py: 0.75, px: 2, typography: 'subtitle2', fontWeight: 600 }}>
        Rozpočty — {catName}
      </DialogTitle>
      <DialogContent sx={{ pt: 0, px: 2, pb: 1 }}>
        <Tabs
          value={budgetTab}
          onChange={(_, v) => setBudgetTab(v)}
          sx={{ mb: 0.5, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8125rem' } }}
        >
          <Tab label="Opakující se limit" id="budget-tab-recurring" aria-controls="budget-panel-recurring" />
          <Tab label="Jednorázový rozpočet" id="budget-tab-oneoff" aria-controls="budget-panel-oneoff" />
        </Tabs>

        {budgetTab === 0 && (
          <CategoryRecurringBudgetTab
            category={category}
            trackerId={trackerId}
            plans={recurringPlans}
            onInvalidate={onInvalidate}
          />
        )}

        {budgetTab === 1 && (
        <Stack spacing={0.75} sx={{ pt: 0 }}>
          {plans.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              K této kategorii zatím není žádný aktivní rozpočet.
            </Typography>
          ) : (
            <Stack spacing={0}>
              {plans.map((p) => (
                <Box
                  key={p.id ?? p.name}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 0.75,
                    py: 0.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <CategoryBudgetPlanUsageLine plan={p} showPeriodType />
                  </Box>
                  <Tooltip title="Upravit">
                    <IconButton
                      size="small"
                      aria-label="upravit rozpočet"
                      disabled={submitting}
                      onClick={() => setEditing(p)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Deaktivovat">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="deaktivovat rozpočet"
                      disabled={submitting}
                      onClick={() => handleDeactivate(p)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Stack>
          )}

          {editing && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block' }}>
                Upravit rozpočet
              </Typography>
              <Box component="form" onSubmit={handleUpdate} sx={{ mt: 0.25 }}>
                <Box sx={oneOffFormRootSx}>
                  <TextField
                    label="Název"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    fullWidth
                    sx={{ gridColumn: { xs: 1, sm: 1 }, ...outlineDenseSx }}
                    {...compactField}
                  />
                  <AmountTextFieldCs
                    label="Částka"
                    canonical={editAmountCanon}
                    setCanonical={setEditAmountCanon}
                    required
                    fullWidth
                    size="small"
                    helperText=" "
                    FormHelperTextProps={{ sx: { m: 0, minHeight: 0, display: 'none' } }}
                    sx={{ gridColumn: { xs: 1, sm: 2 }, ...outlineDenseSx }}
                  />
                  <FormControl
                    fullWidth
                    size="small"
                    sx={{ gridColumn: { xs: 1, sm: 1 }, minWidth: 0, ...selectDenseSx }}
                  >
                    <InputLabel id="edit-budget-period">Období</InputLabel>
                    <Select
                      labelId="edit-budget-period"
                      label="Období"
                      value={editPeriod}
                      onChange={(e) =>
                        setEditPeriod(e.target.value as UpdateBudgetPlanRequestDtoPeriodType)
                      }
                    >
                      {PERIOD_OPTIONS.map((v) => (
                        <MenuItem key={v} value={v}>
                          {budgetPeriodLabelCs(v)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl
                    fullWidth
                    size="small"
                    required
                    sx={{ gridColumn: { xs: 1, sm: 2 }, minWidth: 0, ...selectDenseSx }}
                  >
                    <InputLabel id="edit-budget-asset">Aktivum</InputLabel>
                    <Select
                      labelId="edit-budget-asset"
                      label="Aktivum"
                      value={editAssetId}
                      onChange={(e) => setEditAssetId(e.target.value as string)}
                    >
                      {assetsSorted.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {assetSelectLabel(a)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box sx={oneOffFooterSx}>
                    <TextField
                      label="Platnost od"
                      value={editValidFrom}
                      onChange={(e) => setEditValidFrom(e.target.value)}
                      placeholder="dd.MM.yyyy"
                      required
                      fullWidth
                      sx={outlineDenseSx}
                      {...compactField}
                    />
                    <TextField
                      label="Platnost do"
                      value={editValidTo}
                      onChange={(e) => setEditValidTo(e.target.value)}
                      placeholder="dd.MM.yyyy"
                      required
                      fullWidth
                      sx={outlineDenseSx}
                      {...compactField}
                    />
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ pt: { xs: 0, sm: 0.25 } }}>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={submitting || assetsSorted.length === 0 || !editAssetId}
                        size="small"
                      >
                        Uložit
                      </Button>
                      <Button type="button" onClick={() => setEditing(null)} disabled={submitting} size="small">
                        Zrušit
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              </Box>
            </>
          )}

          {!editing && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Box component="form" onSubmit={handleCreate} sx={{ mt: 0.25 }}>
                <Box sx={oneOffFormRootSx}>
                  <TextField
                    label="Název"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    fullWidth
                    sx={{ gridColumn: { xs: 1, sm: 1 }, ...outlineDenseSx }}
                    {...compactField}
                  />
                  <AmountTextFieldCs
                    label="Částka"
                    canonical={createAmountCanon}
                    setCanonical={setCreateAmountCanon}
                    required
                    fullWidth
                    size="small"
                    helperText=" "
                    FormHelperTextProps={{ sx: { m: 0, minHeight: 0, display: 'none' } }}
                    sx={{ gridColumn: { xs: 1, sm: 2 }, ...outlineDenseSx }}
                  />
                  <FormControl
                    fullWidth
                    size="small"
                    sx={{ gridColumn: { xs: 1, sm: 1 }, minWidth: 0, ...selectDenseSx }}
                  >
                    <InputLabel id="create-budget-period">Období</InputLabel>
                    <Select
                      labelId="create-budget-period"
                      label="Období"
                      value={createPeriod}
                      onChange={(e) =>
                        setCreatePeriod(e.target.value as CreateBudgetPlanRequestDtoPeriodType)
                      }
                    >
                      {PERIOD_OPTIONS.map((v) => (
                        <MenuItem key={v} value={v}>
                          {budgetPeriodLabelCs(v)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl
                    fullWidth
                    size="small"
                    required
                    sx={{ gridColumn: { xs: 1, sm: 2 }, minWidth: 0, ...selectDenseSx }}
                  >
                    <InputLabel id="create-budget-asset">Aktivum</InputLabel>
                    <Select
                      labelId="create-budget-asset"
                      label="Aktivum"
                      value={createAssetId || defaultAssetId}
                      onChange={(e) => setCreateAssetId(e.target.value as string)}
                    >
                      {assetsSorted.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {assetSelectLabel(a)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box sx={oneOffFooterSx}>
                    <TextField
                      label="Platnost od"
                      value={createValidFrom}
                      onChange={(e) => setCreateValidFrom(e.target.value)}
                      placeholder="dd.MM.yyyy"
                      required
                      fullWidth
                      sx={outlineDenseSx}
                      {...compactField}
                    />
                    <TextField
                      label="Platnost do"
                      value={createValidTo}
                      onChange={(e) => setCreateValidTo(e.target.value)}
                      placeholder="dd.MM.yyyy"
                      required
                      fullWidth
                      sx={outlineDenseSx}
                      {...compactField}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={submitting || assetsSorted.length === 0}
                      size="small"
                      sx={{ alignSelf: 'center' }}
                    >
                      Přidat rozpočet
                    </Button>
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 0.75 }}>
        <Button size="small" onClick={onClose} disabled={submitting}>
          Zavřít
        </Button>
      </DialogActions>
    </Dialog>
  );
};
