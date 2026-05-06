import TranslationPanel from '../../../src/renderer/components/editorWithTabs/translationPanel.vue'

describe('TranslationPanel', () => {
  it('creates a readonly Muya editor using translated markdown', () => {
    const host = document.createElement('div')
    const calls = []
    let detached = false
    function FakeMuya (element, options) {
      calls.push({ element, options })
      this.container = document.createElement('div')
      this.container.setAttribute('contenteditable', 'true')
      this.container.innerHTML = '<div id="ag-editor-id"><h1>标题</h1></div>'
      this.eventCenter = {
        detachAllDomEvents: () => {
          detached = true
        }
      }
      this.setMarkdown = () => {}
    }

    const context = {
      markdown: '# 标题',
      fontSize: 17,
      lineHeight: 1.8,
      $refs: {
        editorHost: host
      },
      createMuya: (element, options) => new FakeMuya(element, options),
      makeEditorReadonly: TranslationPanel.methods.makeEditorReadonly,
      disableEditorInteractions: TranslationPanel.methods.disableEditorInteractions,
      installReadonlyInputHandlers: TranslationPanel.methods.installReadonlyInputHandlers,
      readonlyInputHandlers: [],
      alignRenderedHeadings: () => {},
      $emit: () => {},
      $nextTick: callback => callback()
    }

    TranslationPanel.methods.initReadonlyEditor.call(context)

    expect(calls.length).to.equal(1)
    expect(calls[0].options.markdown).to.equal('# 标题')
    expect(calls[0].options.fontSize).to.equal(17)
    expect(calls[0].options.lineHeight).to.equal(1.8)
    expect(context.editor.container.getAttribute('contenteditable')).to.equal('false')
    expect(detached).to.equal(true)
  })

  it('updates the readonly Muya editor when translated markdown changes', () => {
    const calls = []
    const context = {
      editor: {
        setMarkdown: markdown => calls.push(markdown)
      },
      makeEditorReadonly: () => {},
      disableEditorInteractions: () => {},
      alignRenderedHeadings: () => {},
      $emit: () => {},
      $nextTick: callback => callback()
    }

    TranslationPanel.methods.renderMarkdown.call(context, '# 新译文')

    expect(calls).to.deep.equal(['# 新译文'])
  })

  it('detaches Muya DOM handlers from the readonly preview editor', () => {
    const detached = []
    const eventCenter = {
      events: [{ eventId: 1 }, { eventId: 2 }, { eventId: 3 }],
      detachDOMEvent: id => {
        detached.push(id)
        eventCenter.events.shift()
      },
      detachAllDomEvents: () => {
        throw new Error('should detach readonly preview events robustly')
      }
    }
    const context = {
      editor: {
        eventCenter
      }
    }

    TranslationPanel.methods.disableEditorInteractions.call(context)

    expect(detached).to.deep.equal([1, 2, 3])
    expect(eventCenter.events.length).to.equal(0)
  })

  it('shows translation progress and errors in the status text', () => {
    const translating = TranslationPanel.computed.statusText.call({
      error: '',
      loading: true,
      progressText: '2/5 最新一行',
      fromCache: false
    })
    const failed = TranslationPanel.computed.statusText.call({
      error: 'network timeout',
      loading: false,
      progressText: '',
      fromCache: false
    })

    expect(translating).to.equal('Translating... 2/5 最新一行')
    expect(failed).to.equal('Translation failed: network timeout')
  })

  it('marks rendered headings for the secondary heading alignment pass', () => {
    const container = document.createElement('div')
    container.innerHTML = '<article class="markdown-body"><h1>Title</h1><p>Body</p><h3>Sub</h3></article>'
    const context = {
      $refs: {
        rendered: container
      }
    }
    context.getRenderedRoot = TranslationPanel.methods.getRenderedRoot

    TranslationPanel.methods.alignRenderedHeadings.call(context)
    const headings = container.querySelectorAll('.translation-heading')

    expect(headings.length).to.equal(2)
    expect(headings[0].getAttribute('data-heading-level')).to.equal('1')
    expect(headings[1].getAttribute('data-heading-level')).to.equal('3')
  })

  it('adds heading spacing so translated headings line up with source headings', () => {
    const scroller = document.createElement('div')
    const container = document.createElement('div')
    container.innerHTML = '<article class="markdown-body"><h1>Title</h1><p>Body</p><h2>Second</h2><p>Body</p><h2>Third</h2></article>'
    scroller.appendChild(container)

    const headings = container.querySelectorAll('h1, h2')
    scroller.getBoundingClientRect = () => ({ top: 0 })
    headings[0].getBoundingClientRect = () => ({ top: 20 })
    headings[1].getBoundingClientRect = () => ({ top: 120 })
    headings[2].getBoundingClientRect = () => ({ top: 260 })

    const context = {
      $refs: {
        scroller,
        rendered: container
      },
      getHeadingOffset: TranslationPanel.methods.getHeadingOffset,
      resetHeadingOffsets: TranslationPanel.methods.resetHeadingOffsets,
      getRenderedRoot: TranslationPanel.methods.getRenderedRoot,
      getScrollElement: () => scroller
    }

    TranslationPanel.methods.alignRenderedHeadings.call(context)
    TranslationPanel.methods.alignHeadingOffsets.call(context, [20, 180, 340])

    expect(headings[0].style.marginTop).to.equal('')
    expect(headings[1].style.marginTop).to.equal('60px')
    expect(headings[2].style.marginTop).to.equal('80px')
    expect(headings[1].getAttribute('data-heading-offset-adjustment')).to.equal('60')
    expect(headings[2].getAttribute('data-heading-offset-adjustment')).to.equal('80')
  })

  it('reduces heading spacing when translated headings are lower than source headings', () => {
    const scroller = document.createElement('div')
    const container = document.createElement('div')
    container.innerHTML = '<article class="markdown-body"><h2>Second</h2></article>'
    scroller.appendChild(container)

    const heading = container.querySelector('h2')
    const originalGetComputedStyle = window.getComputedStyle
    scroller.getBoundingClientRect = () => ({ top: 0 })
    heading.getBoundingClientRect = () => ({ top: 120 })
    window.getComputedStyle = element => {
      if (element === heading) {
        return { marginTop: '40px' }
      }
      return originalGetComputedStyle(element)
    }

    const context = {
      $refs: {
        scroller,
        rendered: container
      },
      getHeadingOffset: TranslationPanel.methods.getHeadingOffset,
      resetHeadingOffsets: TranslationPanel.methods.resetHeadingOffsets,
      getRenderedRoot: TranslationPanel.methods.getRenderedRoot,
      getScrollElement: () => scroller
    }

    try {
      TranslationPanel.methods.alignRenderedHeadings.call(context)
      TranslationPanel.methods.alignHeadingOffsets.call(context, [100])

      expect(heading.style.marginTop).to.equal('20px')
      expect(heading.getAttribute('data-heading-offset-adjustment')).to.equal('-20')
    } finally {
      window.getComputedStyle = originalGetComputedStyle
    }
  })
})
