<template>
    <div
      class="editor-with-tabs"
      :style="{'max-width': showSideBar ? `calc(100vw - ${sideBarWidth}px` : '100vw' }"
    >
      <tabs v-show="showTabBar"></tabs>
      <div
        class="container"
        :class="{ 'translation-open': translationVisible }"
      >
        <button
          class="translation-toggle"
          type="button"
          :disabled="translationLoading"
          @click="handleTranslate"
        >
          Translate
        </button>
        <editor
          ref="editor"
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
          :platform="platform"
        ></editor>
        <source-code
          v-if="sourceCode"
          ref="sourceCode"
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
        ></source-code>
        <translation-panel
          v-if="translationVisible"
          :key="translationPanelKey"
          ref="translationPanel"
          :markdown="translationMarkdown"
          :loading="translationLoading"
          :progress-text="translationProgress"
          :from-cache="translationFromCache"
          :error="translationError"
          :font-family="editorFontFamily"
          :default-font-family="defaultEditorFontFamily"
          :font-size="fontSize"
          :line-height="lineHeight"
          :code-font-family="codeFontFamily"
          :default-code-font-family="defaultCodeFontFamily"
          :code-font-size="codeFontSize"
          @force="handleForceTranslate"
          @close="closeTranslation"
          @rendered="handleTranslationRendered"
        ></translation-panel>
      </div>
      <tab-notifications></tab-notifications>
    </div>
</template>

<script>
import { mapState } from 'vuex'
import fs from 'fs-extra'
import bus from '@/bus'
import notice from '@/services/notification'
import { translateDocument } from '@/services/translation'
import { createOpenAICompatibleClient } from '@/services/translation/openAICompatible'
import { createTranslationFileCache, getOrCreateCacheSecret } from '@/services/translation/fileCache'
import { DEFAULT_CODE_FONT_FAMILY, DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import TranslationPanel from './translationPanel.vue'

const clampScrollTop = (scrollTop, max) => Math.max(0, Math.min(scrollTop, max))

const getAnchorSegmentIndex = (scrollTop, points) => {
  for (let i = points.length - 2; i >= 0; i--) {
    if (scrollTop >= points[i]) {
      return i
    }
  }
  return 0
}

export default {
  props: {
    markdown: {
      type: String,
      required: true
    },
    cursor: {
      validator (value) {
        return typeof value === 'object'
      },
      required: true
    },
    sourceCode: {
      type: Boolean,
      required: true
    },
    showTabBar: {
      type: Boolean,
      required: true
    },
    textDirection: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      required: true
    }
  },
  components: {
    Tabs,
    Editor,
    SourceCode,
    TabNotifications,
    TranslationPanel
  },
  data () {
    return {
      translationVisible: false,
      translationLoading: false,
      translationMarkdown: '',
      translationProgress: '',
      translationFromCache: false,
      translationError: '',
      translationPanelKey: 0,
      syncingScroll: false,
      translationRefreshPending: false,
      ignoredScrollElement: null,
      ignoredScrollTimer: null,
      translationResizeTimer: null,
      editorScrollElement: null,
      translationScrollElement: null,
      defaultEditorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      defaultCodeFontFamily: DEFAULT_CODE_FONT_FAMILY
    }
  },
  computed: {
    ...mapState({
      showSideBar: state => state.layout.showSideBar,
      sideBarWidth: state => state.layout.sideBarWidth,
      currentFile: state => state.editor.currentFile,
      llmBaseURL: state => state.preferences.llmBaseURL,
      llmApiKey: state => state.preferences.llmApiKey,
      llmModel: state => state.preferences.llmModel,
      llmTargetLanguage: state => state.preferences.llmTargetLanguage,
      editorFontFamily: state => state.preferences.editorFontFamily,
      fontSize: state => state.preferences.fontSize,
      lineHeight: state => state.preferences.lineHeight,
      codeFontFamily: state => state.preferences.codeFontFamily,
      codeFontSize: state => state.preferences.codeFontSize
    })
  },
  created () {
    bus.$on('translation:translate', this.handleTranslate)
  },
  beforeDestroy () {
    bus.$off('translation:translate', this.handleTranslate)
    this.detachScrollSync()
  },
  methods: {
    getLlmConfig () {
      return {
        baseURL: this.llmBaseURL,
        apiKey: this.llmApiKey,
        model: this.llmModel,
        targetLanguage: this.llmTargetLanguage
      }
    },

    async getTranslationSource () {
      const { currentFile = {}, markdown } = this
      const source = {
        id: currentFile.id || 'untitled',
        pathname: currentFile.pathname || '',
        markdown
      }

      if (source.pathname && await fs.pathExists(source.pathname)) {
        const stat = await fs.stat(source.pathname)
        source.mtimeMs = stat.mtimeMs
      }

      return source
    },

    handleForceTranslate () {
      return this.handleTranslate({ force: true })
    },

    async handleTranslate (options = {}) {
      if (this.translationLoading) {
        return
      }

      this.translationVisible = true
      this.$nextTick(this.recoverEditorDomIfCleared)
      this.translationLoading = true
      this.translationError = ''
      this.translationProgress = ''
      this.translationFromCache = false

      try {
        const config = this.getLlmConfig()
        const source = await this.getTranslationSource()
        const result = await translateDocument({
          source,
          config,
          cache: createTranslationFileCache(),
          client: createOpenAICompatibleClient(config),
          secretProvider: getOrCreateCacheSecret,
          force: !!options.force,
          onProgress: this.handleTranslationProgress
        })

        this.applyTranslationResult(result)
      } catch (err) {
        this.translationError = err.message || String(err)
        this.translationProgress = ''
        notice.notify({
          title: 'Translation',
          type: 'error',
          message: this.translationError
        })
      } finally {
        this.translationLoading = false
      }
    },

    handleTranslationProgress (progress = {}) {
      if (progress.phase === 'cached') {
        this.translationProgress = 'using cached result'
        return
      }

      if (progress.partialMarkdown) {
        this.translationMarkdown = progress.partialMarkdown
      }

      const total = progress.totalBlockCount || 0
      const done = progress.translatedBlockCount || 0
      const prefix = total > 0 ? `${done}/${total}` : ''
      const latestLine = this.getProgressPreview(progress.latestText)
      this.translationProgress = latestLine
        ? `${prefix} ${latestLine}`.trim()
        : prefix
    },

    getProgressPreview (text = '') {
      const line = String(text || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean)
        .pop() || ''

      return line.length > 80 ? `${line.slice(0, 80)}...` : line
    },

    applyTranslationResult (result) {
      this.translationMarkdown = result.markdown
      this.translationFromCache = result.fromCache
      this.translationRefreshPending = false
      this.translationPanelKey += 1
    },

    handleTranslationRendered () {
      if (this.translationRefreshPending) {
        this.flushTranslationPanel()
      }

      this.$nextTick(() => {
        this.recoverEditorDomIfCleared()
        this.alignTranslationHeadings()
        this.attachScrollSync()
      })
    },

    refreshTranslationPanel () {
      this.translationRefreshPending = true
      this.$nextTick(() => {
        this.flushTranslationPanel()
      })
    },

    flushTranslationPanel () {
      const panel = this.$refs.translationPanel
      if (!panel || !panel.renderMarkdown) {
        return false
      }

      this.translationRefreshPending = false
      panel.renderMarkdown(this.translationMarkdown)
      return true
    },

    recoverEditorDomIfCleared () {
      const ref = this.$refs.editor
      if (ref && ref.recoverEditorDomIfCleared) {
        ref.recoverEditorDomIfCleared()
      }
    },

    closeTranslation () {
      this.translationVisible = false
      this.detachScrollSync()
    },

    getEditorScrollElement () {
      const ref = this.sourceCode ? this.$refs.sourceCode : this.$refs.editor
      return ref && ref.getScrollElement && ref.getScrollElement()
    },

    alignTranslationHeadings () {
      this.editorScrollElement = this.getEditorScrollElement()
      this.translationScrollElement = this.$refs.translationPanel &&
        this.$refs.translationPanel.getScrollElement()

      if (!this.editorScrollElement || !this.$refs.translationPanel) {
        return
      }

      const editorHeadingSelector = '#ag-editor-id h1, #ag-editor-id h2, #ag-editor-id h3, #ag-editor-id h4, #ag-editor-id h5, #ag-editor-id h6'
      const sourceOffsets = this.getHeadingOffsets(this.editorScrollElement, editorHeadingSelector)
      this.$refs.translationPanel.alignHeadingOffsets(sourceOffsets)
    },

    syncScroll (from, to) {
      if (this.syncingScroll || !from || !to) {
        return
      }

      const fromMax = from.scrollHeight - from.clientHeight
      const toMax = to.scrollHeight - to.clientHeight
      if (fromMax <= 0 || toMax <= 0) {
        return
      }

      const anchoredScrollTop = this.getHeadingAlignedScrollTop(from, to, fromMax, toMax)
      this.syncingScroll = true
      to.scrollTop = anchoredScrollTop === null
        ? (from.scrollTop / fromMax) * toMax
        : anchoredScrollTop
      this.ignoreProgrammaticScroll(to)

      let released = false
      const releaseScrollSync = () => {
        if (released) {
          return
        }
        released = true
        this.syncingScroll = false
      }
      window.requestAnimationFrame(releaseScrollSync)
      window.setTimeout(releaseScrollSync, 50)
    },

    ignoreProgrammaticScroll (element) {
      window.clearTimeout(this.ignoredScrollTimer)
      this.ignoredScrollElement = element
      this.ignoredScrollTimer = window.setTimeout(() => {
        if (this.ignoredScrollElement === element) {
          this.ignoredScrollElement = null
        }
      }, 250)
    },

    handleSyncedScrollEvent (from, to) {
      if (this.ignoredScrollElement === from) {
        this.ignoredScrollElement = null
        window.clearTimeout(this.ignoredScrollTimer)
        return
      }

      this.syncScroll(from, to)
    },

    getHeadingAlignedScrollTop (from, to, fromMax, toMax) {
      const { editorScrollElement, translationScrollElement } = this
      const editorHeadingSelector = '#ag-editor-id h1, #ag-editor-id h2, #ag-editor-id h3, #ag-editor-id h4, #ag-editor-id h5, #ag-editor-id h6'
      const translationHeadingSelector = '.translation-heading'
      const viewportOffsetDelta = this.getScrollViewportOffsetDelta(from, to)

      if (from === editorScrollElement && to === translationScrollElement) {
        return this.getAnchoredScrollTop(
          from.scrollTop,
          fromMax,
          toMax,
          this.getHeadingOffsets(editorScrollElement, editorHeadingSelector),
          this.getHeadingOffsets(translationScrollElement, translationHeadingSelector),
          viewportOffsetDelta
        )
      }

      if (from === translationScrollElement && to === editorScrollElement) {
        return this.getAnchoredScrollTop(
          from.scrollTop,
          fromMax,
          toMax,
          this.getHeadingOffsets(translationScrollElement, translationHeadingSelector),
          this.getHeadingOffsets(editorScrollElement, editorHeadingSelector),
          viewportOffsetDelta
        )
      }

      return null
    },

    getAnchoredScrollTop (scrollTop, fromMax, toMax, fromAnchors, toAnchors, viewportOffsetDelta = 0) {
      const anchorCount = Math.min(fromAnchors.length, toAnchors.length)
      if (anchorCount === 0 || fromMax <= 0 || toMax <= 0) {
        return null
      }

      const pairedAnchors = []
      for (let i = 0; i < anchorCount; i++) {
        const fromAnchor = clampScrollTop(fromAnchors[i], fromMax)
        const toAnchor = clampScrollTop(toAnchors[i], toMax)
        if (fromAnchor > 0 && fromAnchor < fromMax) {
          pairedAnchors.push([fromAnchor, toAnchor])
        }
      }

      if (pairedAnchors.length === 0) {
        return null
      }

      const fromPoints = [0, ...pairedAnchors.map(anchor => anchor[0]), fromMax]
      const toPoints = [0, ...pairedAnchors.map(anchor => anchor[1]), toMax]
      const segmentIndex = getAnchorSegmentIndex(scrollTop, fromPoints)
      const fromStart = fromPoints[segmentIndex]
      const fromEnd = fromPoints[segmentIndex + 1]
      const toStart = toPoints[segmentIndex]
      const toEnd = toPoints[segmentIndex + 1]
      const segmentSize = fromEnd - fromStart
      if (segmentSize <= 0) {
        return null
      }

      const segmentRatio = (scrollTop - fromStart) / segmentSize
      return clampScrollTop(toStart + segmentRatio * (toEnd - toStart) + viewportOffsetDelta, toMax)
    },

    getHeadingOffsets (scroller, selector) {
      if (!scroller) {
        return []
      }

      const scrollerRect = scroller.getBoundingClientRect()
      return Array.from(scroller.querySelectorAll(selector))
        .map(element => {
          const rect = element.getBoundingClientRect()
          return rect.top - scrollerRect.top + scroller.scrollTop
        })
        .filter(offset => Number.isFinite(offset))
    },

    getScrollViewportOffsetDelta (from, to) {
      if (!from || !to) {
        return 0
      }

      const fromRect = from.getBoundingClientRect()
      const toRect = to.getBoundingClientRect()
      return toRect.top - fromRect.top
    },

    attachScrollSync () {
      this.detachScrollSync()
      this.editorScrollElement = this.getEditorScrollElement()
      this.translationScrollElement = this.$refs.translationPanel &&
        this.$refs.translationPanel.getScrollElement()

      if (!this.editorScrollElement || !this.translationScrollElement) {
        return
      }

      this.handleEditorScroll = () => this.handleSyncedScrollEvent(this.editorScrollElement, this.translationScrollElement)
      this.handleTranslationScroll = () => this.handleSyncedScrollEvent(this.translationScrollElement, this.editorScrollElement)
      this.editorScrollElement.addEventListener('scroll', this.handleEditorScroll)
      this.translationScrollElement.addEventListener('scroll', this.handleTranslationScroll)
      window.addEventListener('resize', this.handleTranslationResize)
      this.syncScroll(this.editorScrollElement, this.translationScrollElement)
    },

    handleTranslationResize () {
      window.clearTimeout(this.translationResizeTimer)
      this.translationResizeTimer = window.setTimeout(() => {
        if (!this.translationVisible) {
          return
        }

        this.syncingScroll = false
        this.alignTranslationHeadings()
        if (this.editorScrollElement && this.translationScrollElement) {
          this.syncScroll(this.editorScrollElement, this.translationScrollElement)
        }
      }, 80)
    },

    detachScrollSync () {
      window.clearTimeout(this.ignoredScrollTimer)
      this.ignoredScrollTimer = null
      this.ignoredScrollElement = null
      window.clearTimeout(this.translationResizeTimer)
      this.translationResizeTimer = null
      window.removeEventListener('resize', this.handleTranslationResize)
      if (this.editorScrollElement && this.handleEditorScroll) {
        this.editorScrollElement.removeEventListener('scroll', this.handleEditorScroll)
      }
      if (this.translationScrollElement && this.handleTranslationScroll) {
        this.translationScrollElement.removeEventListener('scroll', this.handleTranslationScroll)
      }
      this.editorScrollElement = null
      this.translationScrollElement = null
      this.handleEditorScroll = null
      this.handleTranslationScroll = null
    }
  }
}
</script>

<style scoped>
  .editor-with-tabs {
    position: relative;
    height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;

    overflow: hidden;
    background: var(--editorBgColor);
    & > .container {
      flex: 1;
      display: flex;
      position: relative;
      overflow: hidden;
    }

    & > .container.translation-open {
      & > .editor-wrapper,
      & > .source-code {
        width: 50%;
        flex: 0 0 50%;
      }
    }
  }

  .translation-toggle {
    position: absolute;
    top: 10px;
    right: 14px;
    z-index: 4;
    height: 26px;
    padding: 0 10px;
    border: 1px solid var(--editorColor30);
    color: var(--editorColor);
    background: var(--editorBgColor);
    font-size: 12px;
  }

  .container.translation-open .translation-toggle {
    right: calc(50% + 14px);
  }
</style>
