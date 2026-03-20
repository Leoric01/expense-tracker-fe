import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { Link } from 'react-router-dom';

export const Activate: FC = () => (
  <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8, px: 2 }}>
    <Typography variant="h5" gutterBottom>
      Aktivace účtu
    </Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>
      Odkaz z e-mailu a ověření doplníš později.
    </Typography>
    <Link to="/login">Na přihlášení</Link>
  </Box>
);
