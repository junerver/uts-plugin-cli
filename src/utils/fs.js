const fs = require('fs')
const path = require('path')

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

module.exports = {
  isUniAppProject,
  findProjectRoot,
  listInstalledPlugins,
  removePlugin,
  isPluginInstalled
}