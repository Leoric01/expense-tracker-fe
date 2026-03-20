import { useAuth } from '@auth/AuthContext';
import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';

export const Home: FC = () => {
  const { userData, logout } = useAuth();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Vítej{userData?.fullName ? `, ${userData.fullName}` : ''}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Aplikace je připravená — sem přijdou výdaje a přehledy.
      </Typography>
      <Button variant="outlined" color="secondary" onClick={() => logout()}>
        Odhlásit
      </Button>
    </Box>
  );
};
