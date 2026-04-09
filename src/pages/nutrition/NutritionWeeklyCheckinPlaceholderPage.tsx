import { PageHeading } from '@components/PageHeading';
import { Box, Typography } from '@mui/material';
import { FC } from 'react';

/** Sekce 5 — weekly check-in (doplní se). */
export const NutritionWeeklyCheckinPlaceholderPage: FC = () => (
  <Box>
    <PageHeading component="h1" gutterBottom>
      Weekly check-in
    </PageHeading>
    <Typography color="text.secondary">Vygenerování weekly check-inu — připravuje se.</Typography>
  </Box>
);
