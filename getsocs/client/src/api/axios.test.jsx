describe('axios API base URL', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('uses the current origin when the app is hosted', () => {
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          hostname: 'example.com',
          origin: 'https://example.com',
        },
      },
      configurable: true,
      writable: true,
    });

    const { getApiBaseUrl } = require('./axios');
    expect(getApiBaseUrl()).toBe('https://example.com/api');
  });

  it('keeps the local backend fallback for local development', () => {
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          hostname: 'localhost',
          origin: 'http://localhost:3000',
        },
      },
      configurable: true,
      writable: true,
    });

    const { getApiBaseUrl } = require('./axios');
    expect(getApiBaseUrl()).toBe('http://localhost:3001/api');
  });
});
