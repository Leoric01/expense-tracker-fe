import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { Link } from 'react-router-dom';

export const Register: FC = () => (
  <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8, px: 2 }}>
    <Typography variant="h5" gutterBottom>
      Registrace
    </Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>
      Formulář registrace doplníš, až bude připojené API.
    </Typography>
    <Link to="/login">Zpět na přihlášení</Link>
  </Box>
);
