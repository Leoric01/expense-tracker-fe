import { getNutritionProfileFindUrl, nutritionProfileUpsert } from '@api/nutrition-profile-controller/nutrition-profile-controller';
import type { NutritionProfileResponseDto } from '@api/model/nutritionProfileResponseDto';
import {
  UpsertNutritionProfileRequestDtoBiologicalSex,
  type UpsertNutritionProfileRequestDtoBiologicalSex as BiologicalSex,
} from '@api/model/upsertNutritionProfileRequestDtoBiologicalSex';
import {
  UpsertNutritionProfileRequestDtoPreferredUnitSystem,
  type UpsertNutritionProfileRequestDtoPreferredUnitSystem as PreferredUnitSystem,
} from '@api/model/upsertNutritionProfileRequestDtoPreferredUnitSystem';
import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { FC, type SubmitEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const ACTIVITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1.2, label: 'Sedavý (desk job, žádný sport)' },
  { value: 1.37, label: 'Lehce aktivní (1–2× sport/týden)' },
  { value: 1.5, label: 'Středně aktivní (3–4× sport/týden)' },
  { value: 1.72, label: 'Velmi aktivní (5–6× sport/týden)' },
  { value: 1.9, label: 'Extra aktivní (2× denně, fyzická práce)' },
];

/** Nejblížší předvolba; vstup musí být číslo (BigDecimal z API je už number v JSON). */
function nearestActivityMultiplier(value: number): number {
  if (!Number.isFinite(value)) {
    return ACTIVITY_OPTIONS[2]!.value;
  }
  return ACTIVITY_OPTIONS.reduce<number>(
    (best, o) => (Math.abs(o.value - value) < Math.abs(best - value) ? o.value : best),
    ACTIVITY_OPTIONS[0]!.value,
  );
}

type FormState = {
  preferredUnitSystem: PreferredUnitSystem;
  biologicalSex: BiologicalSex;
  heightCm: string;
  activityMultiplier: number;
  bodyFatAutoCalculationEnabled: boolean;
};

const defaultForm: FormState = {
  preferredUnitSystem: UpsertNutritionProfileRequestDtoPreferredUnitSystem.METRIC,
  biologicalSex: UpsertNutritionProfileRequestDtoBiologicalSex.MALE,
  heightCm: '180',
  activityMultiplier: 1.5,
  bodyFatAutoCalculationEnabled: true,
};

function profileToForm(profile: NutritionProfileResponseDto | null): FormState {
  if (!profile) {
    return { ...defaultForm };
  }
  const mult = Number(profile.activityMultiplier ?? 1.5);
  return {
    preferredUnitSystem:
      profile.preferredUnitSystem ?? UpsertNutritionProfileRequestDtoPreferredUnitSystem.METRIC,
    biologicalSex: profile.biologicalSex ?? UpsertNutritionProfileRequestDtoBiologicalSex.MALE,
    heightCm: profile.heightCm != null ? String(profile.heightCm) : '180',
    activityMultiplier: nearestActivityMultiplier(Number.isFinite(mult) ? mult : 1.5),
    bodyFatAutoCalculationEnabled: profile.bodyFatAutoCalculationEnabled ?? true,
  };
}

export const NutritionSetupPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(defaultForm);

  const profileQuery = useQuery({
    queryKey: ['nutritionProfile', trackerId],
    enabled: !!trackerId,
    queryFn: async ({ signal }): Promise<NutritionProfileResponseDto | null> => {
      const res = await fetch(getNutritionProfileFindUrl(trackerId!), { signal });
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as NutritionProfileResponseDto;
    },
  });

  useEffect(() => {
    if (profileQuery.isSuccess) {
      setForm(profileToForm(profileQuery.data ?? null));
    }
  }, [trackerId, profileQuery.isSuccess, profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const height = Number(form.heightCm.replace(',', '.'));
      if (!Number.isFinite(height) || height <= 0) {
        throw new Error('INVALID_HEIGHT');
      }
      const res = await nutritionProfileUpsert(trackerId!, {
        preferredUnitSystem: form.preferredUnitSystem,
        biologicalSex: form.biologicalSex,
        heightCm: height,
        activityMultiplier: form.activityMultiplier,
        bodyFatAutoCalculationEnabled: form.bodyFatAutoCalculationEnabled,
      });
      if (res.status >= 400) {
        throw new Error('API_ERROR');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['nutritionProfile', trackerId] });
      enqueueSnackbar('Profil byl uložen', { variant: 'success' });
      navigate('/nutrition/goal-plan/new');
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'INVALID_HEIGHT') {
        enqueueSnackbar('Zadej platnou výšku v cm', { variant: 'warning' });
        return;
      }
      enqueueSnackbar('Uložení profilu selhalo', { variant: 'error' });
    },
  });

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!trackerId) {
      return;
    }
    saveMutation.mutate();
  };

  const handleUnitChange = (e: SelectChangeEvent<PreferredUnitSystem>) => {
    setForm((f) => ({ ...f, preferredUnitSystem: e.target.value as PreferredUnitSystem }));
  };

  const handleSexChange = (e: SelectChangeEvent<BiologicalSex>) => {
    setForm((f) => ({ ...f, biologicalSex: e.target.value as BiologicalSex }));
  };

  const handleActivityChange = (e: SelectChangeEvent<string | number>) => {
    setForm((f) => ({ ...f, activityMultiplier: Number(e.target.value) }));
  };

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Nutrition Profile
        </PageHeading>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nejprve vyber rozpočet (tracker), ke kterému chceš výživu vázat — v menu u položky Trackery nebo v postranním
          panelu.
        </Typography>
        <Button component={Link} to="/trackers" variant="contained">
          Otevřít trackery
        </Button>
      </Box>
    );
  }

  if (profileQuery.isError) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Nutrition Profile
        </PageHeading>
        <Typography color="error">Profil se nepodařilo načíst.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        Nutrition Profile
      </PageHeading>

      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={0}
        sx={{
          maxWidth: 520,
          p: 3,
          mt: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Stack spacing={2.5}>
          <FormControl fullWidth disabled={profileQuery.isLoading}>
            <InputLabel id="nutrition-units-label">Jednotky</InputLabel>
            <Select<PreferredUnitSystem>
              labelId="nutrition-units-label"
              label="Jednotky"
              value={form.preferredUnitSystem}
              onChange={handleUnitChange}
            >
              <MenuItem value={UpsertNutritionProfileRequestDtoPreferredUnitSystem.METRIC}>
                METRIC
              </MenuItem>
              <MenuItem value={UpsertNutritionProfileRequestDtoPreferredUnitSystem.IMPERIAL}>
                IMPERIAL
              </MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={profileQuery.isLoading}>
            <InputLabel id="nutrition-sex-label">Pohlaví</InputLabel>
            <Select<BiologicalSex>
              labelId="nutrition-sex-label"
              label="Pohlaví"
              value={form.biologicalSex}
              onChange={handleSexChange}
            >
              <MenuItem value={UpsertNutritionProfileRequestDtoBiologicalSex.MALE}>MALE</MenuItem>
              <MenuItem value={UpsertNutritionProfileRequestDtoBiologicalSex.FEMALE}>FEMALE</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Výška (cm)"
            type="number"
            inputProps={{ min: 1, step: 0.1 }}
            value={form.heightCm}
            onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))}
            disabled={profileQuery.isLoading}
            fullWidth
            required
          />

          <FormControl fullWidth disabled={profileQuery.isLoading}>
            <InputLabel id="nutrition-activity-label">Activity level</InputLabel>
            <Select
              labelId="nutrition-activity-label"
              label="Activity level"
              value={form.activityMultiplier}
              onChange={handleActivityChange}
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={form.bodyFatAutoCalculationEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bodyFatAutoCalculationEnabled: e.target.checked }))
                }
                disabled={profileQuery.isLoading}
              />
            }
            label="Auto BF calc"
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={profileQuery.isLoading || saveMutation.isPending}
            >
              Uložit profil
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};
