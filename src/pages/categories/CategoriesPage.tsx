import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';
import { Link, Navigate } from 'react-router-dom';

/** Redirect na přehled (`/domu`) se záložkou kategorií; bez trackera zůstává nápověda. */
export const CategoriesPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  if (!trackerId) {
    return (
      <Box>
        <PageHeading component="h1" gutterBottom>
          Kategorie
        </PageHeading>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nejprve vyber rozpočet (tracker) v menu u položky Trackery nebo v postranním panelu.
        </Typography>
        <Button component={Link} to="/trackers" variant="contained">
          Otevřít trackery
        </Button>
      </Box>
    );
  }

  return <Navigate to="/domu?tab=categories" replace />;
};
