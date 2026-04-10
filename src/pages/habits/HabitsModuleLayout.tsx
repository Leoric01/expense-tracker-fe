import { Box, Tab, Tabs } from '@mui/material';
import { FC } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

function showHabitModuleTabs(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'habits') {
    return false;
  }
  if (parts.length === 1) {
    return true;
  }
  const seg = parts[1];
  return seg === 'agenda' || seg === 'week' || seg === 'list';
}

export const HabitsModuleLayout: FC = () => {
  const { pathname } = useLocation();
  const showTabs = showHabitModuleTabs(pathname);

  const tabValue =
    pathname.startsWith('/habits/week') ? 1 : pathname.startsWith('/habits/list') ? 2 : 0;

  return (
    <Box>
      {showTabs ? (
        <Tabs
          value={tabValue}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            mb: 2,
            minHeight: 42,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 42 },
          }}
        >
          <Tab label="Agenda" component={Link} to="/habits/agenda" />
          <Tab label="Týden" component={Link} to="/habits/week" />
          <Tab label="Návyky" component={Link} to="/habits/list" />
        </Tabs>
      ) : null}
      <Outlet />
    </Box>
  );
};
