<template>
  <section class="translation-panel">
    <div class="translation-panel__toolbar">
      <span>{{ statusText }}</span>
      <button
        class="translation-panel__button translation-panel__button--weak"
        type="button"
        :disabled="loading"
        @click="$emit('force')"
      >
        Retranslate
      </button>
      <button
        class="translation-panel__button"
        type="button"
        @click="$emit('close')"
      >
        Close
      </button>
    </div>
    <div
      class="translation-panel__content"
    >
      <div
        ref="editorHost"
        class="translation-panel__editor"
        :style="editorStyle"
        v-once
      ></div>
    </div>
  </section>
</template>

<script>
import Muya from 'muya/lib'
import { DEFAULT_CODE_FONT_FAMILY, DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import 'muya/themes/default.css'

const buildFontStack = (fontFamily, defaultFontFamily) => {
  return fontFamily ? `${fontFamily}, ${defaultFontFamily}` : `${defaultFontFamily}`
}

export default {
  props: {
    markdown: {
      type: String,
      default: ''
    },
    loading: {
      type: Boolean,
      default: false
    },
    progressText: {
      type: String,
      default: ''
    },
    fromCache: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: ''
    },
    fontFamily: {
      type: String,
      default: ''
    },
    defaultFontFamily: {
      type: String,
      default: DEFAULT_EDITOR_FONT_FAMILY
    },
    fontSize: {
      type: [Number, String],
      default: 16
    },
    lineHeight: {
      type: [Number, String],
      default: 1.6
    },
    codeFontFamily: {
      type: String,
      default: ''
    },
    defaultCodeFontFamily: {
      type: String,
      default: DEFAULT_CODE_FONT_FAMILY
    },
    codeFontSize: {
      type: [Number, String],
      default: 14
    }
  },

  data () {
    return {
      editor: null,
      readonlyInputHandlers: []
    }
  },

  computed: {
    statusText () {
      if (this.error) return `Translation failed: ${this.error}`
      if (this.loading) {
        return this.progressText
          ? `Translating... ${this.progressText}`
          : 'Translating...'
      }
      if (this.fromCache) return 'Cached translation'
      return 'Translation'
    },

    editorStyle () {
      return {
        fontFamily: buildFontStack(this.fontFamily, this.defaultFontFamily),
        fontSize: `${this.fontSize}px`,
        lineHeight: this.lineHeight,
        '--translation-code-font-family': buildFontStack(this.codeFontFamily, this.defaultCodeFontFamily),
        '--translation-code-font-size': `${this.codeFontSize}px`
      }
    }
  },

  watch: {
    markdown: {
      immediate: true,
      handler: 'renderMarkdown'
    }
  },

  mounted () {
    this.initReadonlyEditor()
  },

  beforeDestroy () {
    this.removeReadonlyInputHandlers()
    if (this.editor && this.editor.destroy) {
      try {
        this.editor.destroy()
      } catch (err) {
        // Muya's destroy path assumes all interactive UI plugins exist.
      }
    }
    this.editor = null
  },

  methods: {
    createMuya (element, options) {
      return new Muya(element, options)
    },

    initReadonlyEditor () {
      if (this.editor || !this.$refs.editorHost) {
        return
      }

      this.editor = this.createMuya(this.$refs.editorHost, {
        markdown: this.markdown || '',
        fontSize: this.fontSize,
        lineHeight: this.lineHeight,
        spellcheckEnabled: false,
        hideQuickInsertHint: true
      })
      this.makeEditorReadonly()
      this.disableEditorInteractions()
      this.$nextTick(() => {
        this.alignRenderedHeadings()
        this.$emit('rendered')
      })
    },

    renderMarkdown (markdown) {
      if (!this.editor) {
        return
      }

      this.editor.setMarkdown(markdown || '', null, false)
      this.makeEditorReadonly()
      this.disableEditorInteractions()
      this.$nextTick(() => {
        this.alignRenderedHeadings()
        this.$emit('rendered')
      })
    },

    makeEditorReadonly () {
      if (!this.editor || !this.editor.container) {
        return
      }

      const { container } = this.editor
      container.setAttribute('contenteditable', 'false')
      container.classList.add('translation-panel__editor--readonly')
      this.installReadonlyInputHandlers(container)
    },

    disableEditorInteractions () {
      const eventCenter = this.editor && this.editor.eventCenter
      if (!eventCenter) {
        return
      }

      if (Array.isArray(eventCenter.events) && eventCenter.detachDOMEvent) {
        while (eventCenter.events.length) {
          eventCenter.detachDOMEvent(eventCenter.events[0].eventId)
        }
        return
      }

      if (eventCenter.detachAllDomEvents) {
        eventCenter.detachAllDomEvents()
      }
    },

    installReadonlyInputHandlers (container) {
      if (this.readonlyInputHandlers.length) {
        return
      }

      const prevent = event => {
        event.preventDefault()
        event.stopPropagation()
      }
      const events = ['beforeinput', 'paste', 'drop', 'cut']
      this.readonlyInputHandlers = events.map(type => {
        container.addEventListener(type, prevent)
        return { type, prevent }
      })
    },

    removeReadonlyInputHandlers () {
      if (!this.editor || !this.editor.container) {
        this.readonlyInputHandlers = []
        return
      }

      const { container } = this.editor
      this.readonlyInputHandlers.forEach(({ type, prevent }) => {
        container.removeEventListener(type, prevent)
      })
      this.readonlyInputHandlers = []
    },

    getRenderedRoot () {
      if (this.editor && this.editor.container) {
        return this.editor.container
      }

      return this.$refs.rendered
    },

    alignRenderedHeadings () {
      const root = this.getRenderedRoot()
      if (!root) return

      const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6')
      headings.forEach(heading => {
        const level = heading.tagName.slice(1)
        heading.classList.add('translation-heading')
        heading.setAttribute('data-heading-level', level)
      })
    },

    getHeadingOffset (scroller, heading) {
      const scrollerRect = scroller.getBoundingClientRect()
      const headingRect = heading.getBoundingClientRect()
      return headingRect.top - scrollerRect.top + scroller.scrollTop
    },

    resetHeadingOffsets () {
      const root = this.getRenderedRoot()
      if (!root) return

      const headings = root.querySelectorAll('.translation-heading')
      headings.forEach(heading => {
        heading.style.marginTop = ''
        heading.removeAttribute('data-heading-offset-adjustment')
      })
    },

    alignHeadingOffsets (sourceOffsets = []) {
      const root = this.getRenderedRoot()
      const scroller = this.getScrollElement()
      if (!root || !scroller || sourceOffsets.length === 0) return

      this.resetHeadingOffsets()

      const headings = Array.from(root.querySelectorAll('.translation-heading'))
      const headingCount = Math.min(headings.length, sourceOffsets.length)
      for (let i = 0; i < headingCount; i++) {
        const heading = headings[i]
        const currentOffset = this.getHeadingOffset(scroller, heading)
        const targetOffset = sourceOffsets[i]
        const adjustment = Math.round(targetOffset - currentOffset)

        if (!Number.isFinite(adjustment) || adjustment === 0) {
          continue
        }

        const style = window.getComputedStyle(heading)
        const marginTop = parseFloat(style.marginTop) || 0
        const nextMarginTop = Math.max(0, marginTop + adjustment)
        const appliedAdjustment = Math.round(nextMarginTop - marginTop)
        if (appliedAdjustment === 0) {
          continue
        }

        heading.style.marginTop = `${nextMarginTop}px`
        heading.setAttribute('data-heading-offset-adjustment', `${appliedAdjustment}`)
      }
    },

    getScrollElement () {
      return this.editor && this.editor.container
    }
  }
}
</script>

<style scoped>
  .translation-panel {
    min-width: 300px;
    width: 50%;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--editorColor10);
    background: var(--editorBgColor);
    color: var(--editorColor);
  }

  .translation-panel__toolbar {
    height: 36px;
    flex: 0 0 36px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border-bottom: 1px solid var(--editorColor10);
    font-size: 12px;
  }

  .translation-panel__toolbar span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .translation-panel__button {
    height: 24px;
    padding: 0 10px;
    border: 1px solid var(--editorColor30);
    color: var(--editorColor);
    background: var(--editorBgColor);
    font-size: 12px;
  }

  .translation-panel__button--weak {
    opacity: .65;
  }

  .translation-panel__button:disabled {
    opacity: .4;
  }

  .translation-panel__content {
    flex: 1;
    min-height: 0;
    box-sizing: border-box;
    padding: 0;
  }

  .translation-panel__editor {
    height: 100%;
    overflow: auto;
    box-sizing: border-box;
    cursor: default;
  }

  .translation-panel__editor--readonly {
    user-select: text;
  }
</style>
