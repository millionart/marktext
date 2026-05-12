import selection from '../../../src/muya/lib/selection'

describe('Muya selection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.getSelection().removeAllRanges()
  })

  it('maps whole-paragraph element selections to text offsets', () => {
    const editor = document.createElement('div')
    editor.id = 'ag-editor-id'

    const paragraph = document.createElement('p')
    paragraph.id = 'paragraph'
    paragraph.className = 'ag-paragraph'

    const content = document.createElement('span')
    content.id = 'content'
    content.className = 'ag-paragraph ag-paragraph-content'
    content.textContent = 'selected text'

    paragraph.appendChild(content)
    editor.appendChild(paragraph)
    document.body.appendChild(editor)

    const range = document.createRange()
    range.setStart(paragraph, 0)
    range.setEnd(paragraph, paragraph.childNodes.length)

    const nativeSelection = document.getSelection()
    nativeSelection.removeAllRanges()
    nativeSelection.addRange(range)

    const cursor = selection.getCursorRange()

    expect(cursor.start).to.deep.equal({ key: 'paragraph', offset: 0 })
    expect(cursor.end).to.deep.equal({ key: 'paragraph', offset: 'selected text'.length })
  })

  it('does not throw when restoring a cursor whose DOM node is no longer rendered', () => {
    const editor = document.createElement('div')
    editor.id = 'ag-editor-id'

    const paragraph = document.createElement('p')
    paragraph.id = 'paragraph'
    paragraph.className = 'ag-paragraph'
    paragraph.textContent = 'existing text'

    editor.appendChild(paragraph)
    document.body.appendChild(editor)

    expect(() => {
      selection.setCursorRange({
        anchor: { key: 'missing-anchor', offset: 0 },
        focus: { key: 'missing-focus', offset: 0 }
      })
    }).to.not.throw()
  })
})
