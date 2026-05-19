import { createJwtAuth } from '../../server/http/jwtAuth.js'

const SECRET = 'test-jwt-secret-key-min-32-chars-long!!'

describe('createJwtAuth', () => {
  const auth = createJwtAuth(SECRET, '1h')

  it('signs and verifies user token', () => {
    const token = auth.signToken({ userId: 42, role: 'user' })
    expect(typeof token).toBe('string')
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = { status: () => res, json: () => {} }
    let nextCalled = false
    auth.requireUser(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
    expect(req.userId).toBe(42)
  })

  it('rejects missing bearer', () => {
    const req = { headers: {} }
    let status = 0
    const res = {
      status(c) { status = c; return res },
      json() {},
    }
    auth.requireUser(req, res, () => {})
    expect(status).toBe(401)
  })

  it('verifyAdminToken accepts admin role only', () => {
    const adminToken = auth.signToken({ id: 1, username: 'a', role: 'admin' })
    expect(auth.verifyAdminToken(adminToken)).toBeTruthy()
    const userToken = auth.signToken({ userId: 1, role: 'user' })
    expect(auth.verifyAdminToken(userToken)).toBeNull()
  })
})
