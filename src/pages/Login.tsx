import { Role, useAuth } from '@auth/AuthContext';
import { Box, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function buildDemoJwt(): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      fullName: 'Demo uživatel',
      id: 'demo-id',
      sub: 'demo-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 365,
      authorities: [Role.USER],
    }),
  );
  return `${header}.${payload}.x`;
}

export const Login: FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tokenInput, setTokenInput] = useState('');

  const handleTokenSubmit = () => {
    const t = tokenInput.trim();
    if (!t) return;
    login(t);
    navigate('/', { replace: true });
  };

  const handleDemo = () => {
    login(buildDemoJwt());
    navigate('/', { replace: true });
  };

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', mt: 8, px: 2 }}>
      <Typography variant="h5" gutterBottom>
        Přihlášení
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Vlož token z API, nebo použij demo účet pro vývoj layoutu.
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Access token (JWT)"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          size="small"
        />
        <Button variant="contained" onClick={handleTokenSubmit} disabled={!tokenInput.trim()}>
          Přihlásit se tokenem
        </Button>
        <Button variant="outlined" onClick={handleDemo}>
          Demo přihlášení
        </Button>
        <Typography variant="body2">
          Nemáš účet? <MuiLink component={Link} to="/register">Registrace</MuiLink>
        </Typography>
      </Stack>
    </Box>
  );
};
