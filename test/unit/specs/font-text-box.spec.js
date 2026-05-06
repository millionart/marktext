import FontTextBox from '../../../src/renderer/prefComponents/common/fontTextBox/index.vue'

describe('FontTextBox', () => {
  it('keeps useful editor font fallbacks when native font enumeration is unavailable', () => {
    const fonts = FontTextBox.methods.getFallbackFontFamilies.call({
      defaultValue: 'Custom Editor Font',
      onlyMonospace: false
    })

    expect(fonts[0]).to.equal('Custom Editor Font')
    expect(fonts).to.include('Microsoft YaHei UI')
    expect(fonts).to.include('Open Sans')
    expect(fonts.length).to.be.greaterThan(4)
  })

  it('keeps useful monospace fallbacks when native font enumeration is unavailable', () => {
    const fonts = FontTextBox.methods.getFallbackFontFamilies.call({
      defaultValue: 'Custom Mono Font',
      onlyMonospace: true
    })

    expect(fonts[0]).to.equal('Custom Mono Font')
    expect(fonts).to.include('Consolas')
    expect(fonts).to.include('DejaVu Sans Mono')
    expect(fonts.length).to.be.greaterThan(4)
  })
})
