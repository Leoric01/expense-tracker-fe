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
import { Link, NavLink, useLocation } from 'react-router-dom';

const drawerWidth = 260;

const FINANCE_PATHS = ['/domu', '/trackers', '/categories', '/settings'] as const;

function isFinancePath(pathname: string): boolean {
  return (FINANCE_PATHS as readonly string[]).includes(pathname);
}

type MenuProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export const Menu: FC<MenuProps> = ({ mobileOpen, onMobileClose }) => {
  const location = useLocation();
  const { selectedExpenseTracker, setSelectedExpenseTracker } = useSelectedExpenseTracker();
  const budgetName = selectedExpenseTracker?.name ?? '—';
  const pathname = location.pathname;

  const isNutritionSection = pathname.startsWith('/nutrition');
  const isHabitSection = pathname.startsWith('/habits');
  const isModuleHubSection = pathname === '/moduly';

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
        {isNutritionSection ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              Výživa
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
            <Button
              component={Link}
              to="/moduly"
              size="small"
              variant="text"
              onClick={onMobileClose}
              sx={{ alignSelf: 'flex-start', mt: 0.5, px: 0, minWidth: 0, textTransform: 'none' }}
            >
              Zpět na moduly
            </Button>
          </>
        ) : isHabitSection ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              Návyky
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
            <Button
              component={Link}
              to="/moduly"
              size="small"
              variant="text"
              onClick={onMobileClose}
              sx={{ alignSelf: 'flex-start', mt: 0.5, px: 0, minWidth: 0, textTransform: 'none' }}
            >
              Zpět na moduly
            </Button>
          </>
        ) : isModuleHubSection ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              Moduly
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left', lineHeight: 1.35 }}>
              Vyber oblast níže
            </Typography>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{ textAlign: 'left', lineHeight: 1.3, mt: 0.5 }}
              noWrap
              title={budgetName}
            >
              Rozpočet: {budgetName}
            </Typography>
            {selectedExpenseTracker && (
              <Button
                size="small"
                variant="text"
                onClick={() => setSelectedExpenseTracker(null)}
                sx={{ alignSelf: 'flex-start', mt: 0.25, px: 0, minWidth: 0, textTransform: 'none' }}
              >
                Zrušit výběr trackera
              </Button>
            )}
          </>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              Finance
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
            <Button
              component={Link}
              to="/moduly"
              size="small"
              variant="text"
              onClick={onMobileClose}
              sx={{ alignSelf: 'flex-start', mt: 0.25, px: 0, minWidth: 0, textTransform: 'none' }}
            >
              Zpět na moduly
            </Button>
          </>
        )}
      </Toolbar>
      <List sx={{ px: 1 }}>
        {isNutritionSection ? (
          <>
            <NavLink
              to="/nutrition/dashboard"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Dashboard" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink
              to="/nutrition/daily-checkin"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Daily check-in" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink
              to="/nutrition/weekly-checkin"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Weekly check-in" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink
              to="/nutrition/goal-plan"
              end
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Plány" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink
              to="/nutrition/goal-plan/new"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose} sx={{ pl: 3 }}>
                  <ListItemText primary="Nový plán" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink
              to="/nutrition/target-history"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Targets" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink
              to="/nutrition/setup"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Profil" />
                </ListItemButton>
              )}
            </NavLink>
          </>
        ) : isHabitSection ? (
          <>
            <NavLink to="/habits/agenda" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Denní agenda" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/habits/week" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Týdenní přehled" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink
              to="/habits/list"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Seznam návyků" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/habits/new" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Nový návyk" />
                </ListItemButton>
              )}
            </NavLink>
          </>
        ) : isModuleHubSection ? (
          <>
            <NavLink to="/domu" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton
                  selected={isFinancePath(pathname) || isActive}
                  onClick={onMobileClose}
                >
                  <ListItemText primary="Finance" secondary="Rozpočet a přehledy" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/habits" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Návyky" secondary="Agenda a rozvrh" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink
              to="/nutrition/dashboard"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Výživa" secondary="Jídlo a váha" />
                </ListItemButton>
              )}
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/domu" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Přehled" />
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
          </>
        )}
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
