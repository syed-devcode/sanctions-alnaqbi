import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('ss_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ss_token')
      localStorage.removeItem('ss_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
}

export const searchAPI = {
  search: (q) => api.get('/search', { params: { q } }),
}

export const auditAPI = {
  getLogs: (page = 1) => api.get('/audit', { params: { page, limit: 50 } }),
}

export const reportAPI = {
  generate: (data) => api.post('/report', data, { responseType: 'blob' }),
}

export const syncAPI = {
  trigger: (source = 'ALL') => api.post('/sync', { source }),
  getLogs: () => api.get('/sync/logs'),
}

export const usersAPI = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  resetPassword: (id, password) => api.put(`/users/${id}/password`, { password }),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  updateStatus: (id, is_active) => api.put(`/users/${id}/status`, { is_active }),
}

export default api
