import { PageHeading } from '@components/PageHeading';
import { Box, Typography } from '@mui/material';
import { FC } from 'react';

/** Výběr modulu — postranní menu nabízí Finance, Návyky a Výživa. */
export const ModuleHubPage: FC = () => {
  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        Moduly
      </PageHeading>
      <Typography color="text.secondary" variant="body1" sx={{ maxWidth: 480 }}>
        Vyber oblast v menu vlevo: <strong>Finance</strong> (rozpočet, účty, přehledy), <strong>Návyky</strong> nebo{' '}
        <strong>Výživa</strong>.
      </Typography>
    </Box>
  );
};
