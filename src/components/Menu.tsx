import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import {
  Box,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { FC } from 'react';
import { NavLink } from 'react-router-dom';

const drawerWidth = 260;

type MenuProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export const Menu: FC<MenuProps> = ({ mobileOpen, onMobileClose }) => {
  const { selectedExpenseTracker, setSelectedExpenseTracker } = useSelectedExpenseTracker();
  const budgetName = selectedExpenseTracker?.name ?? '—';

  const drawer = (
    <Box sx={{ textAlign: 'center' }}>
      <Toolbar
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          minHeight: 'auto',
          py: 2,
          px: 1.5,
          gap: 0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
          Rozpočet
        </Typography>
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ textAlign: 'left', lineHeight: 1.3 }}
          noWrap
          title={budgetName}
        >
          {budgetName}
        </Typography>
        {selectedExpenseTracker && (
          <Button
            size="small"
            variant="text"
            onClick={() => setSelectedExpenseTracker(null)}
            sx={{ alignSelf: 'flex-start', mt: 0.5, px: 0, minWidth: 0, textTransform: 'none' }}
          >
            Zrušit výběr trackera
          </Button>
        )}
      </Toolbar>
      <List sx={{ px: 1 }}>
        <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          {({ isActive }) => (
            <ListItemButton selected={isActive} onClick={onMobileClose}>
              <ListItemText primary="Domů" />
            </ListItemButton>
          )}
        </NavLink>
        <NavLink to="/trackers" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          {({ isActive }) => (
            <ListItemButton selected={isActive} onClick={onMobileClose}>
              <ListItemText primary="Trackery" />
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
