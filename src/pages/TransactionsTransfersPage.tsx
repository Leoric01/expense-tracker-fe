import { PageHeading } from '@components/PageHeading';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { Box, Button, Typography } from '@mui/material';
import { TransactionsV2Panel } from '@pages/home/TransactionsV2Panel';
import { FC } from 'react';
import { Link } from 'react-router-dom';

export const TransactionsTransfersPage: FC = () => {
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const trackerId = selectedExpenseTracker?.id;

  if (!trackerId) {
    return (
      <Box sx={{ mt: -1 }}>
        <PageHeading component="h1" sx={{ mt: -1, mb: 0.5 }}>
          Převody
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

  return (
    <Box sx={{ mt: -1 }}>
      <PageHeading component="h1" gutterBottom={false}>
        Převody
      </PageHeading>
      <TransactionsV2Panel trackerId={trackerId} />
    </Box>
  );
};
