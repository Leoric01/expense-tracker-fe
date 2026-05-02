import {
  budgetPlanImportBulk,
  budgetPlanImportByCategoryIdBulk,
} from '@api/budget-plan-controller/budget-plan-controller';
import { categoryCreateBulk } from '@api/category-controller/category-controller';
import type {
  BulkBudgetImportByCategoryIdRequestDto,
  BulkBudgetImportItemDto,
  BulkBudgetImportRequestDto,
  CreateCategoryBulkRequestDto,
} from '@api/model';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import { Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, type SubmitEvent, useState } from 'react';
import { Link } from 'react-router-dom';

const EXAMPLE_JSON_BY_NAME = `{
  "items": [
    {
      "budgetPlanName": "Ukazka",
      "period": "2026-04",
      "amount": 10000,
      "currency": "CZK",
      "categoryName": "Bydleni"
    }
  ]
}`;

const EXAMPLE_JSON_BY_ID = `{
  "items": [
    {
      "budgetPlanName": "Ukazka",
      "period": "2026-04",
      "amount": 10000,
      "currency": "CZK",
      "categoryId": "sem-vloz-id-kategorie"
    }
  ]
}`;

const EXAMPLE_JSON_CATEGORY = `[
  {
    "name": "Bydleni",
    "categoryKind": "EXPENSE",
    "sortOrder": 10
  },
  {
    "name": "Prijmy",
    "categoryKind": "INCOME",
    "sortOrder": 20
  }
]`;

type Props = {
  trackerId: string;
};

export const BudgetPlanImportPanel: FC<Props> = ({ trackerId }) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [importMode, setImportMode] = useState<'by-name' | 'by-id' | 'category'>('by-name');
  const [jsonText, setJsonText] = useState(EXAMPLE_JSON_BY_NAME);
  const [submitting, setSubmitting] = useState(false);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setParseError('Neplatný JSON.');
      return;
    }
    setSubmitting(true);
    setLastStatus(null);
    setResponseBody('');
    try {
      const parseItemsObject = (value: unknown): unknown[] | null => {
        if (Array.isArray(value)) return value;
        if (
          value &&
          typeof value === 'object' &&
          'items' in value &&
          Array.isArray((value as { items?: unknown }).items)
        ) {
          return (value as { items: unknown[] }).items;
        }
        return null;
      };

      let res;
      if (importMode === 'category') {
        const categoryItems = parseItemsObject(parsed);
        if (!categoryItems) {
          setParseError('Pro import kategorii se očekává JSON pole (nebo objekt s `items`).');
          return;
        }
        res = await categoryCreateBulk(trackerId, categoryItems as CreateCategoryBulkRequestDto[]);
      } else {
        const budgetItems = parseItemsObject(parsed);
        if (!budgetItems) {
          setParseError('Očekává se JSON pole položek nebo objekt s položkou `items`.');
          return;
        }
        if (importMode === 'by-id') {
          res = await budgetPlanImportByCategoryIdBulk(trackerId, {
            items: budgetItems as BulkBudgetImportByCategoryIdRequestDto['items'],
          });
        } else {
          res = await budgetPlanImportBulk(trackerId, {
            items: budgetItems as BulkBudgetImportItemDto[],
          });
        }
      }
      setLastStatus(res.status);
      setResponseBody(JSON.stringify(res.data ?? {}, null, 2));
      if (res.status >= 200 && res.status < 300) {
        enqueueSnackbar('Import dokončen', { variant: 'success' });
        await queryClient.invalidateQueries({ queryKey: [`/api/category/${trackerId}/active-light`] });
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
      <Stack spacing={2}>
        <ToggleButtonGroup
          exclusive
          value={importMode}
          onChange={(_, value: 'by-name' | 'by-id' | 'category' | null) => {
            if (!value) return;
            setImportMode(value);
            setParseError(null);
            setJsonText(
              value === 'by-id'
                ? EXAMPLE_JSON_BY_ID
                : value === 'category'
                  ? EXAMPLE_JSON_CATEGORY
                  : EXAMPLE_JSON_BY_NAME,
            );
          }}
          size="small"
        >
          <ToggleButton value="by-name">Import rozpočtů</ToggleButton>
          <ToggleButton value="by-id">Import rozpočtů s categoryId</ToggleButton>
          <ToggleButton value="category">Import kategorii</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          label="JSON"
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

export const FinanceImportyPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();

  if (selectedExpenseTracker?.id) {
    return <BudgetPlanImportPanel trackerId={selectedExpenseTracker.id} />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Importy
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Vyber rozpočet (tracker), aby bylo možné importovat plán a kategorie z JSON.
      </Typography>
      <Button component={Link} to="/trackers" variant="contained">
        Moje trackery
      </Button>
    </Box>
  );
};
