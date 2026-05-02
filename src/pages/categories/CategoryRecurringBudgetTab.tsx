import {
  recurringBudgetCreate,
  recurringBudgetDeactivate,
  recurringBudgetUpdate,
} from '@api/recurring-budget-controller/recurring-budget-controller';
import { assetFindAll, getAssetFindAllQueryKey } from '@api/asset-controller/asset-controller';
import type {
  AssetResponseDto,
  CategoryResponseDto,
  CreateRecurringBudgetRequestDto,
  PagedModelAssetResponseDto,
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
import { assetSelectLabel } from '@pages/home/holdingAdapter';
import { formatAmountDisplayCs, parseAmount } from '@pages/home/transactionFormUtils';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import {
  calendarDayEndUtcIso,
  calendarDayStartUtcIso,
  formatDateDdMmYyyy,
  formatDateDdMmYyyyFromDate,
  formatDateTimeDdMmYyyyHhMm,
  parseCsDateTime,
  startOfCurrentLocalMonthDate,
} from '@utils/dateTimeCs';
import {
  DEFAULT_FIAT_SCALE,
  majorToMinorUnitsForScale,
  minorUnitsToMajorForScale,
} from '@utils/moneyMinorUnits';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, type SubmitEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { budgetPeriodLabelCs } from './categoryBudgetPeriodLabels';
import { recurringIntervalDescriptionCs } from './categoryRecurringBudgetIntervalText';

type Props = {
  category: CategoryResponseDto | null;
  trackerId: string;
  plans: RecurringBudgetResponseDto[];
  onInvalidate: () => void;
};

const PERIOD_OPTIONS = Object.values(CreateRecurringBudgetRequestDtoPeriodType);
const ASSET_LIST_PARAMS = { page: 0, size: 500 } as const;

const outlineDenseSx = {
  '& .MuiOutlinedInput-root': { minHeight: 34 },
  '& .MuiOutlinedInput-input': { py: 0.45, px: 1, fontSize: '0.8125rem' },
} as const;

const selectDenseSx = {
  '& .MuiOutlinedInput-root': { minHeight: 34 },
  '& .MuiSelect-select': { py: 0.45, px: 1, fontSize: '0.8125rem', display: 'flex', alignItems: 'center' },
} as const;

const recurringFormRootSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '7fr 3fr' },
  columnGap: 1,
  rowGap: 0.25,
  alignItems: 'flex-start',
} as const;

const recurringFooterSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
  columnGap: 0.75,
  rowGap: 0.25,
  alignItems: 'flex-start',
  gridColumn: { xs: 1, sm: '1 / -1' },
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

function scaleForCode(assets: AssetResponseDto[], code: string | undefined): number {
  const u = (code ?? '').trim().toUpperCase();
  const a = assets.find((x) => (x.code ?? '').trim().toUpperCase() === u);
  return a?.scale ?? DEFAULT_FIAT_SCALE;
}

/** Major hodnota z minor + scale → řetězec pro AmountTextFieldCs (bez vědecké notace). */
function majorStringFromMinor(minor: number | undefined, scale: number): string {
  const maj = minorUnitsToMajorForScale(minor, scale);
  if (maj == null || !Number.isFinite(maj)) return '';
  const digits = Math.min(Math.max(0, Math.floor(scale)), 20);
  return maj
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}

export const CategoryRecurringBudgetTab: FC<Props> = ({ category, trackerId, plans, onInvalidate }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<RecurringBudgetResponseDto | null>(null);

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
    const list = raw.filter((a) => a.id && a.active !== false && (a.code ?? '').trim());
    return [...list].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { sensitivity: 'base' }));
  }, [assetsRes?.content]);

  const defaultAssetId = useMemo(() => {
    if (assetsSorted.length === 0) return '';
    const cz = assetsSorted.find((a) => a.code?.trim().toUpperCase() === 'CZK');
    return (cz ?? assetsSorted[0]).id ?? '';
  }, [assetsSorted]);

  const [cName, setCName] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cAssetId, setCAssetId] = useState('');
  const [cPeriod, setCPeriod] = useState<CreateRecurringBudgetRequestDtoPeriodType>(
    CreateRecurringBudgetRequestDtoPeriodType.MONTHLY,
  );
  const [cInterval, setCInterval] = useState('1');
  const [cStart, setCStart] = useState('');
  const [cEnd, setCEnd] = useState('');

  const [eName, setEName] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eAssetId, setEAssetId] = useState('');
  const [ePeriod, setEPeriod] = useState<UpdateRecurringBudgetRequestDtoPeriodType>(
    UpdateRecurringBudgetRequestDtoPeriodType.MONTHLY,
  );
  const [eInterval, setEInterval] = useState('1');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');

  const resetCreate = useCallback((cat: CategoryResponseDto | null) => {
    setCName(cat?.name ? `Limit — ${cat.name}` : 'Limit');
    setCAmount('');
    setCAssetId('');
    setCPeriod(CreateRecurringBudgetRequestDtoPeriodType.MONTHLY);
    setCInterval('1');
    setCStart(formatDateDdMmYyyyFromDate(startOfCurrentLocalMonthDate()));
    setCEnd('');
  }, []);

  useEffect(() => {
    if (!category) return;
    resetCreate(category);
    setEditing(null);
  }, [category?.id, resetCreate, category]);

  useEffect(() => {
    if (!defaultAssetId) return;
    setCAssetId((id) => id || defaultAssetId);
  }, [defaultAssetId, category?.id]);

  useEffect(() => {
    if (!editing) return;
    setEName(editing.name ?? '');
    const sc = editing.assetScale ?? scaleForCode(assetsSorted, editing.assetCode);
    setEAmount(majorStringFromMinor(editing.amount, sc));
    const match = assetsSorted.find(
      (a) => (a.code ?? '').trim().toUpperCase() === (editing.assetCode ?? '').trim().toUpperCase(),
    );
    setEAssetId(match?.id ?? '');
    setEPeriod(
      (editing.periodType as UpdateRecurringBudgetRequestDtoPeriodType) ??
        UpdateRecurringBudgetRequestDtoPeriodType.MONTHLY,
    );
    setEInterval(String(editing.intervalValue ?? 1));
    setEStart(isoToDdMmYyyyInput(editing.startDate));
    setEEnd(isoToDdMmYyyyInput(editing.endDate));
  }, [editing, assetsSorted]);

  const parseInterval = (s: string): number | null => {
    const n = parseInt(s.trim(), 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  };

  const handleCreate = async (e: SubmitEvent) => {
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
    const assetId = cAssetId || defaultAssetId;
    const asset = assetsSorted.find((a) => a.id === assetId);
    if (!asset?.code?.trim()) {
      enqueueSnackbar('Vyber aktivum (měnu rozpočtu).', { variant: 'warning' });
      return;
    }
    const scale = asset.scale ?? DEFAULT_FIAT_SCALE;
    const amountMinor = majorToMinorUnitsForScale(major, scale);
    if (amountMinor <= 0) {
      enqueueSnackbar('Částka je menší než nejmenší jednotka zvoleného aktiva.', { variant: 'warning' });
      return;
    }
    const code = asset.code.trim().toUpperCase();
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
      amount: amountMinor,
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

  const handleUpdate = async (e: SubmitEvent) => {
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
    const asset = assetsSorted.find((a) => a.id === eAssetId);
    if (!asset?.code?.trim()) {
      enqueueSnackbar('Vyber aktivum (měnu rozpočtu).', { variant: 'warning' });
      return;
    }
    const scale = asset.scale ?? DEFAULT_FIAT_SCALE;
    const amountMinor = majorToMinorUnitsForScale(major, scale);
    if (amountMinor <= 0) {
      enqueueSnackbar('Částka je menší než nejmenší jednotka zvoleného aktiva.', { variant: 'warning' });
      return;
    }
    const code = asset.code.trim().toUpperCase();
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
      amount: amountMinor,
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

  const compactFieldProps = {
    size: 'small' as const,
    helperText: ' ' as const,
    FormHelperTextProps: { sx: { m: 0, minHeight: 0, display: 'none' } },
  };

  return (
    <Stack spacing={0.5}>
      {plans.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          Zatím žádný opakující se limit.
        </Typography>
      ) : (
        <Stack spacing={0}>
          {plans.map((p) => {
            const sc = p.assetScale ?? scaleForCode(assetsSorted, p.assetCode);
            return (
              <Box
                key={p.id ?? p.name}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 0.5,
                  py: 0.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                    {p.name ?? '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35 }}>
                    max. {formatWalletAmount(p.amount, p.assetCode, sc)} ·{' '}
                    {recurringIntervalDescriptionCs(p.periodType, p.intervalValue ?? 1)}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      columnGap: 0.5,
                      rowGap: 0,
                      mt: 0.25,
                    }}
                  >
                    {(p.startDate || p.endDate) && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {[
                          p.startDate ? `Od ${formatDateDdMmYyyy(p.startDate)}` : null,
                          p.endDate ? `do ${formatDateDdMmYyyy(p.endDate)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    )}
                    {p.nextRunDate && (
                      <Typography component="span" variant="caption" color="primary">
                        {(p.startDate || p.endDate) && ' · '}
                        Další: {formatDateTimeDdMmYyyyHhMm(p.nextRunDate)}
                      </Typography>
                    )}
                  </Box>
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
            );
          })}
        </Stack>
      )}

      {editing && (
        <>
          <Divider sx={{ my: 0.25 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ display: 'block', lineHeight: 1.2 }}
          >
            Upravit opakující se limit
          </Typography>
          <Box component="form" onSubmit={handleUpdate} sx={{ mt: 0.25 }}>
            <Box sx={recurringFormRootSx}>
              <TextField
                label="Název"
                value={eName}
                onChange={(ev) => setEName(ev.target.value)}
                required
                fullWidth
                sx={{ gridColumn: { xs: 1, sm: 1 }, ...outlineDenseSx }}
                {...compactFieldProps}
              />
              <AmountTextFieldCs
                label="Max. za období"
                canonical={eAmount}
                setCanonical={setEAmount}
                required
                fullWidth
                size="small"
                helperText=" "
                FormHelperTextProps={{ sx: { m: 0, minHeight: 0, display: 'none' } }}
                sx={{ gridColumn: { xs: 1, sm: 2 }, ...outlineDenseSx }}
              />
              <Box
                sx={{
                  gridColumn: { xs: 1, sm: 1 },
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 0.5,
                  alignItems: 'flex-start',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <FormControl
                  fullWidth
                  size="small"
                  required
                  sx={{ flex: { sm: '1 1 0%' }, minWidth: { sm: 0 }, ...selectDenseSx }}
                >
                  <InputLabel id="e-rec-period">Druh období</InputLabel>
                  <Select
                    labelId="e-rec-period"
                    label="Druh období"
                    value={ePeriod}
                    onChange={(ev) => setEPeriod(ev.target.value as UpdateRecurringBudgetRequestDtoPeriodType)}
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
                  onChange={(ev) => setEInterval(ev.target.value)}
                  required
                  type="number"
                  inputProps={{ min: 1, step: 1 }}
                  sx={{ width: { xs: '100%', sm: '6.25rem' }, flexShrink: 0, ...outlineDenseSx }}
                  {...compactFieldProps}
                />
              </Box>
              <FormControl
                fullWidth
                size="small"
                required
                sx={{ gridColumn: { xs: 1, sm: 2 }, minWidth: 0, ...selectDenseSx }}
              >
                <InputLabel id="e-rec-asset">Aktivum</InputLabel>
                <Select
                  labelId="e-rec-asset"
                  label="Aktivum"
                  value={eAssetId}
                  onChange={(ev) => setEAssetId(ev.target.value as string)}
                >
                  {assetsSorted.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {assetSelectLabel(a)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={recurringFooterSx}>
                <TextField
                  label="Platnost od"
                  value={eStart}
                  onChange={(ev) => setEStart(ev.target.value)}
                  required
                  fullWidth
                  sx={outlineDenseSx}
                  {...compactFieldProps}
                />
                <TextField
                  label="Do (vol.)"
                  value={eEnd}
                  onChange={(ev) => setEEnd(ev.target.value)}
                  fullWidth
                  sx={outlineDenseSx}
                  {...compactFieldProps}
                />
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ pt: { xs: 0, sm: 0.25 } }}>
                  <Button type="submit" variant="contained" disabled={submitting} size="small">
                    Uložit
                  </Button>
                  <Button type="button" size="small" disabled={submitting} onClick={() => setEditing(null)}>
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
          <Divider sx={{ my: 0.25 }} />
          <Box component="form" onSubmit={handleCreate} sx={{ mt: 0.25 }}>
            <Box sx={recurringFormRootSx}>
              <TextField
                label="Název"
                value={cName}
                onChange={(ev) => setCName(ev.target.value)}
                required
                fullWidth
                sx={{ gridColumn: { xs: 1, sm: 1 }, ...outlineDenseSx }}
                {...compactFieldProps}
              />
              <AmountTextFieldCs
                label="Max. za období"
                canonical={cAmount}
                setCanonical={setCAmount}
                required
                fullWidth
                size="small"
                helperText=" "
                FormHelperTextProps={{ sx: { m: 0, minHeight: 0, display: 'none' } }}
                sx={{ gridColumn: { xs: 1, sm: 2 }, ...outlineDenseSx }}
              />
              <Box
                sx={{
                  gridColumn: { xs: 1, sm: 1 },
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 0.5,
                  alignItems: 'flex-start',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <FormControl
                  fullWidth
                  size="small"
                  required
                  sx={{ flex: { sm: '1 1 0%' }, minWidth: { sm: 0 }, ...selectDenseSx }}
                >
                  <InputLabel id="c-rec-period">Druh období</InputLabel>
                  <Select
                    labelId="c-rec-period"
                    label="Druh období"
                    value={cPeriod}
                    onChange={(ev) => setCPeriod(ev.target.value as CreateRecurringBudgetRequestDtoPeriodType)}
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
                  onChange={(ev) => setCInterval(ev.target.value)}
                  required
                  type="number"
                  inputProps={{ min: 1, step: 1 }}
                  sx={{ width: { xs: '100%', sm: '6.25rem' }, flexShrink: 0, ...outlineDenseSx }}
                  {...compactFieldProps}
                />
              </Box>
              <FormControl
                fullWidth
                size="small"
                required
                sx={{ gridColumn: { xs: 1, sm: 2 }, minWidth: 0, ...selectDenseSx }}
              >
                <InputLabel id="c-rec-asset">Aktivum</InputLabel>
                <Select
                  labelId="c-rec-asset"
                  label="Aktivum"
                  value={cAssetId || defaultAssetId}
                  onChange={(ev) => setCAssetId(ev.target.value as string)}
                >
                  {assetsSorted.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {assetSelectLabel(a)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={recurringFooterSx}>
                <TextField
                  label="Platnost od"
                  value={cStart}
                  onChange={(ev) => setCStart(ev.target.value)}
                  required
                  fullWidth
                  sx={outlineDenseSx}
                  {...compactFieldProps}
                />
                <TextField
                  label="Do (vol.)"
                  value={cEnd}
                  onChange={(ev) => setCEnd(ev.target.value)}
                  fullWidth
                  sx={outlineDenseSx}
                  {...compactFieldProps}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting || assetsSorted.length === 0}
                  size="small"
                  sx={{ alignSelf: 'center' }}
                >
                  Přidat opakující se limit
                </Button>
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Stack>
  );
};
