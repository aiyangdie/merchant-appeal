import storage from '../utils/storage'

class AuthExpiredError extends Error {
  constructor(message = '登录已过期') {
    super(message)
    this.name = 'AuthExpiredError'
  }
}

class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.needRecharge = data.needRecharge || false
    this.needLogin = data.needLogin || status === 401
  }
}

class ApiClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL
    this._onAuthExpired = null
  }

  onAuthExpired(callback) {
    this._onAuthExpired = callback
  }

  getHeaders() {
    const h = { 'Content-Type': 'application/json' }
    const token = storage.getToken()
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }

  async request(url, options = {}) {
    const res = await fetch(this.baseURL + url, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    })

    if (res.status === 401) {
      if (this._onAuthExpired) this._onAuthExpired()
      throw new AuthExpiredError()
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new ApiError(errData.error || `请求失败(${res.status})`, res.status, errData)
    }

    return res
  }

  async get(url) {
    const res = await this.request(url)
    return res.json()
  }

  async post(url, body = {}) {
    const res = await this.request(url, { method: 'POST', body: JSON.stringify(body) })
    return res.json()
  }

  async put(url, body = {}) {
    const res = await this.request(url, { method: 'PUT', body: JSON.stringify(body) })
    return res.json()
  }

  async del(url) {
    const res = await this.request(url, { method: 'DELETE' })
    return res.json()
  }

  async stream(url, body = {}) {
    return this.request(url, { method: 'POST', body: JSON.stringify(body) })
  }
}

export const api = new ApiClient()
export { AuthExpiredError, ApiError }
export default ApiClient
