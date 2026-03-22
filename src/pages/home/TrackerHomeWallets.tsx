import { transactionCreate } from '@api/transaction-controller/transaction-controller';
import { widgetItemAdd, widgetItemReplace } from '@api/widget-item-controller/widget-item-controller';
import {
  getWalletDashboardQueryKey,
  walletCreate,
  walletDashboard,
} from '@api/wallet-controller/wallet-controller';
import type { CreateWalletRequestDto, WalletDashboardResponseDto, WalletResponseDto, WalletSummaryResponseDto } from '@api/model';
import { CreateTransactionRequestDtoTransactionType } from '@api/model';
import { CreateWalletRequestDtoWalletType } from '@api/model';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Box,
  Button,
  Card,
  Chip,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ButtonBase,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageHeading } from '@components/PageHeading';
import { CategoriesForTracker } from '@pages/categories/CategoriesForTracker';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import {
  dateRangeDdMmYyyyToIsoParams,
  firstDayOfMonth,
  lastDayOfMonth,
} from '@utils/dashboardPeriod';
import { formatDateDdMmYyyyFromDate, parseCsDateTime } from '@utils/dateTimeCs';
import { majorToMinorUnits } from '@utils/moneyMinorUnits';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { DragEvent, FC, FormEvent, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RecentTransactionsPanel } from './RecentTransactionsPanel';
import { BalanceCorrectionDialog, type BalanceCorrectionConfirmPayload } from './BalanceCorrectionDialog';
import { TransferBetweenWalletsDialog, type TransferConfirmPayload } from './TransferBetweenWalletsDialog';
import { TransactionFormsPanel } from './TransactionFormsPanel';
import { formatWalletAmount, WALLET_TYPE_OPTIONS } from './walletDisplay';
import {
  globalOrderAfterTrackerReorder,
  orderedWalletIdsFromWidgetPayload,
  reorderIdsInList,
  walletsForTrackerInWidgetOrder,
} from './walletOrderUtils';

type Props = {
  trackerId: string;
  trackerName: string;
};

const WALLET_DRAG_MIME = 'application/x-wallet-id';
const WALLET_REORDER_MIME = 'application/x-wallet-reorder';

function dashboardSummaryToWallet(s: WalletSummaryResponseDto): WalletResponseDto {
  return {
    id: s.walletId,
    name: s.walletName,
    currencyCode: s.currencyCode,
    currentBalance: s.endBalance,
    active: true,
  };
}

export const TrackerHomeWallets: FC<Props> = ({ trackerId, trackerName }) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const ignoreClickUntilRef = useRef(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const mainTab = tabParam === 'categories' ? 1 : tabParam === 'history' ? 2 : 0;

  const sectionNavBtnSx = (active: boolean) => ({
    borderRadius: 1,
    px: 0.5,
    py: 0.25,
    typography: 'h6' as const,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: active ? 'primary.main' : 'text.secondary',
    textDecoration: active ? 'underline' : 'none',
    textUnderlineOffset: 6,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<CreateWalletRequestDtoWalletType>(
    CreateWalletRequestDtoWalletType.CASH,
  );
  const [currencyCode, setCurrencyCode] = useState('CZK');
  const [initialBalance, setInitialBalance] = useState('');

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHoverId, setDropHoverId] = useState<string | null>(null);
  const [reorderDraggingId, setReorderDraggingId] = useState<string | null>(null);
  const [reorderDropHoverId, setReorderDropHoverId] = useState<string | null>(null);
  const [transferPair, setTransferPair] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [correctionWallet, setCorrectionWallet] = useState<WalletResponseDto | null>(null);
  const [corrSubmitting, setCorrSubmitting] = useState(false);

  const [rangeFrom, setRangeFrom] = useState(() => formatDateDdMmYyyyFromDate(firstDayOfMonth()));
  const [rangeTo, setRangeTo] = useState(() => formatDateDdMmYyyyFromDate(lastDayOfMonth()));

  const dashboardParams = useMemo(
    () => dateRangeDdMmYyyyToIsoParams(rangeFrom, rangeTo),
    [rangeFrom, rangeTo],
  );

  const parsedFrom = useMemo(() => parseCsDateTime(rangeFrom.trim()), [rangeFrom]);
  const parsedTo = useMemo(() => parseCsDateTime(rangeTo.trim()), [rangeTo]);
  const bothDatesParsed = Boolean(parsedFrom && parsedTo);
  const rangeOrderInvalid =
    bothDatesParsed && parsedFrom!.getTime() > parsedTo!.getTime();
  const rangeParamsOk = Boolean(dashboardParams);

  const {
    data: dashboardRes,
    isLoading,
    isError,
    isFetched: dashboardFetched,
  } = useQuery({
    queryKey: dashboardParams
      ? getWalletDashboardQueryKey(trackerId, dashboardParams)
      : ['wallet-dashboard', trackerId, 'invalid-range', rangeFrom, rangeTo],
    queryFn: async () => {
      if (!dashboardParams) throw new Error('dashboard');
      const res = await walletDashboard(trackerId, dashboardParams);
      if (res.status < 200 || res.status >= 300) {
        throw new Error('dashboard');
      }
      return res.data as WalletDashboardResponseDto;
    },
    enabled: Boolean(trackerId) && rangeParamsOk,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const dashboard = dashboardRes;
  const summaries = dashboard?.wallets ?? [];
  const items = useMemo(() => summaries.map(dashboardSummaryToWallet), [summaries]);

  const summaryById = useMemo(() => {
    const m = new Map<string, WalletSummaryResponseDto>();
    for (const s of summaries) {
      if (s.walletId) m.set(s.walletId, s);
    }
    return m;
  }, [summaries]);

  const globalWalletOrder = useMemo(
    () => orderedWalletIdsFromWidgetPayload(dashboard?.widgetOrder),
    [dashboard?.widgetOrder],
  );

  const orderedItems = useMemo(
    () => walletsForTrackerInWidgetOrder(globalWalletOrder, items),
    [globalWalletOrder, items],
  );

  const replaceWidgetOrder = useMutation({
    mutationFn: async (nextGlobal: string[]) => {
      const res = await widgetItemReplace('WALLET', nextGlobal);
      if (res.status < 200 || res.status >= 300) {
        throw new Error('Nepodařilo se uložit pořadí');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/${trackerId}/dashboard`] });
    },
  });

  const invalidateFinance = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/transaction', trackerId] });
    await queryClient.invalidateQueries({ queryKey: ['/api/wallet', trackerId] });
    await queryClient.invalidateQueries({ queryKey: [`/api/wallet/${trackerId}/dashboard`] });
  }, [queryClient, trackerId]);

  const resetForm = () => {
    setName('');
    setWalletType(CreateWalletRequestDtoWalletType.CASH);
    setCurrencyCode('CZK');
    setInitialBalance('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const code = currencyCode.trim().toUpperCase();
    if (!trimmedName || !code) {
      enqueueSnackbar('Vyplň název a měnu', { variant: 'warning' });
      return;
    }

    const payload: CreateWalletRequestDto = {
      name: trimmedName,
      walletType,
      currencyCode: code,
    };
    const bal = initialBalance.trim();
    if (bal !== '') {
      const n = parseFloat(bal.replace(',', '.'));
      if (!Number.isNaN(n)) payload.initialBalance = majorToMinorUnits(n);
    }

    setSubmitting(true);
    try {
      const res = await walletCreate(trackerId, payload);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Peněženku se nepodařilo vytvořit',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Peněženka byla vytvořena', { variant: 'success' });
      setCreateOpen(false);
      resetForm();
      const created = res.data as unknown as WalletResponseDto | undefined;
      if (created?.id) {
        try {
          const addRes = await widgetItemAdd('WALLET', created.id);
          if (addRes.status >= 200 && addRes.status < 300) {
            await queryClient.invalidateQueries({ queryKey: [`/api/wallet/${trackerId}/dashboard`] });
          }
        } catch {
          /* widget seznam je volitelný */
        }
      }
      await queryClient.invalidateQueries({ queryKey: [`/api/wallet/${trackerId}/dashboard`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/wallet', trackerId] });
    } catch {
      enqueueSnackbar('Peněženku se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const sourceWallet = transferPair ? orderedItems.find((x) => x.id === transferPair.sourceId) : undefined;
  const targetWallet = transferPair ? orderedItems.find((x) => x.id === transferPair.targetId) : undefined;
  const transferCurrenciesOk = (() => {
    if (!sourceWallet || !targetWallet) return false;
    const a = sourceWallet.currencyCode?.trim().toUpperCase() ?? '';
    const b = targetWallet.currencyCode?.trim().toUpperCase() ?? '';
    if (!a || !b) return true;
    return a === b;
  })();

  const handleTransferConfirm = useCallback(
    async (payload: TransferConfirmPayload) => {
      if (!transferPair || !transferCurrenciesOk) return;
      setTransferSubmitting(true);
      try {
        const res = await transactionCreate(trackerId, {
          transactionType: CreateTransactionRequestDtoTransactionType.TRANSFER,
          sourceWalletId: transferPair.sourceId,
          targetWalletId: transferPair.targetId,
          amount: majorToMinorUnits(payload.amountMajor),
          transactionDate: payload.transactionDateIso,
          ...(payload.description ? { description: payload.description } : {}),
        });
        if (res.status < 200 || res.status >= 300) {
          enqueueSnackbar(apiErrorMessage(res.data, 'Převod se nepodařil'), { variant: 'error' });
          return;
        }
        enqueueSnackbar('Převod byl zaznamenán', { variant: 'success' });
        setTransferPair(null);
        await invalidateFinance();
      } catch {
        enqueueSnackbar('Převod se nepodařil', { variant: 'error' });
      } finally {
        setTransferSubmitting(false);
      }
    },
    [transferPair, transferCurrenciesOk, trackerId, enqueueSnackbar, invalidateFinance],
  );

  const handleCorrectionConfirm = useCallback(
    async (payload: BalanceCorrectionConfirmPayload) => {
      if (!correctionWallet?.id) return;
      setCorrSubmitting(true);
      try {
        const res = await transactionCreate(trackerId, {
          transactionType: CreateTransactionRequestDtoTransactionType.BALANCE_ADJUSTMENT,
          walletId: correctionWallet.id,
          correctedBalance: majorToMinorUnits(payload.correctedBalanceMajor),
          transactionDate: payload.transactionDateIso,
          ...(payload.note ? { note: payload.note } : {}),
        });
        if (res.status < 200 || res.status >= 300) {
          enqueueSnackbar(apiErrorMessage(res.data, 'Korekci se nepodařilo uložit'), { variant: 'error' });
          return;
        }
        enqueueSnackbar('Korekce byla zaznamenána', { variant: 'success' });
        setCorrectionWallet(null);
        await invalidateFinance();
      } catch {
        enqueueSnackbar('Korekci se nepodařilo uložit', { variant: 'error' });
      } finally {
        setCorrSubmitting(false);
      }
    },
    [correctionWallet?.id, trackerId, enqueueSnackbar, invalidateFinance],
  );

  const clearDragVisual = () => {
    setDraggingId(null);
    setDropHoverId(null);
    setReorderDraggingId(null);
    setReorderDropHoverId(null);
  };

  const handleReorderDragStart = (e: DragEvent, walletId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData(WALLET_REORDER_MIME, walletId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(null);
    setDropHoverId(null);
    setReorderDraggingId(walletId);
  };

  const handleDragStart = (e: DragEvent, walletId: string) => {
    setReorderDraggingId(null);
    setReorderDropHoverId(null);
    e.dataTransfer.setData(WALLET_DRAG_MIME, walletId);
    e.dataTransfer.setData('text/plain', walletId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(walletId);
  };

  const handleDragEnd = () => {
    clearDragVisual();
  };

  const handleDragOver = (e: DragEvent, walletId: string, canReceiveTransfer: boolean) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.includes(WALLET_REORDER_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (walletId !== reorderDraggingId) setReorderDropHoverId(walletId);
      setDropHoverId(null);
      return;
    }
    if (
      canReceiveTransfer &&
      (types.includes(WALLET_DRAG_MIME) || types.includes('text/plain'))
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (walletId !== draggingId) setDropHoverId(walletId);
      setReorderDropHoverId(null);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDropHoverId(null);
    setReorderDropHoverId(null);
  };

  const handleDrop = (e: DragEvent, target: WalletResponseDto) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreClickUntilRef.current = Date.now() + 500;
    const reorderSource = e.dataTransfer.getData(WALLET_REORDER_MIME);
    if (reorderSource && target.id) {
      clearDragVisual();
      if (replaceWidgetOrder.isPending) return;
      const trackerIds = new Set(
        orderedItems.map((w) => w.id).filter(Boolean) as string[],
      );
      const currentTrackerOrder = orderedItems.map((w) => w.id!).filter(Boolean);
      const newLocalOrder = reorderIdsInList(currentTrackerOrder, reorderSource, target.id);
      const nextGlobal = globalOrderAfterTrackerReorder(globalWalletOrder, trackerIds, newLocalOrder);
      replaceWidgetOrder.mutate(nextGlobal, {
        onError: () =>
          enqueueSnackbar('Pořadí se nepodařilo uložit', { variant: 'error' }),
      });
      return;
    }
    setReorderDraggingId(null);
    setReorderDropHoverId(null);
    setDraggingId(null);
    setDropHoverId(null);
    if (target.active === false) return;
    const sourceId = e.dataTransfer.getData(WALLET_DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!sourceId || !target.id || sourceId === target.id) return;
    startTransition(() => setTransferPair({ sourceId, targetId: target.id }));
  };

  const handleCardClick = (w: WalletResponseDto) => {
    if (Date.now() < ignoreClickUntilRef.current) return;
    if (!w.id) return;
    setCorrectionWallet(w);
  };

  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        {trackerName}
      </PageHeading>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 1, mt: 2 }}>
        <PageHeading component="h2">Moje peněženky</PageHeading>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
        >
          Přidat peněženku
        </Button>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        useFlexGap
        sx={{ mb: 2, flexWrap: 'wrap' }}
      >
        <TextField
          label="Od"
          value={rangeFrom}
          onChange={(e) => setRangeFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          label="Do"
          value={rangeTo}
          onChange={(e) => setRangeTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setRangeFrom(formatDateDdMmYyyyFromDate(firstDayOfMonth()));
            setRangeTo(formatDateDdMmYyyyFromDate(lastDayOfMonth()));
          }}
          sx={{ alignSelf: { xs: 'stretch', sm: 'auto' }, width: { xs: '100%', sm: 'auto' } }}
        >
          Aktuální měsíc
        </Button>
      </Stack>
      {rangeOrderInvalid && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          Datum „od“ musí být před nebo stejné jako „do“.
        </Typography>
      )}
      {!rangeParamsOk && !rangeOrderInvalid && (rangeFrom.trim() || rangeTo.trim()) && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          Zadej obě platná data.
        </Typography>
      )}
      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst peněženky.
        </Typography>
      )}

      {isLoading && rangeParamsOk ? (
        <Typography color="text.secondary">Načítám peněženky…</Typography>
      ) : items.length === 0 ? (
        rangeParamsOk ? (
          <Typography color="text.secondary">Zatím žádná peněženka — přidej první.</Typography>
        ) : null
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {orderedItems.map((w) => {
            const wid = w.id ?? '';
            const sm = wid ? summaryById.get(wid) : undefined;
            const canDragTransfer = Boolean(w.id) && w.active !== false;
            const canReorderGrip = Boolean(w.id) && !replaceWidgetOrder.isPending;
            const isDragging = reorderDraggingId === w.id || draggingId === w.id;
            const isDropHover =
              (reorderDropHoverId === wid &&
                Boolean(reorderDraggingId) &&
                reorderDraggingId !== wid) ||
              (dropHoverId === wid && Boolean(draggingId) && draggingId !== wid);

            return (
              <Card
                key={w.id ?? w.name}
                onDragOver={wid ? (e) => handleDragOver(e, wid, w.active !== false) : undefined}
                onDragLeave={wid ? handleDragLeave : undefined}
                onDrop={wid ? (e) => handleDrop(e, w) : undefined}
                onClick={(ev) => {
                  if ((ev.target as HTMLElement).closest('[data-wallet-reorder-grip]')) return;
                  handleCardClick(w);
                }}
                variant="outlined"
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  opacity: isDragging ? 0.55 : 1,
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                  outline: isDropHover ? (t) => `2px solid ${t.palette.primary.main}` : 'none',
                  outlineOffset: 2,
                }}
              >
                <Stack direction="row" alignItems="stretch">
                  <Tooltip title="Změnit pořadí (uloží se na server)">
                    <Box
                      data-wallet-reorder-grip
                      component="span"
                      onClick={(e) => e.stopPropagation()}
                      draggable={canReorderGrip}
                      onDragStart={w.id ? (e) => handleReorderDragStart(e, w.id!) : undefined}
                      onDragEnd={handleDragEnd}
                      sx={{
                        cursor: canReorderGrip ? 'grab' : 'default',
                        display: 'flex',
                        alignItems: 'flex-start',
                        pt: 2,
                        pl: 1,
                        pr: 0.5,
                        flexShrink: 0,
                      }}
                      aria-label="Změnit pořadí peněženky"
                    >
                      <DragIndicatorIcon fontSize="small" color="action" />
                    </Box>
                  </Tooltip>
                  <CardContent
                    component="div"
                    draggable={canDragTransfer}
                    onDragStart={canDragTransfer ? (e) => handleDragStart(e, w.id!) : undefined}
                    onDragEnd={handleDragEnd}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      pb: '16px !important',
                      '&:last-child': { pb: '16px !important' },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 1.5,
                      }}
                    >
                      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="flex-start" spacing={1}>
                          <Typography variant="h6" component="h3" sx={{ lineHeight: 1.3 }}>
                            {w.name ?? '—'}
                          </Typography>
                          {w.active === false && <Chip size="small" label="Neaktivní" variant="outlined" />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 1.35 }}>
                          Zůstatek
                        </Typography>
                        <Typography variant="h6" component="p" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                          {formatWalletAmount(w.currentBalance, w.currencyCode)}
                        </Typography>
                      </Stack>
                      {sm && (
                        <Stack
                          alignItems="flex-end"
                          spacing={0.25}
                          sx={{ flexShrink: 0, textAlign: 'right', minWidth: 'min-content' }}
                        >
                          <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 1.35 }}>
                            Zůstatek na začátku {formatWalletAmount(sm.startBalance, w.currencyCode)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 1.35 }}>
                            Příjem {formatWalletAmount(sm.totalIncome, w.currencyCode)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 1.35 }}>
                            Výdaj {formatWalletAmount(sm.totalExpense, w.currencyCode)}
                          </Typography>
                          <Divider sx={{ alignSelf: 'stretch', width: '100%', my: 0.5 }} />
                          <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 1.35 }}>
                            Čistá změna {formatWalletAmount(sm.difference, w.currencyCode)}
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                  </CardContent>
                </Stack>
              </Card>
            );
          })}
        </Box>
      )}

      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 4, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}
        component="nav"
        aria-label="Přepnout sekci"
      >
        <ButtonBase disableRipple onClick={() => setSearchParams({})} sx={sectionNavBtnSx(mainTab === 0)}>
          Transakce
        </ButtonBase>
        <ButtonBase
          disableRipple
          onClick={() => setSearchParams({ tab: 'categories' })}
          sx={sectionNavBtnSx(mainTab === 1)}
        >
          Kategorie
        </ButtonBase>
        <ButtonBase
          disableRipple
          onClick={() => setSearchParams({ tab: 'history' })}
          sx={sectionNavBtnSx(mainTab === 2)}
        >
          Historie
        </ButtonBase>
      </Stack>

      {mainTab === 0 && (
        <TransactionFormsPanel
          embedded
          hideTitle
          trackerId={trackerId}
          trackerName={trackerName}
          walletsFromParent={orderedItems}
          categoriesQueryEnabled={dashboardFetched}
        />
      )}

      {mainTab === 1 && (
        <CategoriesForTracker
          embedded
          trackerId={trackerId}
          trackerName={trackerName}
          categoriesQueryEnabled={dashboardFetched}
        />
      )}

      {mainTab === 2 && <RecentTransactionsPanel trackerId={trackerId} />}

      <TransferBetweenWalletsDialog
        open={Boolean(transferPair)}
        sourceWallet={sourceWallet}
        targetWallet={targetWallet}
        transferCurrenciesOk={transferCurrenciesOk}
        submitting={transferSubmitting}
        onClose={() => !transferSubmitting && setTransferPair(null)}
        onConfirm={handleTransferConfirm}
        onInvalidAmount={() => enqueueSnackbar('Zadej kladnou částku', { variant: 'warning' })}
        onInvalidDate={() =>
          enqueueSnackbar('Neplatné datum a čas — použij formát dd.MM.yyyy HH:mm', {
            variant: 'warning',
          })
        }
      />

      <BalanceCorrectionDialog
        open={Boolean(correctionWallet)}
        wallet={correctionWallet}
        submitting={corrSubmitting}
        onClose={() => !corrSubmitting && setCorrectionWallet(null)}
        onConfirm={handleCorrectionConfirm}
        onInvalidAmount={() =>
          enqueueSnackbar('Zadej skutečný zůstatek po inventuře', { variant: 'warning' })
        }
        onInvalidDate={() =>
          enqueueSnackbar('Neplatné datum a čas — použij formát dd.MM.yyyy HH:mm', {
            variant: 'warning',
          })
        }
      />

      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nová peněženka</DialogTitle>
        <Box component="form" onSubmit={handleCreate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                autoFocus
              />
              <FormControl fullWidth required>
                <InputLabel id="wallet-type-label">Typ</InputLabel>
                <Select
                  labelId="wallet-type-label"
                  label="Typ"
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value as CreateWalletRequestDtoWalletType)}
                >
                  {WALLET_TYPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Měna (ISO)"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                required
                fullWidth
                inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
              />
              <TextField
                label="Počáteční zůstatek (volitelné)"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                fullWidth
                type="text"
                inputMode="decimal"
              />
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
    </Box>
  );
};
