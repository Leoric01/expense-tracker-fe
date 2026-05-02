import { assetFindAll, getAssetFindAllQueryKey } from '@api/asset-controller/asset-controller';
import {
  expenseTrackerUpdate,
} from '@api/expense-tracker-controller/expense-tracker-controller';
import {
  getInstitutionDashboardQueryKey,
  getInstitutionHeaderBalancesQueryKey,
  institutionHeaderBalances,
} from '@api/institution-controller/institution-controller';
import type { FinanceHeaderBalancesResponse, PagedModelAssetResponseDto } from '@api/model';
import { DisplayCurrencySelect } from '@components/DisplayCurrencySelect';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { dateRangeDdMmYyyyToIsoParams, firstDayOfMonth, lastDayOfMonth } from '@utils/dashboardPeriod';
import { formatDateDdMmYyyyFromDate } from '@utils/dateTimeCs';
import { formatAmount } from '@utils/formatAmount';
import { DEFAULT_FIAT_SCALE } from '@utils/moneyMinorUnits';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FC, useEffect, useMemo, useState } from 'react';
import { formatWalletAmount } from '@pages/home/walletDisplay';
import {
  BALANCE_AMOUNTS_VISIBILITY_EVENT,
  readShowBalanceAmountsFromStorage,
  showBalanceAmountsStorageKey,
} from '@utils/balanceAmountsVisibility';

const ASSET_LIST_PARAMS = { page: 0, size: 500 } as const;

export const HeaderFinanceSummary: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id ?? '';
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [selectedDisplayAssetId, setSelectedDisplayAssetId] = useState('');
  const [selectedDisplayAssetCode, setSelectedDisplayAssetCode] = useState('');
  const [showBalanceAmounts, setShowBalanceAmounts] = useState(true);

  const dashboardParams = useMemo(
    () =>
      dateRangeDdMmYyyyToIsoParams(
        formatDateDdMmYyyyFromDate(firstDayOfMonth()),
        formatDateDdMmYyyyFromDate(lastDayOfMonth()),
      ),
    [],
  );

  const { data: headerBalancesRes } = useQuery({
    queryKey: getInstitutionHeaderBalancesQueryKey(trackerId, dashboardParams ?? undefined),
    queryFn: async () => {
      if (!dashboardParams) throw new Error('header-balances');
      const res = await institutionHeaderBalances(trackerId, dashboardParams);
      if (res.status < 200 || res.status >= 300) throw new Error('header-balances');
      return res.data as FinanceHeaderBalancesResponse;
    },
    enabled: Boolean(trackerId && dashboardParams),
    staleTime: 30_000,
  });

  const { data: displayAssetsPaged } = useQuery({
    queryKey: getAssetFindAllQueryKey(ASSET_LIST_PARAMS),
    queryFn: async () => {
      const res = await assetFindAll(ASSET_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('display-assets');
      return res.data as PagedModelAssetResponseDto;
    },
    enabled: Boolean(trackerId),
    staleTime: 60_000,
  });

  const displayAssets = useMemo(() => displayAssetsPaged?.content ?? [], [displayAssetsPaged]);
  const displayAssetCode = headerBalancesRes?.displayAssetCode?.trim().toUpperCase() ?? '';
  const displayAssetScale = headerBalancesRes?.displayAssetScale ?? DEFAULT_FIAT_SCALE;
  const hasExplicitSelection = Boolean(selectedDisplayAssetId);
  const dashboardMatchesExplicitSelection =
    !selectedDisplayAssetCode ||
    !displayAssetCode ||
    selectedDisplayAssetCode === displayAssetCode;
  const hasDisplayCurrency = Boolean(
    hasExplicitSelection &&
      displayAssetCode &&
      headerBalancesRes?.displayAssetScale != null &&
      dashboardMatchesExplicitSelection,
  );

  useEffect(() => {
    if (!trackerId) {
      setShowBalanceAmounts(true);
      setSelectedDisplayAssetId('');
      setSelectedDisplayAssetCode('');
      return;
    }
    setShowBalanceAmounts(readShowBalanceAmountsFromStorage(trackerId));
    const key = `tracker-${trackerId}-display-currency-selection`;
    const persisted = localStorage.getItem(key) ?? '';
    const persistedCode = localStorage.getItem(`tracker-${trackerId}-display-currency-selection-code`) ?? '';
    setSelectedDisplayAssetId(persisted);
    setSelectedDisplayAssetCode(persistedCode);
    window.dispatchEvent(
      new CustomEvent('display-currency-selection-changed', {
        detail: { trackerId, assetId: persisted, assetCode: persistedCode },
      }),
    );
  }, [trackerId]);

  useEffect(() => {
    const onVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ trackerId?: string; visible?: boolean }>).detail;
      if (!detail || detail.trackerId !== trackerId) return;
      if (typeof detail.visible === 'boolean') {
        setShowBalanceAmounts(detail.visible);
      }
    };
    window.addEventListener(BALANCE_AMOUNTS_VISIBILITY_EVENT, onVisibility);
    return () => window.removeEventListener(BALANCE_AMOUNTS_VISIBILITY_EVENT, onVisibility);
  }, [trackerId]);

  useEffect(() => {
    if (!trackerId || !selectedDisplayAssetId || displayAssets.length === 0) return;
    const exists = displayAssets.some((a) => a.id === selectedDisplayAssetId);
    if (exists) return;
    localStorage.removeItem(`tracker-${trackerId}-display-currency-selection`);
    localStorage.removeItem(`tracker-${trackerId}-display-currency-selection-code`);
    setSelectedDisplayAssetId('');
    setSelectedDisplayAssetCode('');
    window.dispatchEvent(
      new CustomEvent('display-currency-selection-changed', {
        detail: { trackerId, assetId: '', assetCode: '' },
      }),
    );
  }, [displayAssets, selectedDisplayAssetId, trackerId]);

  const totalFundsText = useMemo(() => {
    if (!headerBalancesRes) return '—';
    if (hasDisplayCurrency) {
      if (headerBalancesRes.grandTotalConverted == null) return '—';
      return formatAmount(headerBalancesRes.grandTotalConverted, displayAssetScale, displayAssetCode);
    }
    const rows = headerBalancesRes.nativeBalances ?? [];
    if (rows.length === 0) return '—';
    const parts = [...rows]
      .map((r) => ({
        code: (r.assetCode?.trim() || 'CZK').toUpperCase(),
        scale: r.assetScale ?? DEFAULT_FIAT_SCALE,
        sum: r.totalMinorUnits ?? 0,
      }))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(({ sum, code, scale }) => formatWalletAmount(sum, code, scale));
    return parts.length > 0 ? parts.join(', ') : '—';
  }, [headerBalancesRes, displayAssetCode, displayAssetScale, hasDisplayCurrency]);

  const syncDisplayCurrency = async (nextAssetId: string) => {
    if (!trackerId) return;
    setSubmitting(true);
    try {
      const res = await expenseTrackerUpdate(trackerId, {
        preferredDisplayAssetId: nextAssetId ? nextAssetId : null,
      } as Parameters<typeof expenseTrackerUpdate>[1]);
      if (res.status < 200 || res.status >= 300) return;
      await queryClient.invalidateQueries({
        queryKey: getInstitutionDashboardQueryKey(trackerId),
      });
      await queryClient.invalidateQueries({
        queryKey: getInstitutionHeaderBalancesQueryKey(trackerId),
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/expense-trackers/mine'] });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisplayCurrencyChange = async (nextAssetId: string) => {
    if (!trackerId || nextAssetId === selectedDisplayAssetId) return;
    const key = `tracker-${trackerId}-display-currency-selection`;
    const codeKey = `tracker-${trackerId}-display-currency-selection-code`;
    const nextCode =
      displayAssets.find((asset) => asset.id === nextAssetId)?.code?.trim().toUpperCase() ?? '';
    if (nextAssetId) localStorage.setItem(key, nextAssetId);
    else localStorage.removeItem(key);
    if (nextCode) localStorage.setItem(codeKey, nextCode);
    else localStorage.removeItem(codeKey);
    setSelectedDisplayAssetId(nextAssetId);
    setSelectedDisplayAssetCode(nextCode);
    window.dispatchEvent(
      new CustomEvent('display-currency-selection-changed', {
        detail: { trackerId, assetId: nextAssetId, assetCode: nextCode },
      }),
    );
    await syncDisplayCurrency(nextAssetId);
  };

  const setBalanceAmountsVisible = (visible: boolean) => {
    if (!trackerId) return;
    localStorage.setItem(showBalanceAmountsStorageKey(trackerId), visible ? 'true' : 'false');
    setShowBalanceAmounts(visible);
    window.dispatchEvent(
      new CustomEvent(BALANCE_AMOUNTS_VISIBILITY_EVENT, {
        detail: { trackerId, visible },
      }),
    );
  };

  if (!trackerId) return null;

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
      <DisplayCurrencySelect
        value={selectedDisplayAssetId}
        assets={displayAssets}
        disabled={submitting}
        onChange={(assetId) => {
          void handleDisplayCurrencyChange(assetId);
        }}
        sx={{ minWidth: { xs: '100%', sm: 220 }, bgcolor: 'background.paper', borderRadius: 1 }}
      />
      <Stack direction="row" alignItems="center" spacing={0.25} flexWrap="wrap" sx={{ minWidth: 0 }}>
        <Typography variant="body2" component="p" sx={{ m: 0 }}>
          <Box component="span" sx={{ color: 'text.secondary', mr: 0.5 }}>
            Celkové prostředky:
          </Box>
          <Box
            component="span"
            sx={{
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: 'text.primary',
              ...(!showBalanceAmounts
                ? { filter: 'blur(7px)', userSelect: 'none', WebkitUserSelect: 'none' }
                : {}),
            }}
          >
            {totalFundsText}
          </Box>
        </Typography>
        <Tooltip title={showBalanceAmounts ? 'Skrýt částky' : 'Zobrazit částky'}>
          <IconButton
            size="small"
            aria-label={showBalanceAmounts ? 'Skrýt částky' : 'Zobrazit částky'}
            onClick={() => setBalanceAmountsVisible(!showBalanceAmounts)}
            sx={{ color: 'text.secondary' }}
          >
            {showBalanceAmounts ? (
              <VisibilityOutlinedIcon fontSize="small" />
            ) : (
              <VisibilityOffOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
};
