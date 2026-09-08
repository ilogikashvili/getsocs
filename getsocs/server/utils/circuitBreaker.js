/**
 * Lightweight in-process circuit breaker for external dependencies.
 * CLOSED -> OPEN after consecutive failures -> HALF_OPEN after reset timeout.
 * This intentionally avoids introducing Redis or a new runtime dependency;
 * breaker state is per-process and should be replaced/shared when the app
 * becomes multi-instance.
 */
class CircuitOpenError extends Error {
  constructor(name) {
    super(`${name} circuit is open`);
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
  }
}

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = Number(options.failureThreshold || 5);
    this.resetTimeoutMs = Number(options.resetTimeoutMs || 30_000);
    this.failures = 0;
    this.state = 'CLOSED';
    this.openedAt = 0;
    this.halfOpenProbeInFlight = false;
  }

  canAttempt() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
      this.halfOpenProbeInFlight = false;
    }
    if (this.state === 'HALF_OPEN' && !this.halfOpenProbeInFlight) {
      this.halfOpenProbeInFlight = true;
      return true;
    }
    return false;
  }

  success() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.openedAt = 0;
    this.halfOpenProbeInFlight = false;
  }

  failure() {
    this.halfOpenProbeInFlight = false;
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  async execute(operation) {
    if (!this.canAttempt()) throw new CircuitOpenError(this.name);
    try {
      const result = await operation();
      this.success();
      return result;
    } catch (error) {
      this.failure();
      throw error;
    }
  }

  snapshot() {
    return { name: this.name, state: this.state, failures: this.failures, openedAt: this.openedAt || null };
  }
}

module.exports = { CircuitBreaker, CircuitOpenError };
