import http from '@/axios'

const requiredFields = ['baseURL', 'apiKey', 'model', 'targetLanguage']

export const validateLlmConfig = config => {
  for (const field of requiredFields) {
    if (!config || !String(config[field] || '').trim()) {
      throw new Error(`Missing LLM ${field}`)
    }
  }
}

const normalizeBaseURL = baseURL => baseURL.replace(/\/+$/, '')

const buildUserPrompt = (targetLanguage, blocks) => {
  const payload = blocks.map(block => ({
    id: block.id,
    markdown: block.text,
    translatable: block.translatable
  }))

  return [
    `Translate the translatable Markdown blocks to ${targetLanguage}.`,
    'Return a JSON array with the same number of items and the same id order.',
    'For non-translatable blocks, return the original markdown unchanged.',
    'Preserve Markdown syntax, links, tables, frontmatter, and fenced code blocks.',
    JSON.stringify(payload)
  ].join('\n\n')
}

export const buildChatCompletionsRequest = ({ config, blocks }) => {
  validateLlmConfig(config)

  return {
    url: `${normalizeBaseURL(config.baseURL)}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: {
      model: config.model,
      temperature: 0.2,
      messages: [{
        role: 'system',
        content: 'You translate Markdown while preserving document structure.'
      }, {
        role: 'user',
        content: buildUserPrompt(config.targetLanguage, blocks)
      }]
    }
  }
}

const parseTranslatedBlocks = content => {
  const trimmed = String(content || '').trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const jsonText = fenced
    ? fenced[1]
    : trimmed.slice(trimmed.indexOf('['), trimmed.lastIndexOf(']') + 1)
  const parsed = JSON.parse(jsonText)
  if (!Array.isArray(parsed)) {
    throw new Error('LLM translation response is not a JSON array')
  }

  return parsed.map(item => item.markdown || item.text || '')
}

export const createOpenAICompatibleClient = config => ({
  async translateBlocks (blocks) {
    const request = buildChatCompletionsRequest({ config, blocks })
    const response = await http.post(request.url, request.body, {
      headers: request.headers
    })
    const content = response &&
      response.data &&
      response.data.choices &&
      response.data.choices[0] &&
      response.data.choices[0].message &&
      response.data.choices[0].message.content

    if (!content) {
      throw new Error('LLM translation response is empty')
    }

    return parseTranslatedBlocks(content)
  }
})
