import {
  budgetPlanCreate,
  budgetPlanDeactivate,
  budgetPlanUpdate,
} from '@api/budget-plan-controller/budget-plan-controller';
import type {
  BudgetPlanResponseDto,
  CategoryResponseDto,
  CreateBudgetPlanRequestDto,
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
import { majorToMinorUnits, minorUnitsToMajor } from '@utils/moneyMinorUnits';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useCallback, useEffect, useState } from 'react';
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
  const [createCurrency, setCreateCurrency] = useState('CZK');
  const [createPeriod, setCreatePeriod] = useState<CreateBudgetPlanRequestDtoPeriodType>(
    CreateBudgetPlanRequestDtoPeriodType.MONTHLY,
  );
  const [createValidFrom, setCreateValidFrom] = useState('');
  const [createValidTo, setCreateValidTo] = useState('');

  const [editName, setEditName] = useState('');
  const [editAmountCanon, setEditAmountCanon] = useState('');
  const [editCurrency, setEditCurrency] = useState('CZK');
  const [editPeriod, setEditPeriod] = useState<UpdateBudgetPlanRequestDtoPeriodType>(
    UpdateBudgetPlanRequestDtoPeriodType.MONTHLY,
  );
  const [editValidFrom, setEditValidFrom] = useState('');
  const [editValidTo, setEditValidTo] = useState('');

  const resetCreate = useCallback((cat: CategoryResponseDto | null) => {
    setCreateName(cat?.name ? `Rozpočet — ${cat.name}` : 'Rozpočet');
    setCreateAmountCanon('');
    setCreateCurrency('CZK');
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
    if (!editing) return;
    setEditName(editing.name ?? '');
    const major = minorUnitsToMajor(editing.amount);
    setEditAmountCanon(major !== undefined ? String(major) : '');
    setEditCurrency((editing.currencyCode ?? 'CZK').toUpperCase());
    setEditPeriod(
      (editing.periodType as UpdateBudgetPlanRequestDtoPeriodType) ??
        UpdateBudgetPlanRequestDtoPeriodType.MONTHLY,
    );
    setEditValidFrom(isoToDdMmYyyyInput(editing.validFrom));
    setEditValidTo(isoToDdMmYyyyInput(editing.validTo));
  }, [editing]);

  const handleCreate = async (e: FormEvent) => {
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
    const code = createCurrency.trim().toUpperCase();
    if (!code) {
      enqueueSnackbar('Vyplň měnu', { variant: 'warning' });
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

    const payload: CreateBudgetPlanRequestDto = {
      name,
      amount: majorToMinorUnits(major),
      currencyCode: code,
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

  const handleUpdate = async (e: FormEvent) => {
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
    const code = editCurrency.trim().toUpperCase();
    if (!code) {
      enqueueSnackbar('Vyplň měnu', { variant: 'warning' });
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

    const body: UpdateBudgetPlanRequestDto = {
      name,
      amount: majorToMinorUnits(major),
      currencyCode: code,
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
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="md">
      <DialogTitle>Rozpočty — {catName}</DialogTitle>
      <DialogContent>
        <Tabs value={budgetTab} onChange={(_, v) => setBudgetTab(v)} sx={{ mb: 2 }}>
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
        <Stack spacing={2} sx={{ pt: 0 }}>
          {plans.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              K této kategorii zatím není žádný aktivní rozpočet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {plans.map((p) => (
                <Box
                  key={p.id ?? p.name}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    py: 1,
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
              <Divider />
              <Typography variant="subtitle2">Upravit rozpočet</Typography>
              <Box component="form" onSubmit={handleUpdate}>
                <Stack spacing={2}>
                  <TextField
                    label="Název"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    fullWidth
                    size="small"
                  />
                  <AmountTextFieldCs
                    label="Částka"
                    canonical={editAmountCanon}
                    setCanonical={setEditAmountCanon}
                    required
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Měna (ISO)"
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    required
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
                  />
                  <FormControl fullWidth size="small">
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
                  <TextField
                    label="Platnost od"
                    value={editValidFrom}
                    onChange={(e) => setEditValidFrom(e.target.value)}
                    placeholder="dd.MM.yyyy"
                    required
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Platnost do"
                    value={editValidTo}
                    onChange={(e) => setEditValidTo(e.target.value)}
                    placeholder="dd.MM.yyyy"
                    required
                    fullWidth
                    size="small"
                  />
                  <Stack direction="row" spacing={1}>
                    <Button type="submit" variant="contained" disabled={submitting} size="small">
                      Uložit změny
                    </Button>
                    <Button type="button" onClick={() => setEditing(null)} disabled={submitting} size="small">
                      Zrušit úpravu
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </>
          )}

          {!editing && (
            <>
              <Divider />
              <Typography variant="subtitle2">Nový rozpočet pro kategorii</Typography>
              <Box component="form" onSubmit={handleCreate}>
                <Stack spacing={2}>
                  <TextField
                    label="Název"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    fullWidth
                    size="small"
                  />
                  <AmountTextFieldCs
                    label="Částka"
                    canonical={createAmountCanon}
                    setCanonical={setCreateAmountCanon}
                    required
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Měna (ISO)"
                    value={createCurrency}
                    onChange={(e) => setCreateCurrency(e.target.value)}
                    required
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
                  />
                  <FormControl fullWidth size="small">
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
                  <TextField
                    label="Platnost od"
                    value={createValidFrom}
                    onChange={(e) => setCreateValidFrom(e.target.value)}
                    placeholder="dd.MM.yyyy"
                    required
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Platnost do"
                    value={createValidTo}
                    onChange={(e) => setCreateValidTo(e.target.value)}
                    placeholder="dd.MM.yyyy"
                    required
                    fullWidth
                    size="small"
                  />
                  <Button type="submit" variant="contained" disabled={submitting} size="small">
                    Přidat rozpočet
                  </Button>
                </Stack>
              </Box>
            </>
          )}
        </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Zavřít
        </Button>
      </DialogActions>
    </Dialog>
  );
};
