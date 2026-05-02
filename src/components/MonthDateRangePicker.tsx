import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Button, IconButton, Stack, TextField, Tooltip } from '@mui/material';
import {
  calendarMonthRangeByMonthDelta,
  firstDayOfMonth,
  lastDayOfMonth,
} from '@utils/dashboardPeriod';
import { formatDateDdMmYyyyFromDate, parseCsDateTime } from '@utils/dateTimeCs';
import { FC, useCallback } from 'react';

type MonthDateRangePickerProps = {
  from: string;
  to: string;
  onChangeFrom: (value: string) => void;
  onChangeTo: (value: string) => void;
  onChangeRange: (next: { from: string; to: string }) => void;
  currentMonthLabel?: string;
};

/** Sdílený výběr období `Od/Do` s přepínáním po měsících. */
export const MonthDateRangePicker: FC<MonthDateRangePickerProps> = ({
  from,
  to,
  onChangeFrom,
  onChangeTo,
  onChangeRange,
  currentMonthLabel = 'Aktuální měsíc',
}) => {
  const shiftMonthBy = useCallback(
    (deltaMonths: -1 | 1) => {
      const parsed = parseCsDateTime(from.trim());
      const anchor =
        parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
      const { from: nextFromDate, to: nextToDate } = calendarMonthRangeByMonthDelta(anchor, deltaMonths);
      onChangeRange({
        from: formatDateDdMmYyyyFromDate(nextFromDate),
        to: formatDateDdMmYyyyFromDate(nextToDate),
      });
    },
    [from, onChangeRange],
  );

  const resetToCurrentMonth = useCallback(() => {
    onChangeRange({
      from: formatDateDdMmYyyyFromDate(firstDayOfMonth()),
      to: formatDateDdMmYyyyFromDate(lastDayOfMonth()),
    });
  }, [onChangeRange]);

  const navIconSx = { p: 0.35, alignSelf: 'center' };

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      alignItems="center"
      useFlexGap
      sx={{ minWidth: 0, columnGap: 1, rowGap: 0.75 }}
    >
      <Stack
        direction="row"
        alignItems="center"
        useFlexGap
        spacing={0.25}
        sx={{ flexWrap: 'nowrap', minWidth: 0 }}
      >
        <Tooltip title="Předchozí měsíc">
          <IconButton size="small" onClick={() => shiftMonthBy(-1)} aria-label="Předchozí měsíc" sx={navIconSx}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <TextField
          label="Od"
          value={from}
          onChange={(e) => onChangeFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ width: { xs: 132, sm: 118 } }}
        />
        <TextField
          label="Do"
          value={to}
          onChange={(e) => onChangeTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ width: { xs: 132, sm: 118 } }}
        />
        <Tooltip title="Další měsíc">
          <IconButton size="small" onClick={() => shiftMonthBy(1)} aria-label="Další měsíc" sx={navIconSx}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Button
        variant="outlined"
        size="small"
        onClick={resetToCurrentMonth}
        sx={{
          alignSelf: { xs: 'stretch', sm: 'center' },
          width: { xs: '100%', sm: 'auto' },
          flexShrink: 0,
          py: 0.5,
        }}
      >
        {currentMonthLabel}
      </Button>
    </Stack>
  );
};
