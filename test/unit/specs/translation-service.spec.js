import { translateDocument } from '@/services/translation'
import { createCacheMetadata } from '@/services/translation/cacheMetadata'
import { encryptPayload } from '@/services/translation/cacheCrypto'

describe('translation service', () => {
  const source = { id: 'doc-1', markdown: 'Hello\n\nWorld' }
  const config = {
    baseURL: 'https://api.example.com/v1',
    apiKey: 'secret',
    model: 'm',
    targetLanguage: 'Chinese'
  }

  it('returns a valid cached translation without calling the client', async () => {
    const metadata = createCacheMetadata(source, config)
    const cache = {
      read: () => ({
        metadata,
        payload: encryptPayload('你好\n\n世界', 'local-secret')
      }),
      write: () => {
        throw new Error('write should not be called')
      }
    }
    const client = {
      translateBlocks: () => {
        throw new Error('client should not be called')
      }
    }

    const result = await translateDocument({
      source,
      config,
      cache,
      client,
      secretProvider: () => 'local-secret'
    })

    expect(result.markdown).to.equal('你好\n\n世界')
    expect(result.fromCache).to.equal(true)
  })

  it('bypasses a valid cache when force is true', async () => {
    const metadata = createCacheMetadata(source, config)
    let clientCalls = 0
    let written = null
    const cache = {
      read: () => ({
        metadata,
        payload: encryptPayload('cached', 'local-secret')
      }),
      write: record => {
        written = record
      }
    }
    const client = {
      translateBlocks: blocks => {
        clientCalls++
        return blocks.map(block => block.text.replace('Hello', '你好').replace('World', '世界'))
      }
    }

    const result = await translateDocument({
      source,
      config,
      cache,
      client,
      secretProvider: () => 'local-secret',
      force: true
    })

    expect(clientCalls).to.equal(1)
    expect(result.markdown).to.equal('你好\n\n世界')
    expect(result.fromCache).to.equal(false)
    expect(written.metadata.contentHash).to.equal(metadata.contentHash)
  })

  it('reports translation progress as blocks finish', async () => {
    const progressEvents = []
    const cache = {
      read: () => null,
      write: () => {}
    }
    const client = {
      translateBlocks: blocks => blocks.map(block => block.text.replace('Hello', '你好').replace('World', '世界'))
    }

    await translateDocument({
      source,
      config,
      cache,
      client,
      secretProvider: () => 'local-secret',
      onProgress: event => progressEvents.push(event)
    })

    expect(progressEvents[0].phase).to.equal('chunk-start')
    expect(progressEvents.some(event => event.phase === 'block-finished' && event.latestText === '你好')).to.equal(true)
    expect(progressEvents.some(event => event.phase === 'block-finished' && event.latestText === '世界')).to.equal(true)
  })

  it('reports partial translated markdown while translation is still running', async () => {
    const progressEvents = []
    const cache = {
      read: () => null,
      write: () => {}
    }
    const client = {
      translateBlocks: blocks => blocks.map(block => block.text.replace('Hello', '你好').replace('World', '世界'))
    }

    await translateDocument({
      source,
      config,
      cache,
      client,
      secretProvider: () => 'local-secret',
      onProgress: event => progressEvents.push(event)
    })

    const firstFinished = progressEvents.find(event => event.phase === 'block-finished')
    expect(firstFinished.partialMarkdown).to.equal('你好\n\nTranslating...')
  })

  it('reuses cached unchanged blocks and translates only changed blocks', async () => {
    const oldSource = { id: 'doc-1', markdown: 'Hello\n\nWorld' }
    const newSource = { id: 'doc-1', markdown: 'Hello\n\nMars' }
    const metadata = createCacheMetadata(oldSource, config)
    let translatedInput = null
    let written = null
    const cache = {
      read: () => ({
        metadata,
        payload: encryptPayload('你好\n\n世界', 'local-secret')
      }),
      write: record => {
        written = record
      }
    }
    const client = {
      translateBlocks: blocks => {
        translatedInput = blocks.map(block => block.text)
        return blocks.map(block => block.text.replace('Mars', '火星'))
      }
    }

    const result = await translateDocument({
      source: newSource,
      config,
      cache,
      client,
      secretProvider: () => 'local-secret'
    })

    expect(translatedInput).to.deep.equal(['Mars'])
    expect(result.markdown).to.equal('你好\n\n火星')
    expect(result.fromCache).to.equal(false)
    expect(written.metadata.contentHash).to.equal(createCacheMetadata(newSource, config).contentHash)
  })

  it('reuses unchanged cached blocks after inserting a new block', async () => {
    const oldSource = { id: 'doc-1', markdown: 'Hello\n\nWorld' }
    const newSource = { id: 'doc-1', markdown: 'Hello\n\nMars\n\nWorld' }
    const metadata = createCacheMetadata(oldSource, config)
    let translatedInput = null
    const cache = {
      read: () => ({
        metadata,
        payload: encryptPayload('你好\n\n世界', 'local-secret')
      }),
      write: () => {}
    }
    const client = {
      translateBlocks: blocks => {
        translatedInput = blocks.map(block => block.text)
        return blocks.map(block => block.text.replace('Mars', '火星'))
      }
    }

    const result = await translateDocument({
      source: newSource,
      config,
      cache,
      client,
      secretProvider: () => 'local-secret'
    })

    expect(translatedInput).to.deep.equal(['Mars'])
    expect(result.markdown).to.equal('你好\n\n火星\n\n世界')
  })
})
