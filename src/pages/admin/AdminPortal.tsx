import { resetPassword } from '@api/admin-user-controller/admin-user-controller';
import { useAuth } from '@auth/AuthContext';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import LogoutIcon from '@mui/icons-material/Logout';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from 'notistack';
import { FC, FormEvent, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export const AdminPortal: FC = () => {
  const { logout, userData } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim();
    if (!em || newPassword.length < 8) {
      enqueueSnackbar('Vyplň e-mail a heslo (min. 8 znaků)', { variant: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetPassword({ email: em, newPassword });
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Reset hesla se nepodařil'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Heslo uživatele bylo nastaveno', { variant: 'success' });
      setEmail('');
      setNewPassword('');
    } catch {
      enqueueSnackbar('Reset hesla se nepodařil', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" fontWeight={700}>
          Administrace
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {userData?.fullName ? (
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
              {userData.fullName}
            </Typography>
          ) : null}
          <Tooltip title="Odhlásit">
            <IconButton onClick={() => logout()} color="inherit" aria-label="odhlásit">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Reset hesla uživatele
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Odpovídá volání <Box component="code" sx={{ fontSize: '0.85em' }}>PATCH /admin/users/reset-password</Box>.
        </Typography>

        <Box component="form" onSubmit={handleResetPassword} noValidate>
          <Stack spacing={2} sx={{ maxWidth: 400 }}>
            <TextField
              label="E-mail uživatele"
              type="email"
              name="targetEmail"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              size="small"
              disabled={submitting}
            />
            <TextField
              label="Nové heslo"
              type={showPassword ? 'text' : 'password'}
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              fullWidth
              size="small"
              disabled={submitting}
              helperText="Minimálně 8 znaků (dle API)"
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
              disabled={submitting || !email.trim() || newPassword.length < 8}
              sx={{ alignSelf: 'flex-start' }}
            >
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Nastavit heslo'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      <Typography variant="body2" sx={{ mt: 3 }}>
        <RouterLink to="/">Zpět do aplikace</RouterLink>
      </Typography>
    </Box>
  );
};
