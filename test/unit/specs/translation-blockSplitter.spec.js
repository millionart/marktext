import { splitMarkdownForTranslation, mergeTranslatedBlocks } from '@/services/translation/blockSplitter'

describe('translation block splitter', () => {
  it('keeps paragraph order and blank lines', () => {
    const blocks = splitMarkdownForTranslation('A paragraph.\n\nSecond paragraph.')

    expect(blocks.map(b => b.text)).to.deep.equal(['A paragraph.', 'Second paragraph.'])
    expect(mergeTranslatedBlocks(blocks, ['一段。', '第二段。'])).to.equal('一段。\n\n第二段。')
  })

  it('keeps fenced code as one non-translatable block', () => {
    const markdown = 'Intro\n\n```js\nconst x = 1\n```\n\nOutro'
    const blocks = splitMarkdownForTranslation(markdown)

    expect(blocks.map(b => b.translatable)).to.deep.equal([true, false, true])
    expect(blocks[1].text).to.equal('```js\nconst x = 1\n```')
  })

  it('throws when translated block count differs', () => {
    const blocks = splitMarkdownForTranslation('A\n\nB')

    expect(() => mergeTranslatedBlocks(blocks, ['只一个'])).to.throw('translated block count')
  })
})
