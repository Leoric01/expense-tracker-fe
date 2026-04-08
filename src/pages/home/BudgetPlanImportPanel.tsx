import { bulkImport } from '@api/budget-plan-controller/budget-plan-controller';
import type { BulkBudgetImportItemDto } from '@api/model';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useState } from 'react';

const EXAMPLE_JSON = `[
  {
    "budgetPlanName": "Ukázka",
    "period": "2026-04",
    "amount": 10000,
    "currency": "CZK"
  }
]`;

type Props = {
  trackerId: string;
};

export const BudgetPlanImportPanel: FC<Props> = ({ trackerId }) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [jsonText, setJsonText] = useState(EXAMPLE_JSON);
  const [submitting, setSubmitting] = useState(false);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setParseError('Neplatný JSON.');
      return;
    }
    if (!Array.isArray(parsed)) {
      setParseError('Očekává se JSON pole (pole položek k importu).');
      return;
    }
    setSubmitting(true);
    setLastStatus(null);
    setResponseBody('');
    try {
      const res = await bulkImport(trackerId, parsed as BulkBudgetImportItemDto[]);
      setLastStatus(res.status);
      setResponseBody(JSON.stringify(res.data ?? {}, null, 2));
      if (res.status >= 200 && res.status < 300) {
        enqueueSnackbar('Import dokončen', { variant: 'success' });
        await queryClient.invalidateQueries({ queryKey: [`/api/category/${trackerId}/active`] });
      } else {
        enqueueSnackbar(apiErrorMessage(res.data, 'Import se nezdařil'), { variant: 'error' });
      }
    } catch (err) {
      enqueueSnackbar('Požadavek selhal', { variant: 'error' });
      setResponseBody(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Typography variant="body2" color="text.secondary" component="div" sx={{ mb: 2 }}>
        Odesílá se na{' '}
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
          POST /api/budget-plan/{'{trackerId}'}/import
        </Box>{' '}
        jako JSON pole. Tvar položek odpovídá API (např. budgetPlanName, period, amount, currency).
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="JSON (pole položek)"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          multiline
          minRows={14}
          fullWidth
          spellCheck={false}
          InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          error={Boolean(parseError)}
          helperText={parseError ?? undefined}
        />
        <Button type="submit" variant="contained" disabled={submitting}>
          Odeslat import
        </Button>
        {lastStatus != null && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              HTTP {lastStatus}
            </Typography>
            <TextField
              label="Odpověď"
              value={responseBody}
              multiline
              minRows={10}
              fullWidth
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
};
