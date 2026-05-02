import {
  profileChangePassword,
  profileMe,
  profileUpdate,
} from '@api/profile-controller/profile-controller';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { FC, type SubmitEvent, useEffect, useState } from 'react';

type ProfileData = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
};

export const Profile: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmationPassword, setNewConfirmationPassword] = useState('');

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await profileMe();
      const data = (res.data ?? {}) as ProfileData;
      setProfile(data);
      setFirstName(data.firstName ?? '');
      setLastName(data.lastName ?? '');
    } catch {
      enqueueSnackbar('Nepodařilo se načíst profil', { variant: 'error' });
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleSaveProfile = async (event: SubmitEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await profileUpdate({ firstName: firstName.trim(), lastName: lastName.trim() });
      enqueueSnackbar('Profil byl upraven', { variant: 'success' });
      setEditOpen(false);
      await loadProfile();
    } catch {
      enqueueSnackbar('Úprava profilu selhala', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (event: SubmitEvent) => {
    event.preventDefault();
    if (newPassword !== newConfirmationPassword) {
      enqueueSnackbar('Nová hesla se neshodují', { variant: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await profileChangePassword({ oldPassword, newPassword, newConfirmationPassword });
      enqueueSnackbar('Heslo bylo změněno', { variant: 'success' });
      setPasswordDialogOpen(false);
      setOldPassword('');
      setNewPassword('');
      setNewConfirmationPassword('');
    } catch {
      enqueueSnackbar('Změna hesla selhala', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Můj profil
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Správa osobních údajů a bezpečnosti účtu.
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} aria-label="profile tabs">
          <Tab label="Můj profil" />
          <Tab label="Security" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Paper sx={{ p: 3, mb: 2 }}>
          {loadingProfile ? (
            <Typography>Načítám profil...</Typography>
          ) : (
            <Stack spacing={1}>
              <Typography><strong>ID:</strong> {profile?.id || '-'}</Typography>
              <Typography><strong>E-mail:</strong> {profile?.email || '-'}</Typography>
              <Typography><strong>Jméno:</strong> {profile?.firstName || '-'}</Typography>
              <Typography><strong>Příjmení:</strong> {profile?.lastName || '-'}</Typography>
              <Typography><strong>Role:</strong> {profile?.roles?.join(', ') || '-'}</Typography>
            </Stack>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
            <Button startIcon={<EditOutlinedIcon />} variant="contained" onClick={() => setEditOpen(true)}>
              Upravit profil
            </Button>
          </Stack>
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography sx={{ mb: 2 }}>Bezpečnostní nastavení účtu.</Typography>
          <Button
            startIcon={<LockResetOutlinedIcon />}
            variant="contained"
            onClick={() => setPasswordDialogOpen(true)}
          >
            Změnit heslo
          </Button>
        </Paper>
      )}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Upravit profil</DialogTitle>
        <Box component="form" onSubmit={handleSaveProfile}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Jméno"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Příjmení"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                fullWidth
                required
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Zrušit</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Uložit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Změnit heslo</DialogTitle>
        <Box component="form" onSubmit={handleChangePassword}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Staré heslo"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Nové heslo"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Potvrzení nového hesla"
                type="password"
                value={newConfirmationPassword}
                onChange={(e) => setNewConfirmationPassword(e.target.value)}
                fullWidth
                required
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialogOpen(false)}>Zrušit</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Změnit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};
