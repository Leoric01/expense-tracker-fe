import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';

export const Root: FC<{ children: ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>{children}</Box>
);
