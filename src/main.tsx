import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { AuthProvider } from '@auth/AuthContext'
import { SnackbarProvider } from 'notistack'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeModeProvider, useThemeMode } from '@components/contexts/ThemeModeContext';
import { UnitDisplayProvider } from '@contexts/UnitDisplayContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const AppWithTheme = () => {
  const { mode } = useThemeMode();
  
  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: '#059669',
        light: '#34d399',
        dark: '#047857',
        contrastText: '#fff',
      },
      secondary: {
        main: '#d97706',
        light: '#fbbf24',
        dark: '#b45309',
      },
      ...(mode === 'light'
        ? {
            background: { default: '#f8fafc', paper: '#ffffff' },
          }
        : {
            background: { default: '#0f172a', paper: '#1e293b' },
          }),
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 },
        },
      },
    },
  })

  return (
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  );
};

const container = document.getElementById('root');

if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <ThemeModeProvider>
      <UnitDisplayProvider>
        <SnackbarProvider maxSnack={3}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppWithTheme />
            </AuthProvider>
          </QueryClientProvider>
        </SnackbarProvider>
      </UnitDisplayProvider>
    </ThemeModeProvider>
  </StrictMode>
);

