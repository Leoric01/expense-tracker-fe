import { TransactionFindAllPageableRateMode } from '@api/model';
import { MonthDateRangePicker } from '@components/MonthDateRangePicker';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { RecentTransactionsPanel } from '@pages/home/RecentTransactionsPanel';
import { dateRangeDdMmYyyyToIsoParams, firstDayOfMonth, lastDayOfMonth } from '@utils/dashboardPeriod';
import { formatDateDdMmYyyyFromDate, parseCsDateTime } from '@utils/dateTimeCs';
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

/** Samostatná stránka historie transakcí pro vybraný finance tracker. */
export const TransactionsPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const [rangeFrom, setRangeFrom] = useState(() => formatDateDdMmYyyyFromDate(firstDayOfMonth()));
  const [rangeTo, setRangeTo] = useState(() => formatDateDdMmYyyyFromDate(lastDayOfMonth()));
  const [amountRateMode, setAmountRateMode] = useState<TransactionFindAllPageableRateMode>(
    TransactionFindAllPageableRateMode.TRANSACTION_DATE,
  );

  const transactionPeriodIso = useMemo(
    () => dateRangeDdMmYyyyToIsoParams(rangeFrom, rangeTo),
    [rangeFrom, rangeTo],
  );
  const parsedFrom = useMemo(() => parseCsDateTime(rangeFrom.trim()), [rangeFrom]);
  const parsedTo = useMemo(() => parseCsDateTime(rangeTo.trim()), [rangeTo]);
  const bothDatesParsed = Boolean(parsedFrom && parsedTo);
  const rangeOrderInvalid = bothDatesParsed && parsedFrom!.getTime() > parsedTo!.getTime();
  const rangeParamsOk = Boolean(transactionPeriodIso);
  const dateRangeEnabled = rangeParamsOk && !rangeOrderInvalid;

  if (!trackerId) {
    return (
      <Box sx={{ mt: -1 }}>
        <PageHeading component="h1" sx={{ mt: -1, mb: 0.5 }}>
          Transakce
        </PageHeading>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nejprve vyber rozpočet (tracker) v menu u položky Trackery nebo v postranním panelu.
        </Typography>
        <Button component={Link} to="/trackers" variant="contained">
          Otevřít trackery
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: -1 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        useFlexGap
        sx={{ mb: 2, width: '100%' }}
      >
        <PageHeading component="h1" gutterBottom={false}>
          Transakce
        </PageHeading>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          useFlexGap
        >
          <MonthDateRangePicker
            from={rangeFrom}
            to={rangeTo}
            onChangeFrom={setRangeFrom}
            onChangeTo={setRangeTo}
            onChangeRange={({ from, to }) => {
              setRangeFrom(from);
              setRangeTo(to);
            }}
          />
          <Tooltip title="Kurz pro porovnání částek v historii: v den transakce nebo dnešní kurz.">
            <ToggleButtonGroup
              exclusive
              size="small"
              value={amountRateMode}
              onChange={(_, value: TransactionFindAllPageableRateMode | null) => {
                if (!value) return;
                setAmountRateMode(value);
              }}
              sx={{
                alignSelf: { xs: 'stretch', sm: 'center' },
                flexShrink: 0,
                '& .MuiToggleButton-root': {
                  px: 0.75,
                  py: 0.25,
                  fontSize: '0.7rem',
                  lineHeight: 1.15,
                },
              }}
            >
              <ToggleButton value={TransactionFindAllPageableRateMode.TRANSACTION_DATE}>Den</ToggleButton>
              <ToggleButton value={TransactionFindAllPageableRateMode.NOW}>Teď</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
        </Stack>
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

      <RecentTransactionsPanel
        trackerId={trackerId}
        dateFromCs={rangeFrom}
        dateToCs={rangeTo}
        dateRangeEnabled={dateRangeEnabled}
        amountRateMode={amountRateMode}
      />
    </Box>
  );
};
