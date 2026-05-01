import { useAuth } from '@auth/AuthContext';
import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { TrackerHomeWallets } from './home/TrackerHomeWallets';

export const Home: FC = () => {
  const { userData } = useAuth();
  const { selectedExpenseTracker } = useSelectedExpenseTracker();
  const [searchParams] = useSearchParams();

  const tab = searchParams.get('tab');
  if (tab === 'importy') {
    return <Navigate to="/importy" replace />;
  }
  if (tab === 'exporty') {
    return <Navigate to="/exporty" replace />;
  }

  if (selectedExpenseTracker?.id) {
    return (
      <TrackerHomeWallets trackerId={selectedExpenseTracker.id} trackerName={selectedExpenseTracker.name} />
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Vítej{userData?.fullName ? `, ${userData.fullName}` : ''}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Aplikace je připravená — sem přijdou výdaje a přehledy.
      </Typography>
      <Button component={Link} to="/trackers" variant="contained">
        Moje trackery
      </Button>
    </Box>
  );
};
