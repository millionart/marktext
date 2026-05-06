import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'

const CACHE_DIR = 'translation-cache'
const SECRET_FILE = 'translation-cache-secret'

const getUserDataPath = () => global.marktext && global.marktext.paths && global.marktext.paths.userDataPath

const getCacheDirectory = () => {
  const userDataPath = getUserDataPath()
  if (!userDataPath) {
    throw new Error('User data path is not available')
  }

  return path.join(userDataPath, CACHE_DIR)
}

export const getOrCreateCacheSecret = async () => {
  const userDataPath = getUserDataPath()
  if (!userDataPath) {
    throw new Error('User data path is not available')
  }

  const secretPath = path.join(userDataPath, SECRET_FILE)
  if (await fs.pathExists(secretPath)) {
    return fs.readFile(secretPath, 'utf8')
  }

  const secret = crypto.randomBytes(32).toString('hex')
  await fs.ensureDir(userDataPath)
  await fs.writeFile(secretPath, secret, 'utf8')
  return secret
}

export const createTranslationFileCache = () => ({
  async read (cacheKey) {
    const cachePath = path.join(getCacheDirectory(), `${cacheKey}.json`)
    if (!await fs.pathExists(cachePath)) {
      return null
    }

    return fs.readJson(cachePath)
  },

  async write (record) {
    const cacheDir = getCacheDirectory()
    await fs.ensureDir(cacheDir)
    await fs.writeJson(path.join(cacheDir, `${record.metadata.cacheKey}.json`), record)
  }
})
