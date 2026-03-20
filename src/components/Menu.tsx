import { Box, Drawer, List, ListItemButton, ListItemText, Toolbar } from '@mui/material';
import { FC } from 'react';
import { NavLink } from 'react-router-dom';

const drawerWidth = 260;

type MenuProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export const Menu: FC<MenuProps> = ({ mobileOpen, onMobileClose }) => {
  const drawer = (
    <Box sx={{ textAlign: 'center' }}>
      <Toolbar />
      <List sx={{ px: 1 }}>
        <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          {({ isActive }) => (
            <ListItemButton selected={isActive} onClick={onMobileClose}>
              <ListItemText primary="Domů" />
            </ListItemButton>
          )}
        </NavLink>
      </List>
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  );
};
