import axios from 'axios'

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001'

export const http = axios.create({ baseURL: API_BASE })

function getTokens() {
  return {
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
  }
}

function setTokens(accessToken?: string | null, refreshToken?: string | null) {
  if (typeof accessToken === 'string') localStorage.setItem('accessToken', accessToken)
  if (accessToken === null) localStorage.removeItem('accessToken')
  if (typeof refreshToken === 'string') localStorage.setItem('refreshToken', refreshToken)
  if (refreshToken === null) localStorage.removeItem('refreshToken')
}

let isRefreshing = false
let pending: Array<{ resolve: (t: string) => void; reject: (e: any) => void }> = []

http.interceptors.request.use((config) => {
  const { accessToken } = getTokens()
  if (accessToken) {
    config.headers = config.headers || {}
    ;(config.headers as any).Authorization = `Bearer ${accessToken}`
  }
  return config
})

http.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken } = getTokens()
      if (!refreshToken) throw error
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pending.push({ resolve, reject })
        })
          .then((token: string) => {
            original.headers.Authorization = `Bearer ${token}`
            return http(original)
          })
          .catch((e) => Promise.reject(e))
      }
      isRefreshing = true
      try {
        const resp = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefresh } = resp.data || {}
        setTokens(accessToken, newRefresh)
        pending.splice(0).forEach((p) => p.resolve(accessToken))
        original.headers.Authorization = `Bearer ${accessToken}`
        return http(original)
      } catch (e) {
        pending.splice(0).forEach((p) => p.reject(e))
        setTokens(null, null)
        // Redirect to login on refresh failure
        if (typeof window !== 'undefined') {
          window.location.assign('/login')
        }
        throw e
      } finally {
        isRefreshing = false
      }
    }
    throw error
  }
)

export function saveTokens(accessToken: string, refreshToken: string) {
  setTokens(accessToken, refreshToken)
}

export function clearTokens() {
  setTokens(null, null)
}
