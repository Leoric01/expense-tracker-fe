import { useSelectedExpenseTracker } from '@hooks/useSelectedExpenseTracker';
import { expenseTrackerFindAllMine } from '@api/expense-tracker-controller/expense-tracker-controller';
import type { PagedModelExpenseTrackerMineResponseDto } from '@api/model';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu as MuiMenu,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { FC, MouseEvent, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const drawerWidth = 260;
const collapsedDrawerWidth = 0;

type MenuProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  desktopCollapsed?: boolean;
  onDesktopCollapseToggle?: () => void;
};

export const Menu: FC<MenuProps> = ({
  mobileOpen,
  onMobileClose,
  desktopCollapsed = false,
  onDesktopCollapseToggle,
}) => {
  const theme = useTheme();
  const location = useLocation();
  const { selectedExpenseTracker, setSelectedExpenseTracker } = useSelectedExpenseTracker();
  const budgetName = selectedExpenseTracker?.name ?? '—';
  const pathname = location.pathname;
  const [trackerMenuAnchorEl, setTrackerMenuAnchorEl] = useState<HTMLElement | null>(null);

  const isNutritionSection = pathname.startsWith('/nutrition');
  const isHabitSection = pathname.startsWith('/habits');
  const isTodoSection = pathname.startsWith('/todos');
  const isKanbanSection = pathname.startsWith('/kanban');
  const kanbanBoardId = pathname.match(/^\/kanban\/boards\/([^/]+)/)?.[1] ?? null;
  const isModuleHubSection = pathname === '/moduly';
  const isTrackerSection = pathname.startsWith('/trackers');

  const { data: trackersResponse } = useQuery({
    queryKey: ['/api/expense-trackers/mine', { page: 0, size: 200, sort: ['name,asc'] }],
    queryFn: () => expenseTrackerFindAllMine({ page: 0, size: 200, sort: ['name,asc'] }),
    staleTime: 30_000,
  });

  const trackerOptions = useMemo(() => {
    const paged = trackersResponse?.data as PagedModelExpenseTrackerMineResponseDto | undefined;
    const items = paged?.content ?? [];
    return items.filter((item): item is { id: string; name?: string } => Boolean(item?.id));
  }, [trackersResponse]);

  const openTrackerMenu = (event: MouseEvent<HTMLElement>) => {
    setTrackerMenuAnchorEl(event.currentTarget);
  };

  const closeTrackerMenu = () => {
    setTrackerMenuAnchorEl(null);
  };

  const handleTrackerSelect = (tracker: { id: string; name?: string } | null) => {
    setSelectedExpenseTracker(tracker ? { id: tracker.id, name: tracker.name ?? '—' } : null);
    closeTrackerMenu();
  };

  const trackerMenuOpen = Boolean(trackerMenuAnchorEl);

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
            <ListItemButton
              onClick={openTrackerMenu}
              sx={{ p: 0, borderRadius: 1, minHeight: 'unset', justifyContent: 'space-between', gap: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ textAlign: 'left', lineHeight: 1.3, minWidth: 0 }}
                noWrap
                title={budgetName}
              >
                {budgetName}
              </Typography>
              <ArrowDropDownIcon fontSize="small" color="action" />
            </ListItemButton>
          </>
        ) : isHabitSection ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              Návyky
            </Typography>
            <ListItemButton
              onClick={openTrackerMenu}
              sx={{ p: 0, borderRadius: 1, minHeight: 'unset', justifyContent: 'space-between', gap: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ textAlign: 'left', lineHeight: 1.3, minWidth: 0 }}
                noWrap
                title={budgetName}
              >
                {budgetName}
              </Typography>
              <ArrowDropDownIcon fontSize="small" color="action" />
            </ListItemButton>
          </>
        ) : isTodoSection ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              ToDo
            </Typography>
            <ListItemButton
              onClick={openTrackerMenu}
              sx={{ p: 0, borderRadius: 1, minHeight: 'unset', justifyContent: 'space-between', gap: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ textAlign: 'left', lineHeight: 1.3, minWidth: 0 }}
                noWrap
                title={budgetName}
              >
                {budgetName}
              </Typography>
              <ArrowDropDownIcon fontSize="small" color="action" />
            </ListItemButton>
          </>
        ) : isKanbanSection ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              Kanban
            </Typography>
            <ListItemButton
              onClick={openTrackerMenu}
              sx={{ p: 0, borderRadius: 1, minHeight: 'unset', justifyContent: 'space-between', gap: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ textAlign: 'left', lineHeight: 1.3, minWidth: 0 }}
                noWrap
                title={budgetName}
              >
                {budgetName}
              </Typography>
              <ArrowDropDownIcon fontSize="small" color="action" />
            </ListItemButton>
          </>
        ) : isModuleHubSection ? (
          <>
            <ListItemButton
              onClick={openTrackerMenu}
              sx={{ p: 0, borderRadius: 1, minHeight: 'unset', justifyContent: 'space-between', gap: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ textAlign: 'left', lineHeight: 1.3, minWidth: 0 }}
                noWrap
                title={budgetName}
              >
                Rozpočet: {budgetName}
              </Typography>
              <ArrowDropDownIcon fontSize="small" color="action" />
            </ListItemButton>
          </>
        ) : isTrackerSection ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              Trackery
            </Typography>
            <ListItemButton
              onClick={openTrackerMenu}
              sx={{ p: 0, borderRadius: 1, minHeight: 'unset', justifyContent: 'space-between', gap: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ textAlign: 'left', lineHeight: 1.3, minWidth: 0 }}
                noWrap
                title={budgetName}
              >
                {budgetName}
              </Typography>
              <ArrowDropDownIcon fontSize="small" color="action" />
            </ListItemButton>
          </>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
              Finance
            </Typography>
            <ListItemButton
              onClick={openTrackerMenu}
              sx={{ p: 0, borderRadius: 1, minHeight: 'unset', justifyContent: 'space-between', gap: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ textAlign: 'left', lineHeight: 1.3, minWidth: 0 }}
                noWrap
                title={budgetName}
              >
                {budgetName}
              </Typography>
              <ArrowDropDownIcon fontSize="small" color="action" />
            </ListItemButton>
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
        ) : isTodoSection ? (
          <>
            <NavLink to="/todos/list" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Seznam úkolů" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/todos/tags" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Štítky" />
                </ListItemButton>
              )}
            </NavLink>
          </>
        ) : isKanbanSection ? (
          <>
            <NavLink to="/kanban/boards" end style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive && !kanbanBoardId} onClick={onMobileClose}>
                  <ListItemText primary="Nástěnky" />
                </ListItemButton>
              )}
            </NavLink>
            {kanbanBoardId && (
              <NavLink to={`/kanban/boards/${kanbanBoardId}`} end style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {({ isActive }) => (
                  <ListItemButton selected={isActive} onClick={onMobileClose}>
                    <ListItemText primary="Nástěnka" />
                  </ListItemButton>
                )}
              </NavLink>
            )}
            <NavLink to="/kanban/tags" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Štítky" />
                </ListItemButton>
              )}
            </NavLink>
          </>
        ) : isModuleHubSection ? null : isTrackerSection ? (
          <>
            <NavLink to="/trackers" end style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Trackery" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/moduly" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Moduly" />
                </ListItemButton>
              )}
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/prehled" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Přehled" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/categories" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Kategorie" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/importy" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Importy" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/exporty" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose}>
                  <ListItemText primary="Exporty" />
                </ListItemButton>
              )}
            </NavLink>
            <ListItemButton
              selected={pathname.startsWith('/transactions')}
              onClick={onMobileClose}
              sx={{ cursor: 'default' }}
              disableRipple
            >
              <ListItemText
                primary="Transakce"
                primaryTypographyProps={{ fontWeight: 600, color: 'text.secondary' }}
              />
            </ListItemButton>
            <NavLink to="/transactions/history" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose} sx={{ pl: 3 }}>
                  <ListItemText primary="Historie" />
                </ListItemButton>
              )}
            </NavLink>
            <NavLink to="/transactions/prevody" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive} onClick={onMobileClose} sx={{ pl: 3 }}>
                  <ListItemText primary="Převody" />
                </ListItemButton>
              )}
            </NavLink>
          </>
        )}
      </List>
      <MuiMenu
        anchorEl={trackerMenuAnchorEl}
        open={trackerMenuOpen}
        onClose={closeTrackerMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <ListItemButton
          selected={!selectedExpenseTracker}
          onClick={() => handleTrackerSelect(null)}
          sx={{ minWidth: 240 }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            {!selectedExpenseTracker ? <CheckIcon fontSize="small" color="primary" /> : null}
          </ListItemIcon>
          <ListItemText primary="Bez vybraného trackeru" />
        </ListItemButton>
        {trackerOptions.map((tracker) => {
          const isSelected = selectedExpenseTracker?.id === tracker.id;
          return (
            <ListItemButton key={tracker.id} selected={isSelected} onClick={() => handleTrackerSelect(tracker)}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                {isSelected ? <CheckIcon fontSize="small" color="primary" /> : null}
              </ListItemIcon>
              <ListItemText primary={tracker.name ?? '—'} />
            </ListItemButton>
          );
        })}
      </MuiMenu>
    </Box>
  );

  const desktopDrawerWidth = desktopCollapsed ? collapsedDrawerWidth : drawerWidth;
  const drawerWidthTransition = theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  });
  const toolbarMinHeight =
    typeof theme.mixins.toolbar.minHeight === 'number'
      ? theme.mixins.toolbar.minHeight
      : 64;

  return (
    <Box
      component="nav"
      sx={{
        width: { md: desktopDrawerWidth },
        flexShrink: { md: 0 },
        position: 'relative',
        transition: drawerWidthTransition,
      }}
    >
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
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: desktopDrawerWidth,
            overflowX: 'hidden',
            transition: drawerWidthTransition,
            borderRight: desktopCollapsed ? 0 : undefined,
          },
        }}
      >
        {drawer}
      </Drawer>
      {onDesktopCollapseToggle && (
        <Tooltip title={desktopCollapsed ? 'Rozbalit menu' : 'Sbalit menu'} placement="right">
          <IconButton
            onClick={onDesktopCollapseToggle}
            size="small"
            aria-label={desktopCollapsed ? 'Rozbalit menu' : 'Sbalit menu'}
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              position: 'absolute',
              top: toolbarMinHeight / 2,
              transform: 'translateY(-50%)',
              zIndex: theme.zIndex.drawer + 1,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              boxShadow: 1,
              ...(desktopCollapsed
                ? { left: 8, right: 'auto' }
                : { right: -16, left: 'auto' }),
              '&:hover': {
                bgcolor: 'background.paper',
              },
            }}
          >
            {desktopCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
