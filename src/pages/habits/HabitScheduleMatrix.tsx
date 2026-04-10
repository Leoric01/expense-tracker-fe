import { HabitScheduleSlotRequestDtoDayBlock } from '@api/model/habitScheduleSlotRequestDtoDayBlock';
import {
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, useState } from 'react';
import {
  HABIT_BLOCK_HEADER_SHORT,
  HABIT_BLOCK_LABELS,
  HABIT_DAY_BLOCKS_ORDER,
  HABIT_DAY_ROW_LABELS,
  HABIT_DAYS_ORDER,
  habitScheduleKey,
} from './habitUiConstants';

const HABIT_WORKDAYS = HABIT_DAYS_ORDER.slice(0, 5);
const HABIT_WEEKEND_DAYS = HABIT_DAYS_ORDER.slice(5, 7);

type HabitScheduleMatrixProps = {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  readOnly?: boolean;
  disabled?: boolean;
};

export const HabitScheduleMatrix: FC<HabitScheduleMatrixProps> = ({
  selected,
  onChange,
  readOnly = false,
  disabled = false,
}) => {
  const [quickBlock, setQuickBlock] = useState<(typeof HABIT_DAY_BLOCKS_ORDER)[number]>(
    HabitScheduleSlotRequestDtoDayBlock.RANO,
  );

  const toggle = (key: string) => {
    if (readOnly || disabled) {
      return;
    }
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };

  const mergeDaysForBlock = (days: (typeof HABIT_DAYS_ORDER)[number][]) => {
    if (readOnly || disabled) {
      return;
    }
    const keys = days.map((day) => habitScheduleKey(day, quickBlock));
    const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
    const next = new Set(selected);
    if (allSelected) {
      for (const k of keys) {
        next.delete(k);
      }
    } else {
      for (const k of keys) {
        next.add(k);
      }
    }
    onChange(next);
  };

  const onQuickBlockChange = (e: SelectChangeEvent<string>) => {
    setQuickBlock(e.target.value as (typeof HABIT_DAY_BLOCKS_ORDER)[number]);
  };

  return (
    <Stack spacing={2}>
      {!readOnly && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          flexWrap="wrap"
          useFlexGap
        >
          <FormControl size="small" sx={{ minWidth: 200 }} disabled={disabled}>
            <InputLabel id="habit-quick-block-label">Blok pro rychlý výběr</InputLabel>
            <Select
              labelId="habit-quick-block-label"
              label="Blok pro rychlý výběr"
              value={quickBlock}
              onChange={onQuickBlockChange}
            >
              {HABIT_DAY_BLOCKS_ORDER.map((block) => (
                <MenuItem key={block} value={block}>
                  {HABIT_BLOCK_LABELS[block]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              disabled={disabled}
              onClick={() => mergeDaysForBlock([...HABIT_DAYS_ORDER])}
            >
              Každý den
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={disabled}
              onClick={() => mergeDaysForBlock([...HABIT_WORKDAYS])}
            >
              Pracovní dny
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={disabled}
              onClick={() => mergeDaysForBlock([...HABIT_WEEKEND_DAYS])}
            >
              Víkendy
            </Button>
          </Stack>
        </Stack>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 520 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 108, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Den
                </Typography>
              </TableCell>
              {HABIT_DAY_BLOCKS_ORDER.map((block) => (
                <TableCell
                  key={block}
                  align="center"
                  sx={{ borderBottom: 1, borderColor: 'divider', px: 0.5 }}
                >
                  <Tooltip title={HABIT_BLOCK_LABELS[block]} placement="top">
                    <Typography
                      component="span"
                      variant="caption"
                      fontWeight={700}
                      display="inline-block"
                      sx={{ lineHeight: 1.15, cursor: 'help' }}
                    >
                      {HABIT_BLOCK_HEADER_SHORT[block]}
                    </Typography>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {HABIT_DAYS_ORDER.map((day) => (
              <TableRow key={day} hover={!readOnly}>
                <TableCell sx={{ borderColor: 'divider', py: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {HABIT_DAY_ROW_LABELS[day]}
                  </Typography>
                </TableCell>
                {HABIT_DAY_BLOCKS_ORDER.map((block) => {
                  const key = habitScheduleKey(day, block);
                  const checked = selected.has(key);
                  return (
                    <TableCell key={key} align="center" sx={{ borderColor: 'divider', py: 0, px: 0.5 }}>
                      <Checkbox
                        checked={checked}
                        onChange={() => toggle(key)}
                        disabled={readOnly || disabled}
                        size="small"
                        sx={{ p: 0.5 }}
                        inputProps={{
                          'aria-label': `${HABIT_DAY_ROW_LABELS[day]} — ${HABIT_BLOCK_LABELS[block]}`,
                        }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};
