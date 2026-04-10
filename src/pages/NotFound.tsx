import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { Link } from 'react-router-dom';

export const NotFound: FC = () => (
  <Box sx={{ p: 4, textAlign: 'center' }}>
    <Typography variant="h4" gutterBottom>
      404
    </Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>
      Stránka neexistuje.
    </Typography>
    <Link to="/moduly">Zpět na moduly</Link>
  </Box>
);
