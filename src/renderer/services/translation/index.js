import { splitMarkdownForTranslation, mergeTranslatedBlocks } from './blockSplitter'
import { encryptPayload, decryptPayload } from './cacheCrypto'
import { createCacheMetadata, isCacheValid } from './cacheMetadata'
import { validateLlmConfig } from './openAICompatible'

const MAX_CHUNK_CHARS = 12000

const chunkBlocks = blocks => {
  const chunks = []
  let chunk = []
  let chunkLength = 0

  for (const block of blocks) {
    const blockLength = block.text.length
    if (chunk.length && chunkLength + blockLength > MAX_CHUNK_CHARS) {
      chunks.push(chunk)
      chunk = []
      chunkLength = 0
    }

    chunk.push(block)
    chunkLength += blockLength
  }

  if (chunk.length) {
    chunks.push(chunk)
  }

  return chunks
}

const mergePartialTranslatedBlocks = (blocks, translatedBlocks, marker = 'Translating...') => {
  if (!translatedBlocks.length) {
    return marker
  }

  const completedBlocks = blocks.slice(0, translatedBlocks.length)
  const translatedMarkdown = completedBlocks.map((block, index) => {
    const translated = block.translatable ? translatedBlocks[index] : block.text
    return `${block.separatorBefore || ''}${translated}`
  }).join('')

  return `${translatedMarkdown}\n\n${marker}`
}

export const translateDocument = async ({
  source,
  config,
  cache,
  client,
  secretProvider,
  force = false,
  onProgress = () => {}
}) => {
  validateLlmConfig(config)

  const metadata = createCacheMetadata(source, config)
  const secret = await secretProvider()

  if (!force) {
    const cached = await cache.read(metadata.cacheKey)
    if (cached && isCacheValid(cached.metadata, source, config)) {
      onProgress({
        phase: 'cached',
        translatedBlockCount: 0,
        totalBlockCount: 0,
        latestText: ''
      })
      return {
        markdown: decryptPayload(cached.payload, secret),
        metadata: cached.metadata,
        fromCache: true
      }
    }
  }

  const blocks = splitMarkdownForTranslation(source.markdown)
  const chunks = chunkBlocks(blocks)
  const translatedBlocks = []
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]
    onProgress({
      phase: 'chunk-start',
      chunkIndex,
      chunkCount: chunks.length,
      translatedBlockCount: translatedBlocks.length,
      totalBlockCount: blocks.length,
      latestText: ''
    })

    const chunkTranslations = await client.translateBlocks(chunk)
    for (const translatedBlock of chunkTranslations) {
      translatedBlocks.push(translatedBlock)
      onProgress({
        phase: 'block-finished',
        chunkIndex,
        chunkCount: chunks.length,
        translatedBlockCount: translatedBlocks.length,
        totalBlockCount: blocks.length,
        latestText: translatedBlock,
        partialMarkdown: mergePartialTranslatedBlocks(blocks, translatedBlocks)
      })
    }
  }
  const markdown = mergeTranslatedBlocks(blocks, translatedBlocks)
  const record = {
    metadata,
    payload: encryptPayload(markdown, secret)
  }

  await cache.write(record)

  return {
    markdown,
    metadata,
    fromCache: false
  }
}
