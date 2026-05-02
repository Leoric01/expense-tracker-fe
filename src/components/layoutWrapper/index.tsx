import { Header, Root, Menu } from '@components/index';
import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FC, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

export const LayoutWrapper: FC = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isDesktop) {
      setMobileOpen(false);
    }
  }, [isDesktop]);

  const handleMenuToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleMenuClose = () => {
    setMobileOpen(false);
  };

  return (
    <Root>
      <Menu mobileOpen={mobileOpen} onMobileClose={handleMenuClose} />
      <Box width="100%">
        <Header
          onMenuToggle={handleMenuToggle}
          showMenuToggle={!isDesktop}
        />
        <Box
          sx={{
            px: { xs: 2, md: 6 },
            pt: { xs: 1.5, md: 2 },
            pb: { xs: 2, md: 4 },
            backgroundColor: '#114b3f',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Root>
  );
};
