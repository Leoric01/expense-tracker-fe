import {
  accountCreate,
  accountDeactivate,
  accountFindAll,
  getAccountFindAllQueryKey,
} from '@api/account-controller/account-controller';
import {
  getInstitutionFindAllQueryKey,
  institutionCreate,
  institutionFindAll,
} from '@api/institution-controller/institution-controller';
import type {
  AccountResponseDto,
  InstitutionResponseDto,
  PagedModelAccountResponseDto,
  PagedModelInstitutionResponseDto,
} from '@api/model';
import {
  CreateAccountRequestDtoAccountType,
  CreateInstitutionRequestDtoInstitutionType,
} from '@api/model';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, type SubmitEvent, useCallback, useMemo, useState } from 'react';
import { ACCOUNT_TYPE_OPTIONS } from './walletDisplay';

const LIST_PARAMS = { page: 0, size: 500 } as const;

const INSTITUTION_TYPE_LABELS: Record<CreateInstitutionRequestDtoInstitutionType, string> = {
  [CreateInstitutionRequestDtoInstitutionType.BANK]: 'Banka',
  [CreateInstitutionRequestDtoInstitutionType.EXCHANGE]: 'Burza',
  [CreateInstitutionRequestDtoInstitutionType.BROKER]: 'Broker',
  [CreateInstitutionRequestDtoInstitutionType.PERSONAL]: 'Osobní',
  [CreateInstitutionRequestDtoInstitutionType.OTHER]: 'Jiné',
};

const ACCOUNT_TYPE_SHORT: Partial<Record<CreateAccountRequestDtoAccountType, string>> = {
  [CreateAccountRequestDtoAccountType.CASH]: 'Hotovost',
  [CreateAccountRequestDtoAccountType.BANK_ACCOUNT]: 'Účet',
  [CreateAccountRequestDtoAccountType.CREDIT_CARD]: 'Karta',
  [CreateAccountRequestDtoAccountType.SAVINGS]: 'Spoření',
  [CreateAccountRequestDtoAccountType.INVESTMENT]: 'Investice',
  [CreateAccountRequestDtoAccountType.EXCHANGE_SPOT]: 'Spot',
  [CreateAccountRequestDtoAccountType.OTHER]: 'Jiné',
};

type Props = {
  trackerId: string;
  open: boolean;
  onClose: () => void;
};

export const InstitutionAccountsManageDialog: FC<Props> = ({ trackerId, open, onClose }) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [newInstName, setNewInstName] = useState('');
  const [newInstType, setNewInstType] = useState<CreateInstitutionRequestDtoInstitutionType>(
    CreateInstitutionRequestDtoInstitutionType.PERSONAL,
  );
  const [instSubmitting, setInstSubmitting] = useState(false);

  const [expandedAddAccountInstId, setExpandedAddAccountInstId] = useState<string | null>(null);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<CreateAccountRequestDtoAccountType>(
    CreateAccountRequestDtoAccountType.CASH,
  );
  const [accSubmitting, setAccSubmitting] = useState(false);

  const { data: instPaged } = useQuery({
    queryKey: getInstitutionFindAllQueryKey(trackerId, LIST_PARAMS),
    queryFn: async () => {
      const res = await institutionFindAll(trackerId, LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('institutions');
      return res.data as PagedModelInstitutionResponseDto;
    },
    enabled: open && Boolean(trackerId),
    staleTime: 15_000,
  });

  const { data: accPaged } = useQuery({
    queryKey: getAccountFindAllQueryKey(trackerId, LIST_PARAMS),
    queryFn: async () => {
      const res = await accountFindAll(trackerId, LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('accounts');
      return res.data as PagedModelAccountResponseDto;
    },
    enabled: open && Boolean(trackerId),
    staleTime: 15_000,
  });

  const institutions = useMemo(() => {
    const rows = instPaged?.content ?? [];
    return [...rows]
      .filter((i) => i.active !== false && i.id)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'cs', { sensitivity: 'base' }));
  }, [instPaged]);

  const accountsByInstitution = useMemo(() => {
    const m = new Map<string, AccountResponseDto[]>();
    for (const a of accPaged?.content ?? []) {
      if (a.active === false || !a.id || !a.institutionId) continue;
      const list = m.get(a.institutionId) ?? [];
      list.push(a);
      m.set(a.institutionId, list);
    }
    for (const list of m.values()) {
      list.sort((x, y) => (x.name ?? '').localeCompare(y.name ?? '', 'cs', { sensitivity: 'base' }));
    }
    return m;
  }, [accPaged]);

  const invalidateStructure = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [`/api/institution/${trackerId}`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/account/${trackerId}`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/institution/${trackerId}/dashboard`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/holding/${trackerId}`] });
  }, [queryClient, trackerId]);

  const handleAddInstitution = async (e: SubmitEvent) => {
    e.preventDefault();
    const nm = newInstName.trim();
    if (!nm) {
      enqueueSnackbar('Zadej název instituce', { variant: 'warning' });
      return;
    }
    setInstSubmitting(true);
    try {
      const res = await institutionCreate(trackerId, { name: nm, institutionType: newInstType });
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Instituci se nepodařilo vytvořit'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Instituce byla přidána', { variant: 'success' });
      setNewInstName('');
      await invalidateStructure();
    } catch {
      enqueueSnackbar('Instituci se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setInstSubmitting(false);
    }
  };

  const handleAddAccount = async (e: SubmitEvent, institutionId: string) => {
    e.preventDefault();
    const nm = newAccName.trim();
    if (!nm) {
      enqueueSnackbar('Zadej název účtu', { variant: 'warning' });
      return;
    }
    setAccSubmitting(true);
    try {
      const res = await accountCreate(trackerId, {
        institutionId,
        name: nm,
        accountType: newAccType,
      });
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Účet se nepodařilo vytvořit'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Účet byl přidán', { variant: 'success' });
      setNewAccName('');
      setNewAccType(CreateAccountRequestDtoAccountType.CASH);
      setExpandedAddAccountInstId(null);
      await invalidateStructure();
    } catch {
      enqueueSnackbar('Účet se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setAccSubmitting(false);
    }
  };

  const deactivateAccount = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await accountDeactivate(trackerId, accountId);
      if (res.status < 200 || res.status >= 300) {
        throw new Error(apiErrorMessage(res.data, 'Účet se nepodařilo odebrat'));
      }
    },
    onSuccess: async () => {
      enqueueSnackbar('Účet byl odebrán', { variant: 'success' });
      await invalidateStructure();
    },
    onError: (err: Error) => enqueueSnackbar(err.message, { variant: 'error' }),
  });

  const confirmRemoveAccount = (accountId: string, accountLabel: string) => {
    if (
      !window.confirm(
        `Odebrat účet „${accountLabel}“? Držby (holdings) na tomto účtu mohou přestat být použitelné.`,
      )
    ) {
      return;
    }
    deactivateAccount.mutate(accountId);
  };

  return (
    <Dialog open={open} onClose={() => !instSubmitting && !accSubmitting && !deactivateAccount.isPending && onClose()} fullWidth maxWidth="md">
      <DialogTitle>Instituce a účty</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Jedna instituce (např. banka) může mít více účtů. Pozice (držby) se vážou vždy k jednomu účtu a jednomu
          aktivu.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Nová instituce
        </Typography>
        <Box component="form" onSubmit={handleAddInstitution}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
            <TextField
              label="Název instituce"
              value={newInstName}
              onChange={(e) => setNewInstName(e.target.value)}
              size="small"
              sx={{ flex: 1, minWidth: 160 }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="manage-inst-type">Typ</InputLabel>
              <Select
                labelId="manage-inst-type"
                label="Typ"
                value={newInstType}
                onChange={(e) => setNewInstType(e.target.value as CreateInstitutionRequestDtoInstitutionType)}
              >
                {(
                  Object.values(
                    CreateInstitutionRequestDtoInstitutionType,
                  ) as CreateInstitutionRequestDtoInstitutionType[]
                ).map((v) => (
                  <MenuItem key={v} value={v}>
                    {INSTITUTION_TYPE_LABELS[v]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button type="submit" variant="contained" size="small" disabled={instSubmitting} sx={{ flexShrink: 0 }}>
              Přidat instituci
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Přehled
        </Typography>
        {institutions.length === 0 ? (
          <Typography color="text.secondary">Zatím žádná instituce — přidej první výše.</Typography>
        ) : (
          <Stack spacing={2}>
            {institutions.map((inst) => {
              const iid = inst.id!;
              const accs = accountsByInstitution.get(iid) ?? [];
              return (
                <Box key={iid} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {inst.name ?? '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    {inst.institutionType
                      ? INSTITUTION_TYPE_LABELS[inst.institutionType as CreateInstitutionRequestDtoInstitutionType] ??
                        inst.institutionType
                      : ''}
                  </Typography>
                  {accs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Žádné účty.
                    </Typography>
                  ) : (
                    <List dense disablePadding sx={{ mb: 1 }}>
                      {accs.map((acc) => {
                        const accLabel = acc.name?.trim() || acc.id || '—';
                        const typeHint =
                          ACCOUNT_TYPE_SHORT[acc.accountType as CreateAccountRequestDtoAccountType] ??
                          acc.accountType;
                        return (
                          <ListItem
                            key={acc.id}
                            disablePadding
                            secondaryAction={
                              <Tooltip title="Odebrat účet">
                                <IconButton
                                  edge="end"
                                  size="small"
                                  aria-label={`Odebrat účet ${accLabel}`}
                                  onClick={() => confirmRemoveAccount(acc.id!, accLabel)}
                                  disabled={deactivateAccount.isPending}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            }
                            sx={{ pr: 7 }}
                          >
                            <ListItemText primary={accLabel} secondary={typeHint} />
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                  {expandedAddAccountInstId === iid ? (
                    <Box component="form" onSubmit={(ev) => handleAddAccount(ev, iid)} sx={{ mt: 1 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
                        <TextField
                          label="Název nového účtu"
                          value={newAccName}
                          onChange={(e) => setNewAccName(e.target.value)}
                          size="small"
                          sx={{ flex: 1 }}
                          autoFocus
                        />
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                          <InputLabel id={`acc-type-${iid}`}>Typ účtu</InputLabel>
                          <Select
                            labelId={`acc-type-${iid}`}
                            label="Typ účtu"
                            value={newAccType}
                            onChange={(e) =>
                              setNewAccType(e.target.value as CreateAccountRequestDtoAccountType)
                            }
                          >
                            {ACCOUNT_TYPE_OPTIONS.map((o) => (
                              <MenuItem key={o.value} value={o.value}>
                                {o.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Stack direction="row" spacing={0.5}>
                          <Button type="submit" size="small" variant="contained" disabled={accSubmitting}>
                            Uložit
                          </Button>
                          <Button
                            type="button"
                            size="small"
                            onClick={() => {
                              setExpandedAddAccountInstId(null);
                              setNewAccName('');
                            }}
                            disabled={accSubmitting}
                          >
                            Zrušit
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setExpandedAddAccountInstId(iid);
                        setNewAccName('');
                        setNewAccType(CreateAccountRequestDtoAccountType.CASH);
                      }}
                    >
                      Přidat účet
                    </Button>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={instSubmitting || accSubmitting || deactivateAccount.isPending}>
          Zavřít
        </Button>
      </DialogActions>
    </Dialog>
  );
};
