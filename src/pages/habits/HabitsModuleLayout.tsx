import { Box } from '@mui/material';
import { FC } from 'react';
import { Outlet } from 'react-router-dom';

export const HabitsModuleLayout: FC = () => (
  <Box>
    <Outlet />
  </Box>
);
