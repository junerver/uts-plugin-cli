const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

/**
 * 检查是否在 uni-app 项目根目录
 * @param {string} dir - 目标目录
 * @returns {boolean}
 */
function isUniAppProject(dir) {
  // 检查常见的 uni-app 项目标识文件
  const markers = ['manifest.json', 'pages.json', 'uni.prompts.json', 'uni.scss']
  return markers.some(marker => fs.existsSync(path.join(dir, marker)))
}

/**
 * 获取项目根目录
 * @param {string} startDir - 起始目录
 * @returns {string|null} 项目根目录，未找到返回 null
 */
function findProjectRoot(startDir) {
  let currentDir = startDir
  while (currentDir !== path.dirname(currentDir)) {
    if (isUniAppProject(currentDir)) {
      return currentDir
    }
    currentDir = path.dirname(currentDir)
  }
  return null
}

/**
 * 列出已安装的插件
 * @param {string} projectDir - 项目目录
 * @returns {string[]} 已安装的插件名称列表
 */
function listInstalledPlugins(projectDir) {
  const uniModulesDir = path.join(projectDir, 'uni_modules')
  if (!fs.existsSync(uniModulesDir)) {
    return []
  }
  return fs.readdirSync(uniModulesDir).filter(item => {
    const itemPath = path.join(uniModulesDir, item)
    return fs.statSync(itemPath).isDirectory()
  })
}

/**
 * 删除插件目录
 * @param {string} pluginDir - 插件目录路径
 */
function removePlugin(pluginDir) {
  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true, force: true })
  }
}

/**
 * 检查插件是否已安装
 * @param {string} projectDir - 项目目录
 * @param {string} pluginName - 插件名称
 * @returns {boolean}
 */
function isPluginInstalled(projectDir, pluginName) {
  const pluginPath = path.join(projectDir, 'uni_modules', pluginName)
  return fs.existsSync(pluginPath)
}

/**
 * 计算文件的 MD5 hash
 * @param {string} filePath - 文件路径
 * @returns {string|null} MD5 hash，文件不存在返回 null
 */
function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }
  const content = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(content).digest('hex')
}

/**
 * 比对本地文件与远程文件清单的差异
 * @param {string} pluginDir - 本地插件目录
 * @param {object[]} remoteFiles - 远程文件清单 [{ path, hash }]
 * @returns {object} { added, modified, deleted, unchanged }
 */
function diffFiles(pluginDir, remoteFiles) {
  const result = { added: [], modified: [], deleted: [], unchanged: [] }

  // 构建远程文件 map
  const remoteMap = new Map()
  for (const file of remoteFiles) {
    remoteMap.set(file.path, file.hash)
  }

  // 检查远程文件在本地的状态
  for (const file of remoteFiles) {
    const localPath = path.join(pluginDir, file.path)
    const localHash = getFileHash(localPath)

    if (localHash === null) {
      result.added.push(file.path)
    } else if (localHash !== file.hash) {
      result.modified.push(file.path)
    } else {
      result.unchanged.push(file.path)
    }
  }

  // 检查本地存在但远程不存在的文件（排除目录）
  function walkLocal(dir, prefix = '') {
    if (!fs.existsSync(dir)) return
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const relativePath = prefix ? `${prefix}/${item}` : item
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        walkLocal(fullPath, relativePath)
      } else if (stat.isFile() && !remoteMap.has(relativePath)) {
        result.deleted.push(relativePath)
      }
    }
  }
  walkLocal(pluginDir)

  return result
}

module.exports = {
  isUniAppProject,
  findProjectRoot,
  listInstalledPlugins,
  removePlugin,
  isPluginInstalled,
  getFileHash,
  diffFiles
}