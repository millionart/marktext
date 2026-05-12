import updateCtrl from 'muya/lib/contentState/updateCtrl'
import ContentState from 'muya/lib/contentState'

describe('muya contentState updateCtrl', () => {
  it('does not require render when the cursor references a stale block key', () => {
    function ContentState () {}
    updateCtrl(ContentState)

    const contentState = new ContentState()
    contentState.stateRender = { labels: {} }
    contentState.muya = { options: {} }
    contentState.cursor = {
      start: { key: 'missing', offset: 0 },
      end: { key: 'missing', offset: 0 }
    }
    contentState.getBlock = () => null

    expect(contentState.checkNeedRender()).to.equal(false)
  })

  it('can compute a render range when the current cursor key is stale', () => {
    const contentState = Object.create(ContentState.prototype)
    contentState.blocks = [
      {
        key: 'active',
        children: [],
        preSibling: null,
        nextSibling: null
      }
    ]
    contentState.currentCursor = {
      start: { key: 'missing', offset: 0 },
      end: { key: 'missing', offset: 0 }
    }

    contentState.setNextRenderRange()

    expect(contentState.renderRange).to.deep.equal([null, null])
  })
})
