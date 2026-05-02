import { Box } from '@mui/material';
import { FC } from 'react';
import { Outlet } from 'react-router-dom';

/** Pathless layout: drží jednotný kontext modulu Finance při navigaci mezi podstránkami. */
export const FinanceModuleLayout: FC = () => (
  <Box sx={{ minWidth: 0 }}>
    <Outlet />
  </Box>
);
