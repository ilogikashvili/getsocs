export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: 'Password must include at least one uppercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: 'Password must include at least one number.' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};:'"\\|,.<>/?`~]/.test(password)) {
    return { ok: false, message: 'Password must include at least one symbol.' };
  }
  return { ok: true };
}
