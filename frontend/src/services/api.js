import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

// Response interceptor — unwrap the standard TeleDrive response format
api.interceptors.response.use(
  (response) => {
    // For file downloads, return the raw response
    if (response.config.responseType === 'blob') {
      return response
    }
    return response.data
  },
  (error) => {
    const message = error.response?.data?.error?.message || error.message || 'Request failed'
    const code = error.response?.data?.error?.code || 'REQUEST_FAILED'
    return Promise.reject({ message, code, status: error.response?.status })
  }
)

export default api