import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * MongoDB documents are serialised with `_id`, but every screen and every
 * interface in `src/types` reads `id`. Mirror `_id` onto `id` for the whole
 * payload (including populated sub-documents such as `referringDoctor`)
 * so list keys, row actions and detail links resolve instead of yielding
 * `undefined`.
 */
const normalizeIds = (value: any, seen = new WeakSet()): any => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeIds(item, seen));
  }

  // Only walk plain objects: leave Date, File, Blob and class instances intact.
  if (value === null || typeof value !== 'object') return value;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;

  if (seen.has(value)) return value;
  seen.add(value);

  for (const key of Object.keys(value)) {
    value[key] = normalizeIds(value[key], seen);
  }

  if (value._id !== undefined && value.id === undefined) {
    value.id = typeof value._id === 'string' ? value._id : String(value._id);
  }

  return value;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const resData = normalizeIds(response.data);
    if (resData && resData.success !== undefined && resData.data !== undefined) {
      const payload = resData.data;
      // Attach pagination to arrays too - list endpoints return `data` as an
      // array, and dropping meta there left every table stuck on one page.
      if (resData.meta && typeof payload === 'object' && payload !== null) {
        payload.meta = resData.meta;
        payload.pagination = resData.meta;
      }
      return payload;
    }
    return resData;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Clearing storage alone left the shell on screen with every request
      // failing behind it. An Admin can now revoke a session mid-shift
      // (password reset, role change, deactivation), so send the browser back
      // to the sign-in screen instead of leaving a dead page up.
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
