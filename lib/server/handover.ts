import crypto from 'crypto'
import { requireServerEnv } from '@/lib/env'

const key = () => crypto.createHash('sha256').update(requireServerEnv('DELIVERY_HANDOVER_SECRET')).digest()

export function generateHandoverCode() {
  return crypto.randomInt(100000, 1_000_000).toString()
}

export function hashHandoverCode(code: string) {
  return crypto.createHmac('sha256', key()).update(code).digest('hex')
}

export function encryptHandoverCode(code: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptHandoverCode(value: string) {
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
  if (!iv || !tag || !ciphertext) throw new Error('Invalid handover code.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
