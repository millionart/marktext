import crypto from 'crypto'

const VERSION = 1
const ALGORITHM = 'aes-256-gcm'

const deriveKey = secret => {
  return crypto
    .createHash('sha256')
    .update(String(secret || ''), 'utf8')
    .digest()
}

export const encryptPayload = (payload, secret) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(secret), iv)
  const ciphertext = Buffer.concat([
    cipher.update(String(payload || ''), 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()

  return {
    version: VERSION,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }
}

export const decryptPayload = (encrypted, secret) => {
  if (!encrypted || encrypted.version !== VERSION) {
    throw new Error('Unsupported translation cache payload version')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    deriveKey(secret),
    Buffer.from(encrypted.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8')
}
