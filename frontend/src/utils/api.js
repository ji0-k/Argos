import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

/* 요청 인터셉터 - JWT 토큰 자동 첨부 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* 응답 인터셉터 - 401 시 로그인 페이지 이동 */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

/* ── CCTV API ── */
export const cctvApi = {
  getList: (region) =>
    api.get('/api/cctv/list', { params: region ? { region } : {} }),

  startDetection: (cctvId) =>
    api.post(`/api/cctv/${cctvId}/detection/start`),

  stopDetection: (cctvId, sessionId) =>
    api.post(`/api/cctv/${cctvId}/detection/stop`, { session_id: sessionId }),

  getStreamUrl: (cctvId) =>
    `${BASE_URL}/api/cctv/${cctvId}/stream`,
};

/* ── Logs API ── */
export const logsApi = {
  getAll: (page = 1, limit = 20, type = null) =>
    api.get('/api/logs', { params: { page, limit, ...(type && { type }) } }),

  getByCctv: (cctvId, page = 1, limit = 20) =>
    api.get(`/api/logs/${cctvId}`, { params: { page, limit } }),

  getStats: () =>
    api.get('/api/logs/stats'),
};

/* ── Admin API ── */
export const adminApi = {
  login: (username, password) =>
    api.post('/api/admin/login', { username, password }),

  logout: () =>
    api.post('/api/admin/logout'),

  me: () =>
    api.get('/api/admin/me'),
};

export default api;
