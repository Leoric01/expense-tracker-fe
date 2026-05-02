import { PageHeading } from '@components/PageHeading';
import { MonthDateRangePicker } from '@components/MonthDateRangePicker';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { dateRangeDdMmYyyyToIsoParams, firstDayOfMonth, lastDayOfMonth } from '@utils/dashboardPeriod';
import { formatDateDdMmYyyyFromDate, parseCsDateTime } from '@utils/dateTimeCs';
import { Box, Button, Typography } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CategoriesForTracker } from './CategoriesForTracker';

/** Samostatná stránka kategorií pro vybraný finance tracker. */
export const CategoriesPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const [rangeFrom, setRangeFrom] = useState(() => formatDateDdMmYyyyFromDate(firstDayOfMonth()));
  const [rangeTo, setRangeTo] = useState(() => formatDateDdMmYyyyFromDate(lastDayOfMonth()));

  const categoryActivePeriodIso = useMemo(
    () => dateRangeDdMmYyyyToIsoParams(rangeFrom, rangeTo),
    [rangeFrom, rangeTo],
  );
  const parsedFrom = useMemo(() => parseCsDateTime(rangeFrom.trim()), [rangeFrom]);
  const parsedTo = useMemo(() => parseCsDateTime(rangeTo.trim()), [rangeTo]);
  const bothDatesParsed = Boolean(parsedFrom && parsedTo);
  const rangeOrderInvalid = bothDatesParsed && parsedFrom!.getTime() > parsedTo!.getTime();
  const rangeParamsOk = Boolean(categoryActivePeriodIso);

  if (!trackerId) {
    return (
      <Box sx={{ mt: -1 }}>
        <PageHeading component="h1" sx={{ mt: -1, mb: 0.5 }}>
          Kategorie
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
      <CategoriesForTracker
        trackerId={trackerId}
        trackerName={selectedExpenseTracker.name}
        categoryActivePeriodIso={rangeParamsOk && !rangeOrderInvalid ? categoryActivePeriodIso : null}
        categoriesQueryEnabled={rangeParamsOk && !rangeOrderInvalid}
        embedded
        topSummaryLeft={
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
        }
      />
    </Box>
  );
};
