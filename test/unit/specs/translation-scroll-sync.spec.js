import EditorWithTabs from '../../../src/renderer/components/editorWithTabs/index.vue'

describe('translation scroll sync', () => {
  it('explicitly refreshes the mounted translation panel after cached markdown is applied', () => {
    const calls = []
    const context = {
      translationMarkdown: '缓存译文',
      translationRefreshPending: false,
      $refs: {
        translationPanel: {
          renderMarkdown: markdown => calls.push(markdown)
        }
      },
      $nextTick: callback => callback()
    }
    context.flushTranslationPanel = () => EditorWithTabs.methods.flushTranslationPanel.call(context)

    EditorWithTabs.methods.refreshTranslationPanel.call(context)

    expect(calls).to.deep.equal(['缓存译文'])
  })

  it('keeps cached markdown refresh pending until the translation panel is mounted', () => {
    const calls = []
    const nextTickCallbacks = []
    const context = {
      translationMarkdown: '缓存译文',
      translationRefreshPending: false,
      $refs: {},
      $nextTick: callback => nextTickCallbacks.push(callback),
      recoverEditorDomIfCleared: () => {},
      alignTranslationHeadings: () => {},
      attachScrollSync: () => {}
    }
    context.flushTranslationPanel = () => EditorWithTabs.methods.flushTranslationPanel.call(context)

    EditorWithTabs.methods.refreshTranslationPanel.call(context)
    expect(context.translationRefreshPending).to.equal(true)

    nextTickCallbacks.shift()()
    expect(calls).to.deep.equal([])
    expect(context.translationRefreshPending).to.equal(true)

    context.$refs.translationPanel = {
      renderMarkdown: markdown => calls.push(markdown)
    }
    EditorWithTabs.methods.handleTranslationRendered.call(context)

    expect(calls).to.deep.equal(['缓存译文'])
    expect(context.translationRefreshPending).to.equal(false)
  })

  it('remounts the translation panel when applying a final cached result', () => {
    const context = {
      translationMarkdown: '',
      translationFromCache: false,
      translationRefreshPending: true,
      translationPanelKey: 2
    }

    EditorWithTabs.methods.applyTranslationResult.call(context, {
      markdown: '缓存译文',
      fromCache: true
    })

    expect(context.translationMarkdown).to.equal('缓存译文')
    expect(context.translationFromCache).to.equal(true)
    expect(context.translationPanelKey).to.equal(3)
    expect(context.translationRefreshPending).to.equal(false)
  })

  it('maps scroll positions between matching heading anchor segments', () => {
    const target = EditorWithTabs.methods.getAnchoredScrollTop(
      200,
      1000,
      2000,
      [100, 300],
      [120, 500]
    )

    expect(target).to.equal(310)
  })

  it('falls back when heading anchors cannot be paired', () => {
    const target = EditorWithTabs.methods.getAnchoredScrollTop(
      200,
      1000,
      2000,
      [],
      [120, 500]
    )

    expect(target).to.equal(null)
  })

  it('compensates for different scroll viewport top positions', () => {
    const target = EditorWithTabs.methods.getAnchoredScrollTop(
      100,
      1000,
      2000,
      [100, 300],
      [120, 500],
      36
    )

    expect(target).to.equal(156)
  })

  it('compensates the top segment when scroll viewport top positions differ', () => {
    const target = EditorWithTabs.methods.getAnchoredScrollTop(
      0,
      1000,
      2000,
      [100, 300],
      [120, 500],
      36
    )

    expect(target).to.equal(36)
  })

  it('keeps the reverse top segment stable after viewport compensation', () => {
    const target = EditorWithTabs.methods.getAnchoredScrollTop(
      36,
      1000,
      2000,
      [100, 300],
      [100, 300],
      -36
    )

    expect(target).to.equal(0)
  })

  it('ignores the next scroll event from the pane that was updated programmatically', () => {
    const updatedPane = {}
    const sourcePane = {}
    const calls = []
    const context = {
      ignoredScrollElement: updatedPane,
      ignoredScrollTimer: null,
      syncScroll: (from, to) => calls.push([from, to])
    }

    EditorWithTabs.methods.handleSyncedScrollEvent.call(context, updatedPane, sourcePane)

    expect(context.ignoredScrollElement).to.equal(null)
    expect(calls.length).to.equal(0)
  })

  it('syncs normal user scroll events', () => {
    const sourcePane = {}
    const targetPane = {}
    const calls = []
    const context = {
      ignoredScrollElement: null,
      syncScroll: (from, to) => calls.push([from, to])
    }

    EditorWithTabs.methods.handleSyncedScrollEvent.call(context, sourcePane, targetPane)

    expect(calls.length).to.equal(1)
    expect(calls[0]).to.deep.equal([sourcePane, targetPane])
  })
})
