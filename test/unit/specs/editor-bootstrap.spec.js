import { shouldSelectBootstrapMarkdown } from '@/store/editor.js'

describe('editor bootstrap helpers', () => {
  it('selects only the first bootstrap markdown tab', () => {
    expect(shouldSelectBootstrapMarkdown(0)).to.equal(true)
    expect(shouldSelectBootstrapMarkdown(1)).to.equal(false)
    expect(shouldSelectBootstrapMarkdown(2)).to.equal(false)
  })
})
