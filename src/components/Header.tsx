import MenuIcon from '@mui/icons-material/Menu';
import { AppBar, IconButton, Toolbar, Typography } from '@mui/material';
import { FC } from 'react';

type HeaderProps = {
  onMenuToggle: () => void;
  showMenuToggle: boolean;
};

export const Header: FC<HeaderProps> = ({ onMenuToggle, showMenuToggle }) => (
  <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
    <Toolbar>
      {showMenuToggle && (
        <IconButton color="inherit" edge="start" onClick={onMenuToggle} sx={{ mr: 2 }} aria-label="menu">
          <MenuIcon />
        </IconButton>
      )}
      <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
        Expense tracker
      </Typography>
    </Toolbar>
  </AppBar>
);
