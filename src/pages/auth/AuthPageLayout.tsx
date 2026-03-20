import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import { FC, ReactNode } from 'react';

const highlights = [
  { icon: InsightsOutlinedIcon, text: 'Přehled příjmů a výdajů na jednom místě' },
  { icon: SavingsOutlinedIcon, text: 'Sleduj rozpočet a cíle bez zbytečné složitosti' },
  { icon: ShieldOutlinedIcon, text: 'Data jen tvoje — přístup pod kontrolou' },
];

type AuthPageLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export const AuthPageLayout: FC<AuthPageLayoutProps> = ({ title, subtitle, children }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          px: { md: 6, lg: 10 },
          py: 6,
          background: (t) =>
            t.palette.mode === 'dark'
              ? `linear-gradient(160deg, #020617 0%, #0c4a3e 45%, #064e3b 100%)`
              : `linear-gradient(160deg, #ecfdf5 0%, #d1fae5 35%, #a7f3d0 100%)`,
          color: theme.palette.mode === 'dark' ? 'grey.100' : 'grey.900',
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.main',
              color: theme.palette.mode === 'dark' ? 'primary.contrastText' : '#fff',
            }}
          >
            <AccountBalanceWalletOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} letterSpacing={-0.5}>
              Expense tracker
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Osobní finance pod kontrolou
            </Typography>
          </Box>
        </Stack>

        <Typography variant="h4" fontWeight={700} sx={{ mb: 1, maxWidth: 420 }} letterSpacing={-0.5}>
          {title}
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, maxWidth: 400, opacity: 0.9 }}>
          {subtitle}
        </Typography>

        <Stack spacing={2.5}>
          {highlights.map(({ icon: Icon, text }) => (
            <Stack key={text} direction="row" spacing={2} alignItems="flex-start">
              <Box
                sx={{
                  mt: 0.25,
                  color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.dark',
                }}
              >
                <Icon fontSize="small" />
              </Box>
              <Typography variant="body2" sx={{ maxWidth: 360, opacity: 0.92 }}>
                {text}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 3 },
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(6,78,59,0.12) 100%)'
              : 'linear-gradient(180deg, #f8fafc 0%, #ecfdf5 100%)',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 24px 48px rgba(0,0,0,0.35)'
                : '0 20px 40px rgba(15, 118, 110, 0.08)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ display: { xs: 'flex', md: 'none' }, mb: 2 }}>
            <AccountBalanceWalletOutlinedIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Expense tracker
            </Typography>
          </Stack>
          {children}
        </Paper>
      </Box>
    </Box>
  );
};
