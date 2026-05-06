<template>
  <div class="pref-llm">
    <h4>LLM</h4>
    <compound>
      <template #head>
        <h6 class="title">OpenAI-compatible translation:</h6>
      </template>
      <template #children>
        <text-box
          description="Base URL"
          notes="Use an OpenAI-compatible endpoint, for example https://api.openai.com/v1 or https://api.deepseek.com/v1."
          :input="llmBaseURL"
          :onChange="value => onSelectChange('llmBaseURL', value)"
        ></text-box>
        <text-box
          description="API key"
          notes="This value is stored in the MarkText preferences JSON."
          :input="llmApiKey"
          :onChange="value => onSelectChange('llmApiKey', value)"
        ></text-box>
        <text-box
          description="Model"
          :input="llmModel"
          :onChange="value => onSelectChange('llmModel', value)"
        ></text-box>
        <text-box
          description="Target language"
          :input="llmTargetLanguage"
          :onChange="value => onSelectChange('llmTargetLanguage', value)"
        ></text-box>
      </template>
    </compound>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Compound from '../common/compound'
import TextBox from '../common/textBox'

export default {
  components: {
    Compound,
    TextBox
  },
  computed: {
    ...mapState({
      llmBaseURL: state => state.preferences.llmBaseURL,
      llmApiKey: state => state.preferences.llmApiKey,
      llmModel: state => state.preferences.llmModel,
      llmTargetLanguage: state => state.preferences.llmTargetLanguage
    })
  },
  methods: {
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
}
</script>
