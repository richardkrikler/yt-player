import { Buffer } from "node:buffer"
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

function getKey(): Buffer {
  const raw = process.env.NUXT_TOKEN_ENCRYPTION_KEY ?? ''
  if (!raw) throw new Error('NUXT_TOKEN_ENCRYPTION_KEY is not set')
  return scryptSync(raw, 'yt-player-salt', 32)
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(data: string): string {
  const key = getKey()
  const [ivHex, tagHex, encryptedHex] = data.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
