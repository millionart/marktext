import StateRender from '../../../src/muya/lib/parser/render'
import { h } from '../../../src/muya/lib/parser/render/snabbdom'

describe('Muya StateRender', () => {
  it('renders into its own container when multiple Muya roots exist', () => {
    const leftRoot = document.createElement('div')
    leftRoot.id = 'ag-editor-id'
    leftRoot.innerHTML = '<p id="left-block">left</p>'

    const rightRoot = document.createElement('div')
    rightRoot.id = 'ag-editor-id'
    rightRoot.innerHTML = '<p id="right-old-block">right old</p>'

    document.body.appendChild(leftRoot)
    document.body.appendChild(rightRoot)

    const renderer = new StateRender({
      eventCenter: {},
      options: {},
      contentState: {
        cursor: {
          start: { key: 'right-new-block' }
        },
        selectedBlock: null
      }
    })
    renderer.setContainer(rightRoot)
    renderer.renderBlock = (parent, block) => h(`p#${block.key}`, block.text)
    renderer.renderMermaid = () => {}
    renderer.renderDiagram = () => {}

    try {
      renderer.render([{ key: 'right-new-block', type: 'p', text: 'right new' }], [], null)

      expect(leftRoot.textContent).to.equal('left')
      expect(rightRoot.textContent).to.equal('right new')
    } finally {
      leftRoot.remove()
      rightRoot.remove()
    }
  })

  it('keeps rendering into the patched root after the initial placeholder is replaced', () => {
    const placeholder = document.createElement('div')
    document.body.appendChild(placeholder)

    const renderer = new StateRender({
      eventCenter: {},
      options: {},
      contentState: {
        cursor: {
          start: { key: 'first-block' }
        },
        selectedBlock: null
      }
    })
    renderer.setContainer(placeholder)
    renderer.renderBlock = (parent, block) => h(`p#${block.key}`, block.text)
    renderer.renderMermaid = () => {}
    renderer.renderDiagram = () => {}

    try {
      renderer.render([{ key: 'first-block', type: 'p', text: 'first' }], [], null)
      renderer.muya.contentState.cursor.start.key = 'second-block'
      renderer.render([{ key: 'second-block', type: 'p', text: 'second' }], [], null)

      expect(document.querySelector('#ag-editor-id').textContent).to.equal('second')
    } finally {
      const root = document.querySelector('#ag-editor-id')
      if (root) {
        root.remove()
      }
      placeholder.remove()
    }
  })
})
