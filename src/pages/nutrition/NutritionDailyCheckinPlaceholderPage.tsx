import { PageHeading } from '@components/PageHeading';
import { Box, Typography } from '@mui/material';
import { FC } from 'react';

/** Sekce 4 — denní check-in (doplní se). */
export const NutritionDailyCheckinPlaceholderPage: FC = () => (
  <Box>
    <PageHeading component="h1" gutterBottom>
      Denní check-in
    </PageHeading>
    <Typography color="text.secondary">Zápis dnešního check-inu — připravuje se.</Typography>
  </Box>
);
