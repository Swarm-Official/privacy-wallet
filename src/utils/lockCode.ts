/**
 * The shape of the lock code, in one place, so the screen that sets it and the
 * screen that asks for it agree.
 *
 * The comparison itself is deliberately not here: the stored hash lives in the
 * main process, which is the only place that reads it (`lock:verify` and the
 * lock-code block in public/electron.js). These functions decide whether a code
 * is worth sending at all, and what a screen says while a wrong code has put
 * the wallet into a wait.
 */

export const LOCK_CODE_MIN_LENGTH = 6;
export const LOCK_CODE_MAX_LENGTH = 12;

export type LockCodeCheck = { ok: true; code: string } | { ok: false; reason: string };

/** Digits only, and long enough to be worth typing. */
export function checkLockCode(value: string): LockCodeCheck {
  const code = value.trim();
  if (!/^[0-9]+$/.test(code)) return { ok: false, reason: "Use digits only." };
  if (code.length < LOCK_CODE_MIN_LENGTH) {
    return { ok: false, reason: `Use at least ${LOCK_CODE_MIN_LENGTH} digits.` };
  }
  if (code.length > LOCK_CODE_MAX_LENGTH) {
    return { ok: false, reason: `Use at most ${LOCK_CODE_MAX_LENGTH} digits.` };
  }
  return { ok: true, code };
}

/** What the lock screen says while a wait is running. */
export function describeLockWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
  const minutes = Math.ceil(seconds / 60);
  return `Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
