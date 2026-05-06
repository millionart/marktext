import defaultPreferences from '../../../static/preference.json'
import preferenceSchema from '../../../src/main/preferences/schema.json'

describe('LLM preferences', () => {
  const keys = ['llmBaseURL', 'llmApiKey', 'llmModel', 'llmTargetLanguage']

  it('defines default string preferences', () => {
    keys.forEach(key => {
      expect(defaultPreferences).to.have.property(key)
      expect(defaultPreferences[key]).to.be.a('string')
    })
    expect(defaultPreferences.llmTargetLanguage).to.equal('Chinese')
  })

  it('defines schema entries grouped under LLM', () => {
    keys.forEach(key => {
      expect(preferenceSchema).to.have.property(key)
      expect(preferenceSchema[key].type).to.equal('string')
      expect(preferenceSchema[key].description).to.match(/^LLM--/)
    })
  })
})
