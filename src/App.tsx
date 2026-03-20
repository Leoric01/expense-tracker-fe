import { router } from '@router/index';
import axios from 'axios';
import { enqueueSnackbar } from 'notistack';
import { RouterProvider } from 'react-router-dom';

axios.defaults.baseURL = `${import.meta.env.VITE_API_URL}/`;

const originalFetch = window.fetch.bind(window);

window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 403) {
    window.dispatchEvent(new CustomEvent('auth:forbidden'));
  }
  return response;
};

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
