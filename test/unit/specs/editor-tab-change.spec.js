import {
  getMuyaChangeDocumentId,
  shouldIgnoreProgrammaticMuyaChange
} from '@/components/editorWithTabs/editorChange.js'

describe('editor tab change helpers', () => {
  it('uses the active editor tab id for Muya change events', () => {
    expect(getMuyaChangeDocumentId('file-2')).to.equal('file-2')
  })

  it('ignores pending programmatic Muya changes', () => {
    expect(shouldIgnoreProgrammaticMuyaChange(1)).to.equal(true)
    expect(shouldIgnoreProgrammaticMuyaChange(0)).to.equal(false)
  })
})
