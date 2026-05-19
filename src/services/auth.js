import storage from '../utils/storage'

export function saveToken(token) {
  storage.setToken(token)
}

export function getToken() {
  return storage.getToken()
}

export function clearAuth() {
  storage.setToken('')
  storage.remove('user')
  storage.remove('session_id')
}

export function saveUser(user) {
  storage.set('user', user)
}

export function getUser() {
  return storage.get('user')
}

export function saveSessionId(sid) {
  storage.set('session_id', sid)
}

export function getSessionId() {
  return storage.get('session_id')
}

export function removeSessionId() {
  storage.remove('session_id')
}
