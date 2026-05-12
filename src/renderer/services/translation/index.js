import { splitMarkdownForTranslation, mergeTranslatedBlocks } from './blockSplitter'
import { encryptPayload, decryptPayload } from './cacheCrypto'
import { createBlockHash, createCacheMetadata, isCacheValid } from './cacheMetadata'
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

const canReuseCachedBlocks = (cachedMetadata, metadata) => {
  return cachedMetadata &&
    cachedMetadata.sourceId === metadata.sourceId &&
    cachedMetadata.baseURL === metadata.baseURL &&
    cachedMetadata.model === metadata.model &&
    cachedMetadata.targetLanguage === metadata.targetLanguage &&
    Array.isArray(cachedMetadata.blockHashes)
}

const createTranslationPlan = (blocks, cached, metadata, secret) => {
  const translatedBlocks = new Array(blocks.length)
  const blocksToTranslate = []

  if (!cached || !canReuseCachedBlocks(cached.metadata, metadata)) {
    blocks.forEach((block, index) => {
      if (block.translatable) {
        blocksToTranslate.push(Object.assign({ originalIndex: index }, block))
      } else {
        translatedBlocks[index] = block.text
      }
    })
    return { translatedBlocks, blocksToTranslate, reusedBlockCount: 0 }
  }

  const cachedTranslatedBlocks = splitMarkdownForTranslation(decryptPayload(cached.payload, secret))
  const reusableTranslationsByHash = cached.metadata.blockHashes.reduce((acc, hash, index) => {
    const translatedBlock = cachedTranslatedBlocks[index]
    if (translatedBlock && typeof translatedBlock.text === 'string') {
      if (!acc[hash]) {
        acc[hash] = []
      }
      acc[hash].push(translatedBlock.text)
    }
    return acc
  }, {})
  let reusedBlockCount = 0

  blocks.forEach((block, index) => {
    const blockHash = createBlockHash(block)
    const reusableTranslations = reusableTranslationsByHash[blockHash]
    if (reusableTranslations && reusableTranslations.length) {
      translatedBlocks[index] = block.translatable
        ? reusableTranslations.shift()
        : block.text
      reusedBlockCount++
    } else if (block.translatable) {
      blocksToTranslate.push(Object.assign({ originalIndex: index }, block))
    } else {
      translatedBlocks[index] = block.text
    }
  })

  return { translatedBlocks, blocksToTranslate, reusedBlockCount }
}

const mergePartialPlannedBlocks = (blocks, translatedBlocks, marker = 'Translating...') => {
  const result = []

  for (let index = 0; index < blocks.length; index++) {
    if (typeof translatedBlocks[index] !== 'string') {
      break
    }

    result.push(`${blocks[index].separatorBefore || ''}${translatedBlocks[index]}`)
  }

  if (!result.length) {
    return marker
  }
  return `${result.join('')}\n\n${marker}`
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

  const cached = !force ? await cache.read(metadata.cacheKey) : null
  if (!force) {
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
  const {
    translatedBlocks,
    blocksToTranslate,
    reusedBlockCount
  } = createTranslationPlan(blocks, cached, metadata, secret)
  const chunks = chunkBlocks(blocksToTranslate)
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]
    onProgress({
      phase: 'chunk-start',
      chunkIndex,
      chunkCount: chunks.length,
      translatedBlockCount: translatedBlocks.filter(text => typeof text === 'string').length,
      reusedBlockCount,
      totalBlockCount: blocks.length,
      totalChangedBlockCount: blocksToTranslate.length,
      latestText: ''
    })

    const chunkTranslations = await client.translateBlocks(chunk)
    for (let index = 0; index < chunkTranslations.length; index++) {
      const translatedBlock = chunkTranslations[index]
      const sourceBlock = chunk[index]
      translatedBlocks[sourceBlock.originalIndex] = translatedBlock
      onProgress({
        phase: 'block-finished',
        chunkIndex,
        chunkCount: chunks.length,
        translatedBlockCount: translatedBlocks.filter(text => typeof text === 'string').length,
        reusedBlockCount,
        totalBlockCount: blocks.length,
        totalChangedBlockCount: blocksToTranslate.length,
        latestText: translatedBlock,
        partialMarkdown: mergePartialPlannedBlocks(blocks, translatedBlocks)
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
