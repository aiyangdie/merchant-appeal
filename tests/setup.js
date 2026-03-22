process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.NODE_ENV = 'test';

expect.extend({
  toBeValidPhone(received) {
    const pass = /^1[3-9]\d{9}$/.test(received);
    return {
      pass,
      message: () => `expected ${received} ${pass ? 'not' : ''} to be a valid phone number`
    };
  }
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
});
