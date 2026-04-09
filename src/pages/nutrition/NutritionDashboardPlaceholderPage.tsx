import { PageHeading } from '@components/PageHeading';
import { Box, Typography } from '@mui/material';
import { FC } from 'react';

/** Placeholder — doplní se plným nutrition dashboardem v další sekci. */
export const NutritionDashboardPlaceholderPage: FC = () => (
  <Box>
    <PageHeading component="h1" gutterBottom>
      Dashboard výživy
    </PageHeading>
    <Typography color="text.secondary">Přehled a grafy — připravuje se.</Typography>
  </Box>
);
