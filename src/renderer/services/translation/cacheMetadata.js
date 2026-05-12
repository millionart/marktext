import crypto from 'crypto'
import { splitMarkdownForTranslation } from './blockSplitter'

const normalize = value => String(value || '').trim()

export const createContentHash = markdown => {
  return crypto
    .createHash('sha256')
    .update(String(markdown || ''), 'utf8')
    .digest('hex')
}

export const createBlockHash = block => {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      text: block && block.text,
      translatable: !!(block && block.translatable)
    }), 'utf8')
    .digest('hex')
}

export const createBlockHashes = markdown => {
  return splitMarkdownForTranslation(markdown).map(createBlockHash)
}

export const createCacheMetadata = (source, config) => {
  const pathname = normalize(source.pathname)
  const sourceId = pathname || normalize(source.id)
  const contentHash = createContentHash(source.markdown)
  const metadata = {
    version: 1,
    sourceId,
    pathname,
    contentHash,
    baseURL: normalize(config.baseURL),
    model: normalize(config.model),
    targetLanguage: normalize(config.targetLanguage),
    blockHashes: createBlockHashes(source.markdown),
    complete: true
  }

  if (typeof source.mtimeMs === 'number') {
    metadata.mtimeMs = source.mtimeMs
  }

  metadata.cacheKey = crypto
    .createHash('sha256')
    .update([
      metadata.sourceId,
      metadata.baseURL,
      metadata.model,
      metadata.targetLanguage
    ].join('\n'), 'utf8')
    .digest('hex')

  return metadata
}

export const isCacheValid = (metadata, source, config) => {
  if (!metadata || metadata.complete === false) {
    return false
  }

  const next = createCacheMetadata(source, config)
  const hasSavedPath = !!normalize(source.pathname)
  const sameBase = metadata.contentHash === next.contentHash &&
    metadata.baseURL === next.baseURL &&
    metadata.model === next.model &&
    metadata.targetLanguage === next.targetLanguage &&
    metadata.sourceId === next.sourceId

  if (!sameBase) {
    return false
  }

  return !hasSavedPath || metadata.mtimeMs === next.mtimeMs
}
