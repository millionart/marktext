const fs = require('fs')
const os = require('os')
const path = require('path')
const { expect, test } = require('@playwright/test')
const { launchElectron } = require('./helpers')

test.describe('Editor tab switching', () => {
  let app = null
  let page = null
  let tempDir = null

  test.beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-tabs-'))
    const firstFile = path.join(tempDir, 'first.md')
    const secondFile = path.join(tempDir, 'second.md')
    fs.writeFileSync(firstFile, '# First file\n\nalpha body', 'utf8')
    fs.writeFileSync(secondFile, '# Second file\n\nbeta body', 'utf8')

    const launched = await launchElectron([firstFile, secondFile])
    app = launched.app
    page = launched.page
  })

  test.afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('updates editor content when selecting another tab', async () => {
    await expect(page.locator('.tabs-container li')).toHaveCount(2)
    await expect(page.locator('#ag-editor-id')).toContainText('First file')

    await page.locator('.tabs-container li', { hasText: 'second.md' }).click()

    await expect(page.locator('.tabs-container li.active')).toContainText('second.md')
    await expect(page.locator('#ag-editor-id')).toContainText('Second file')
    await expect(page.locator('#ag-editor-id')).not.toContainText('First file')
  })
})
