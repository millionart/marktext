const FENCE_REG = /^\s*(```|~~~)/

const createBlock = (blocks, lines, separatorBefore, translatable) => {
  if (!lines.length) return

  blocks.push({
    id: blocks.length,
    text: lines.join('\n'),
    separatorBefore,
    translatable
  })
}

export const splitMarkdownForTranslation = markdown => {
  if (!markdown) return []

  const blocks = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let pendingLines = []
  let separatorBefore = ''
  let pendingSeparator = ''
  let inFence = false
  let fenceMarker = ''

  for (const line of lines) {
    const fenceMatch = line.match(FENCE_REG)

    if (!inFence && fenceMatch) {
      createBlock(blocks, pendingLines, separatorBefore, true)
      pendingLines = [line]
      separatorBefore = pendingSeparator
      pendingSeparator = ''
      inFence = true
      fenceMarker = fenceMatch[1]
      continue
    }

    if (inFence) {
      pendingLines.push(line)
      if (fenceMatch && fenceMatch[1] === fenceMarker && pendingLines.length > 1) {
        createBlock(blocks, pendingLines, separatorBefore, false)
        separatorBefore = ''
        pendingLines = []
        inFence = false
        fenceMarker = ''
      }
      continue
    }

    if (line.trim() === '') {
      if (pendingLines.length) {
        createBlock(blocks, pendingLines, separatorBefore, true)
        pendingLines = []
        separatorBefore = ''
        pendingSeparator = '\n\n'
      } else {
        pendingSeparator += '\n'
      }
      continue
    }

    if (!pendingLines.length && pendingSeparator) {
      separatorBefore = pendingSeparator
      pendingSeparator = ''
    }
    pendingLines.push(line)
  }

  createBlock(blocks, pendingLines, separatorBefore, !inFence)
  return blocks
}

export const mergeTranslatedBlocks = (blocks, translatedBlocks) => {
  if (blocks.length !== translatedBlocks.length) {
    throw new Error('translated block count does not match source block count')
  }

  return blocks.map((block, index) => {
    const translated = block.translatable ? translatedBlocks[index] : block.text
    return `${block.separatorBefore || ''}${translated}`
  }).join('')
}
