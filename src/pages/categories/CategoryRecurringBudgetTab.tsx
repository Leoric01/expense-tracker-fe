import {
  recurringBudgetCreate,
  recurringBudgetDeactivate,
  recurringBudgetUpdate,
} from '@api/recurring-budget-controller/recurring-budget-controller';
import type {
  CategoryResponseDto,
  CreateRecurringBudgetRequestDto,
  RecurringBudgetResponseDto,
  UpdateRecurringBudgetRequestDto,
} from '@api/model';
import { CreateRecurringBudgetRequestDtoPeriodType } from '@api/model';
import { UpdateRecurringBudgetRequestDtoPeriodType } from '@api/model';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AmountTextFieldCs } from '@pages/home/AmountTextFieldCs';
import { formatWalletAmount } from '@pages/home/walletDisplay';
import { formatAmountDisplayCs, parseAmount } from '@pages/home/transactionFormUtils';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import {
  formatDateDdMmYyyy,
  formatDateDdMmYyyyFromDate,
  formatDateTimeDdMmYyyyHhMm,
  parseCsDateTime,
} from '@utils/dateTimeCs';
import { majorToMinorUnits, minorUnitsToMajor } from '@utils/moneyMinorUnits';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useCallback, useEffect, useState } from 'react';
import { budgetPeriodLabelCs } from './categoryBudgetPeriodLabels';
import { intervalFieldHelperCs, recurringIntervalDescriptionCs } from './categoryRecurringBudgetIntervalText';

type Props = {
  category: CategoryResponseDto | null;
  trackerId: string;
  plans: RecurringBudgetResponseDto[];
  onInvalidate: () => void;
};

const PERIOD_OPTIONS = Object.values(CreateRecurringBudgetRequestDtoPeriodType);

function startOfDayIso(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
}

function endOfDayIso(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
}

function isoToDdMmYyyyInput(iso?: string): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDateDdMmYyyyFromDate(d);
}

function parseDdMmYyyyToStartIso(s: string): string | null {
  const d = parseCsDateTime(s.trim());
  if (!d) return null;
  return startOfDayIso(d);
}

function parseDdMmYyyyToEndIso(s: string): string | null {
  const d = parseCsDateTime(s.trim());
  if (!d) return null;
  return endOfDayIso(d);
}

export const CategoryRecurringBudgetTab: FC<Props> = ({ category, trackerId, plans, onInvalidate }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<RecurringBudgetResponseDto | null>(null);

  const [cName, setCName] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cCurrency, setCCurrency] = useState('CZK');
  const [cPeriod, setCPeriod] = useState(CreateRecurringBudgetRequestDtoPeriodType.MONTHLY);
  const [cInterval, setCInterval] = useState('1');
  const [cStart, setCStart] = useState('');
  const [cEnd, setCEnd] = useState('');

  const [eName, setEName] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eCurrency, setECurrency] = useState('CZK');
  const [ePeriod, setEPeriod] = useState(UpdateRecurringBudgetRequestDtoPeriodType.MONTHLY);
  const [eInterval, setEInterval] = useState('1');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');

  const resetCreate = useCallback((cat: CategoryResponseDto | null) => {
    setCName(cat?.name ? `Limit — ${cat.name}` : 'Limit');
    setCAmount('');
    setCCurrency('CZK');
    setCPeriod(CreateRecurringBudgetRequestDtoPeriodType.MONTHLY);
    setCInterval('1');
    setCStart(formatDateDdMmYyyyFromDate(new Date()));
    setCEnd('');
  }, []);

  useEffect(() => {
    if (category) resetCreate(category);
    setEditing(null);
  }, [category?.id, resetCreate, category]);

  useEffect(() => {
    if (!editing) return;
    setEName(editing.name ?? '');
    const maj = minorUnitsToMajor(editing.amount);
    setEAmount(maj !== undefined ? String(maj) : '');
    setECurrency((editing.currencyCode ?? 'CZK').toUpperCase());
    setEPeriod(
      (editing.periodType as UpdateRecurringBudgetRequestDtoPeriodType) ??
        UpdateRecurringBudgetRequestDtoPeriodType.MONTHLY,
    );
    setEInterval(String(editing.intervalValue ?? 1));
    setEStart(isoToDdMmYyyyInput(editing.startDate));
    setEEnd(isoToDdMmYyyyInput(editing.endDate));
  }, [editing]);

  const parseInterval = (s: string): number | null => {
    const n = parseInt(s.trim(), 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!category?.id) return;
    const name = cName.trim();
    if (!name) {
      enqueueSnackbar('Vyplň název', { variant: 'warning' });
      return;
    }
    const major = parseAmount(formatAmountDisplayCs(cAmount));
    if (major == null || major < 0) {
      enqueueSnackbar('Zadej platnou částku', { variant: 'warning' });
      return;
    }
    const code = cCurrency.trim().toUpperCase();
    if (!code) {
      enqueueSnackbar('Vyplň měnu', { variant: 'warning' });
      return;
    }
    const iv = parseInterval(cInterval);
    if (iv == null) {
      enqueueSnackbar('Interval musí být celé číslo ≥ 1', { variant: 'warning' });
      return;
    }
    const startIso = parseDdMmYyyyToStartIso(cStart || '');
    if (!startIso) {
      enqueueSnackbar('Začátek platnosti — neplatné datum', { variant: 'warning' });
      return;
    }
    let endIso: string | undefined;
    if (cEnd.trim()) {
      const t = parseDdMmYyyyToEndIso(cEnd);
      if (!t) {
        enqueueSnackbar('Konec platnosti — neplatné datum', { variant: 'warning' });
        return;
      }
      endIso = t;
    }

    const payload: CreateRecurringBudgetRequestDto = {
      name,
      amount: majorToMinorUnits(major),
      currencyCode: code,
      periodType: cPeriod,
      intervalValue: iv,
      startDate: startIso,
      categoryId: category.id,
      ...(endIso ? { endDate: endIso } : {}),
    };

    setSubmitting(true);
    try {
      const res = await recurringBudgetCreate(trackerId, payload);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Šablonu se nepodařilo vytvořit'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Opakující se limit byl uložen — nové rozpočty založí server podle nastavení.', {
        variant: 'success',
      });
      resetCreate(category);
      onInvalidate();
    } catch {
      enqueueSnackbar('Vytvoření se nepodařilo', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing?.id || !category?.id) return;
    const name = eName.trim();
    if (!name) {
      enqueueSnackbar('Vyplň název', { variant: 'warning' });
      return;
    }
    const major = parseAmount(formatAmountDisplayCs(eAmount));
    if (major == null || major < 0) {
      enqueueSnackbar('Zadej platnou částku', { variant: 'warning' });
      return;
    }
    const code = eCurrency.trim().toUpperCase();
    if (!code) {
      enqueueSnackbar('Vyplň měnu', { variant: 'warning' });
      return;
    }
    const iv = parseInterval(eInterval);
    if (iv == null) {
      enqueueSnackbar('Interval musí být celé číslo ≥ 1', { variant: 'warning' });
      return;
    }
    const startIso = parseDdMmYyyyToStartIso(eStart || '');
    if (!startIso) {
      enqueueSnackbar('Začátek platnosti — neplatné datum', { variant: 'warning' });
      return;
    }
    let endIso: string | undefined;
    if (eEnd.trim()) {
      const t = parseDdMmYyyyToEndIso(eEnd);
      if (!t) {
        enqueueSnackbar('Konec platnosti — neplatné datum', { variant: 'warning' });
        return;
      }
      endIso = t;
    }

    const body: UpdateRecurringBudgetRequestDto = {
      name,
      amount: majorToMinorUnits(major),
      currencyCode: code,
      periodType: ePeriod,
      intervalValue: iv,
      startDate: startIso,
      categoryId: category.id,
      ...(endIso !== undefined ? { endDate: endIso } : {}),
    };

    setSubmitting(true);
    try {
      const res = await recurringBudgetUpdate(trackerId, editing.id, body);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Úprava se nepodařila'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Uloženo', { variant: 'success' });
      setEditing(null);
      onInvalidate();
    } catch {
      enqueueSnackbar('Úprava se nepodařila', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (p: RecurringBudgetResponseDto) => {
    if (!p.id) return;
    if (!window.confirm(`Zastavit opakování „${p.name ?? p.id}“?`)) return;
    setSubmitting(true);
    try {
      const res = await recurringBudgetDeactivate(trackerId, p.id);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Nepodařilo se zastavit'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Opakování bylo zastaveno', { variant: 'success' });
      if (editing?.id === p.id) setEditing(null);
      onInvalidate();
    } catch {
      enqueueSnackbar('Operace se nepodařila', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Nastav maximální částku za zvolené období. Server podle toho založí rozpočet vždy na začátku dalšího
        cyklu (např. 1. dne v měsíci u měsíčního limitu). Interval určuje, zda jde o každé období, každé druhé
        atd.
      </Typography>

      {plans.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Zatím žádný opakující se limit.
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
                <Typography variant="subtitle2">{p.name ?? '—'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  max. {formatWalletAmount(p.amount, p.currencyCode)} ·{' '}
                  {recurringIntervalDescriptionCs(p.periodType, p.intervalValue ?? 1)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {p.startDate ? `Od ${formatDateDdMmYyyy(p.startDate)}` : ''}
                  {p.endDate ? ` · do ${formatDateDdMmYyyy(p.endDate)}` : ''}
                </Typography>
                {p.nextRunDate && (
                  <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.25 }}>
                    Další běh / nový rozpočet: {formatDateTimeDdMmYyyyHhMm(p.nextRunDate)}
                  </Typography>
                )}
              </Box>
              <Tooltip title="Upravit">
                <IconButton
                  size="small"
                  aria-label="upravit"
                  disabled={submitting}
                  onClick={() => setEditing(p)}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zastavit opakování">
                <IconButton
                  size="small"
                  color="error"
                  aria-label="zastavit"
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
          <Typography variant="subtitle2">Upravit opakující se limit</Typography>
          <Box component="form" onSubmit={handleUpdate}>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={eName}
                onChange={(e) => setEName(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <AmountTextFieldCs
                label="Max. částka za období"
                canonical={eAmount}
                setCanonical={setEAmount}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Měna (ISO)"
                value={eCurrency}
                onChange={(e) => setECurrency(e.target.value)}
                required
                fullWidth
                size="small"
                inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
              />
              <FormControl fullWidth size="small">
                <InputLabel id="e-rec-period">Druh období</InputLabel>
                <Select
                  labelId="e-rec-period"
                  label="Druh období"
                  value={ePeriod}
                  onChange={(e) =>
                    setEPeriod(e.target.value as UpdateRecurringBudgetRequestDtoPeriodType)
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
                label="Interval"
                value={eInterval}
                onChange={(e) => setEInterval(e.target.value)}
                required
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 1, step: 1 }}
                helperText={intervalFieldHelperCs(ePeriod)}
              />
              <TextField
                label="Platnost od"
                value={eStart}
                onChange={(e) => setEStart(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Platnost do (volitelné)"
                value={eEnd}
                onChange={(e) => setEEnd(e.target.value)}
                fullWidth
                size="small"
              />
              <Stack direction="row" spacing={1}>
                <Button type="submit" variant="contained" disabled={submitting} size="small">
                  Uložit
                </Button>
                <Button type="button" size="small" disabled={submitting} onClick={() => setEditing(null)}>
                  Zrušit
                </Button>
              </Stack>
            </Stack>
          </Box>
        </>
      )}

      {!editing && (
        <>
          <Divider />
          <Typography variant="subtitle2">Nový opakující se limit</Typography>
          <Box component="form" onSubmit={handleCreate}>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <AmountTextFieldCs
                label="Max. částka za období"
                canonical={cAmount}
                setCanonical={setCAmount}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Měna (ISO)"
                value={cCurrency}
                onChange={(e) => setCCurrency(e.target.value)}
                required
                fullWidth
                size="small"
                inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
              />
              <FormControl fullWidth size="small">
                <InputLabel id="c-rec-period">Druh období</InputLabel>
                <Select
                  labelId="c-rec-period"
                  label="Druh období"
                  value={cPeriod}
                  onChange={(e) =>
                    setCPeriod(e.target.value as CreateRecurringBudgetRequestDtoPeriodType)
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
                label="Interval"
                value={cInterval}
                onChange={(e) => setCInterval(e.target.value)}
                required
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 1, step: 1 }}
                helperText={intervalFieldHelperCs(cPeriod)}
              />
              <TextField
                label="Platnost od"
                value={cStart}
                onChange={(e) => setCStart(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Platnost do (volitelné)"
                value={cEnd}
                onChange={(e) => setCEnd(e.target.value)}
                fullWidth
                size="small"
              />
              <Button type="submit" variant="contained" disabled={submitting} size="small">
                Přidat opakující se limit
              </Button>
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
};
