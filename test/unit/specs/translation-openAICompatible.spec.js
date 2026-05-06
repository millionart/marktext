import { validateLlmConfig, buildChatCompletionsRequest } from '@/services/translation/openAICompatible'

describe('OpenAI-compatible translation requests', () => {
  it('requires baseURL, apiKey, model, and targetLanguage', () => {
    expect(() => validateLlmConfig({
      baseURL: '',
      apiKey: 'k',
      model: 'm',
      targetLanguage: 'Chinese'
    })).to.throw('baseURL')
    expect(() => validateLlmConfig({
      baseURL: 'https://api.example.com/v1',
      apiKey: '',
      model: 'm',
      targetLanguage: 'Chinese'
    })).to.throw('apiKey')
    expect(() => validateLlmConfig({
      baseURL: 'https://api.example.com/v1',
      apiKey: 'k',
      model: '',
      targetLanguage: 'Chinese'
    })).to.throw('model')
    expect(() => validateLlmConfig({
      baseURL: 'https://api.example.com/v1',
      apiKey: 'k',
      model: 'm',
      targetLanguage: ''
    })).to.throw('targetLanguage')
  })

  it('builds a chat completions request', () => {
    const request = buildChatCompletionsRequest({
      config: {
        baseURL: 'https://api.example.com/v1/',
        apiKey: 'secret',
        model: 'model-a',
        targetLanguage: 'Chinese'
      },
      blocks: [{ id: 0, text: 'Hello', translatable: true }]
    })

    expect(request.url).to.equal('https://api.example.com/v1/chat/completions')
    expect(request.headers.Authorization).to.equal('Bearer secret')
    expect(request.body.model).to.equal('model-a')
    expect(request.body.messages[1].content).to.contain('Hello')
    expect(request.body.messages[1].content).to.contain('Chinese')
  })
})
