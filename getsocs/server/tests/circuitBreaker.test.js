const { CircuitBreaker, CircuitOpenError } = require('../utils/circuitBreaker');

describe('CircuitBreaker', () => {
  test('opens after repeated failures and recovers through a half-open probe', async () => {
    const breaker = new CircuitBreaker('test-dependency', { failureThreshold: 2, resetTimeoutMs: 10 });
    let attempts = 0;
    const failing = () => breaker.execute(async () => { attempts += 1; throw new Error('down'); });

    await expect(failing()).rejects.toThrow('down');
    await expect(failing()).rejects.toThrow('down');
    expect(breaker.snapshot().state).toBe('OPEN');
    await expect(failing()).rejects.toBeInstanceOf(CircuitOpenError);
    expect(attempts).toBe(2); // open circuit fails fast without calling dependency

    await new Promise(resolve => setTimeout(resolve, 15));
    await expect(breaker.execute(async () => 'ok')).resolves.toBe('ok');
    expect(breaker.snapshot().state).toBe('CLOSED');
    expect(breaker.snapshot().failures).toBe(0);
  });
});
