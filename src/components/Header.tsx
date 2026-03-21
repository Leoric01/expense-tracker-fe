import MenuIcon from '@mui/icons-material/Menu';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { useAuth } from '@auth/AuthContext';
import { useThemeMode } from '@components/contexts/ThemeModeContext';
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, MouseEvent, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

type HeaderProps = {
  onMenuToggle: () => void;
  showMenuToggle: boolean;
};

export const Header: FC<HeaderProps> = ({ onMenuToggle, showMenuToggle }) => {
  const { userData, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const initials = useMemo(() => {
    const name = userData?.fullName?.trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }, [userData?.fullName]);

  const handleAvatarClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleOpenProfile = () => {
    handleMenuClose();
    navigate('/settings');
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar>
        {showMenuToggle && (
          <IconButton color="inherit" edge="start" onClick={onMenuToggle} sx={{ mr: 2 }} aria-label="menu">
            <MenuIcon />
          </IconButton>
        )}
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{
            flexGrow: 1,
            color: 'inherit',
            textDecoration: 'none',
            '&:hover': { opacity: 0.85 },
          }}
        >
          Expense tracker
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Tooltip title={mode === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}>
            <IconButton onClick={toggleMode} color="inherit" aria-label="přepnout režim">
              {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={userData?.fullName || 'Uživatel'}>
            <IconButton onClick={handleAvatarClick} size="small" sx={{ ml: 1 }} aria-label="profil">
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>{initials}</Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem disabled>{userData?.fullName || 'Přihlášený uživatel'}</MenuItem>
            <MenuItem onClick={handleOpenProfile}>Můj profil</MenuItem>
            <MenuItem onClick={handleLogout}>Odhlásit</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
