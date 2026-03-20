import { useAuth } from '@auth/AuthContext';
import { authLoginRequest, AuthRequestError } from '@api/auth-api';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthPageLayout } from './auth/AuthPageLayout';

export const Login: FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await authLoginRequest({ email: email.trim(), password });
      login(token);
      enqueueSnackbar('Jsi přihlášen', { variant: 'success' });
      navigate('/', { replace: true });
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
      title="Měj přehled o penězích"
      subtitle="Přihlas se a pokračuj tam, kde jsi skončil — přehledy, účty a sdílené trackery na jednom místě."
    >
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Přihlášení
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Zadej e-mail a heslo k účtu.
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
        Nemáš účet?{' '}
        <MuiLink component={Link} to="/register" fontWeight={600}>
          Založit účet
        </MuiLink>
      </Typography>
    </AuthPageLayout>
  );
};
