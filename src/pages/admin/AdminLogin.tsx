import { authLoginRequest, AuthRequestError } from '@api/auth-api';
import type { UserData } from '@auth/AuthContext';
import { useAuth } from '@auth/AuthContext';
import { hasAdminRole } from '@auth/adminUtils';
import { jwtDecode } from 'jwt-decode';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { AuthPageLayout } from '../auth/AuthPageLayout';

export const AdminLogin: FC = () => {
  const { login, userData, token, isLoading } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return null;
  }

  if (token && hasAdminRole(userData)) {
    return <Navigate to="/admin/portal" replace />;
  }

  if (token && !hasAdminRole(userData)) {
    return (
      <AuthPageLayout
        title="Administrace"
        subtitle="Tento účet nemá oprávnění administrátora."
      >
        <Typography variant="body1" sx={{ mb: 2 }}>
          Pro vstup do administrace se musíš přihlásit účtem s rolí administrátora.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Zpět na přehled
        </Button>
      </AuthPageLayout>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const t = await authLoginRequest({ email: email.trim(), password });
      const decoded = jwtDecode<UserData>(t);
      login(t);
      if (!hasAdminRole(decoded)) {
        enqueueSnackbar('Účet nemá oprávnění administrátora', { variant: 'warning' });
        navigate('/', { replace: true });
        return;
      }
      enqueueSnackbar('Přihlášení do administrace OK', { variant: 'success' });
      navigate('/admin/portal', { replace: true });
    } catch (err) {
      const msg =
        err instanceof AuthRequestError ? err.message : 'Přihlášení se nepodařilo';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      title="Administrace"
      subtitle="Přihlas se účtem s oprávněním administrátora."
    >
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Přihlášení administrátora
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Po ověření uvidíš nástroje pro správu uživatelů.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          <TextField
            label="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="Heslo"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            disabled={submitting}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="zobrazit heslo"
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting || !email.trim() || !password}
            sx={{ mt: 1, py: 1.25, fontWeight: 600 }}
          >
            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Přihlásit se'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        <RouterLink to="/" style={{ fontWeight: 600 }}>
          Zpět do aplikace
        </RouterLink>
      </Typography>
    </AuthPageLayout>
  );
};
