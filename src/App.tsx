import { router } from '@router/index';
import axios from 'axios';
import { enqueueSnackbar } from 'notistack';
import { RouterProvider } from 'react-router-dom';

axios.defaults.baseURL = `${import.meta.env.VITE_API_URL}/`;

const originalFetch = window.fetch.bind(window);

window.fetch = async (...args) => {
  const [input, init] = args;
  const token = localStorage.getItem('access_token');

  const resolvedHeaders = new Headers(
    input instanceof Request ? input.headers : init?.headers,
  );
  if (token && !resolvedHeaders.has('Authorization')) {
    resolvedHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await originalFetch(input, {
    ...init,
    headers: resolvedHeaders,
  });
  if (response.status === 403) {
    window.dispatchEvent(new CustomEvent('auth:forbidden'));
  }
  return response;
};

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  const headers = config.headers ?? {};
  if (token && !(headers as Record<string, unknown>).Authorization) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  config.headers = headers;
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 403) {
      window.dispatchEvent(new CustomEvent('auth:forbidden'));
    } else if (error.code !== 'ERR_CANCELED') {
      enqueueSnackbar('API error', { variant: 'error' });
    }
    return Promise.reject(error);
  },
);

const App = () => {
  return <RouterProvider router={router} />;
};

export default App;
