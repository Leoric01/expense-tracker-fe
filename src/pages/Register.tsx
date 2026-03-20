import { authRegisterRequest, AuthRequestError } from '@api/auth-api';
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

export const Register: FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      enqueueSnackbar('Hesla se neshodují', { variant: 'warning' });
      return;
    }
    if (password.length < 3) {
      enqueueSnackbar('Heslo musí mít alespoň 3 znaky', { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await authRegisterRequest({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });
      enqueueSnackbar('Účet byl vytvořen — teď se přihlas', { variant: 'success' });
      navigate('/login', { replace: true });
    } catch (err) {
      const msg =
        err instanceof AuthRequestError ? err.message : 'Registrace se nepodařila';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      title="Začni sledovat své finance"
      subtitle="Registrace ti zabere chvíli. Pak můžeš tvořit trackery, zapisovat výdaje a pozvat další členy."
    >
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Registrace
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vyplň základní údaje — stejné pole validuje i backend podle OpenAPI.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Jméno"
              name="given-name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              fullWidth
              disabled={submitting}
            />
            <TextField
              label="Příjmení"
              name="family-name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              fullWidth
              disabled={submitting}
            />
          </Stack>
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
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            disabled={submitting}
            helperText="Min. 3 znaky (podle API)"
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
          <TextField
            label="Potvrzení hesla"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            fullWidth
            disabled={submitting}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={
              submitting ||
              !firstName.trim() ||
              !lastName.trim() ||
              !email.trim() ||
              !password ||
              !confirm
            }
            sx={{ mt: 1, py: 1.25, fontWeight: 600 }}
          >
            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Vytvořit účet'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        Už máš účet?{' '}
        <MuiLink component={Link} to="/login" fontWeight={600}>
          Přihlásit se
        </MuiLink>
      </Typography>
    </AuthPageLayout>
  );
};
