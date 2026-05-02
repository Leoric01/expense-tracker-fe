import { budgetPlanExportBulk } from '@api/budget-plan-controller/budget-plan-controller';
import { categoryExportBulk } from '@api/category-controller/category-controller';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import { Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  trackerId: string;
};

export const BudgetPlanExportPanel: FC<Props> = ({ trackerId }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [exportMode, setExportMode] = useState<'budget' | 'category'>('budget');
  const [submitting, setSubmitting] = useState(false);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState('');

  const handleExport = async () => {
    setSubmitting(true);
    setLastStatus(null);
    setResponseBody('');
    try {
      const res =
        exportMode === 'category'
          ? await categoryExportBulk(trackerId)
          : await budgetPlanExportBulk(trackerId);
      setLastStatus(res.status);
      setResponseBody(JSON.stringify(res.data ?? {}, null, 2));
      if (res.status >= 200 && res.status < 300) {
        enqueueSnackbar('Export dokoncen', { variant: 'success' });
      } else {
        enqueueSnackbar(apiErrorMessage(res.data, 'Export se nezdaril'), { variant: 'error' });
      }
    } catch (err) {
      enqueueSnackbar('Pozadavek selhal', { variant: 'error' });
      setResponseBody(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Stack spacing={2}>
        <ToggleButtonGroup
          exclusive
          value={exportMode}
          onChange={(_, value: 'budget' | 'category' | null) => {
            if (!value) return;
            setExportMode(value);
          }}
          size="small"
        >
          <ToggleButton value="budget">Budgety</ToggleButton>
          <ToggleButton value="category">Kategorie</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" onClick={() => void handleExport()} disabled={submitting}>
          Nacist export
        </Button>
        {lastStatus != null && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              HTTP {lastStatus}
            </Typography>
            <TextField
              label="Export (JSON)"
              value={responseBody}
              multiline
              minRows={12}
              fullWidth
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export const FinanceExportyPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();

  if (selectedExpenseTracker?.id) {
    return <BudgetPlanExportPanel trackerId={selectedExpenseTracker.id} />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Exporty
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Vyber rozpočet (tracker), aby bylo možné exportovat rozpočty a kategorie do JSON.
      </Typography>
      <Button component={Link} to="/trackers" variant="contained">
        Moje trackery
      </Button>
    </Box>
  );
};
