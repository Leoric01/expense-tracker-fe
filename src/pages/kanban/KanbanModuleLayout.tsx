import { Box } from '@mui/material';
import { FC } from 'react';
import { Outlet } from 'react-router-dom';

export const KanbanModuleLayout: FC = () => (
  <Box sx={{ height: '100%' }}>
    <Outlet />
  </Box>
);
