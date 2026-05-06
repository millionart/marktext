import { createContentHash, createCacheMetadata, isCacheValid } from '@/services/translation/cacheMetadata'
import { encryptPayload, decryptPayload } from '@/services/translation/cacheCrypto'

describe('translation cache', () => {
  it('validates saved-file cache with mtime and hash', () => {
    const source = { pathname: 'C:/doc.md', markdown: 'Hello', mtimeMs: 10 }
    const config = { baseURL: 'https://api.example.com/v1', model: 'm', targetLanguage: 'Chinese' }
    const metadata = createCacheMetadata(source, config)

    expect(isCacheValid(metadata, source, config)).to.equal(true)
    expect(isCacheValid(metadata, { ...source, mtimeMs: 11 }, config)).to.equal(false)
  })

  it('validates unsaved cache by hash', () => {
    const source = { id: 'untitled-1', markdown: 'Hello' }
    const config = { baseURL: 'https://api.example.com/v1', model: 'm', targetLanguage: 'Chinese' }
    const metadata = createCacheMetadata(source, config)

    expect(metadata.contentHash).to.equal(createContentHash('Hello'))
    expect(isCacheValid(metadata, { ...source, markdown: 'Changed' }, config)).to.equal(false)
  })

  it('encrypts payload without raw markdown appearing in ciphertext', () => {
    const encrypted = encryptPayload('translated markdown', 'local-secret')

    expect(JSON.stringify(encrypted)).to.not.contain('translated markdown')
    expect(decryptPayload(encrypted, 'local-secret')).to.equal('translated markdown')
  })
})
