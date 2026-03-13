import { createHash } from 'crypto'

/**
 * Hash a PIN using SHA-256.
 * Used together with rate limiting to protect 6-digit PINs.
 */
export function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex')
}
