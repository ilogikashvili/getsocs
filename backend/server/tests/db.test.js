jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const { execSync } = require('child_process');

describe('database fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.USE_FILE_DB;
    delete process.env.DB_CMD;
  });

  test('falls back to file DB when MySQL is unavailable', () => {
    execSync.mockImplementation((command) => {
      if (command.includes('which mysql') || command.includes('where mysql')) {
        throw new Error('not found');
      }
      throw new Error('access denied');
    });

    const { shouldUseFileDb } = require('../config/db');

    expect(shouldUseFileDb()).toBe(true);
  });
});
