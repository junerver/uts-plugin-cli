const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

/**
 * 读取插件配置文件
 * @param {string} pluginPath - 插件目录路径
 * @returns {object|null} 配置对象
 */
function readPluginConfig(pluginPath) {
  const configPath = path.join(pluginPath, '.uts-plugin.json')
  if (!fs.existsSync(configPath)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch (error) {
    console.log(chalk.yellow(`⊘ 插件配置文件格式错误: ${configPath}`))
    return null
  }
}

/**
 * 检查是否有外部文件需要处理
 * @param {string} pluginPath - 插件目录路径
 * @returns {boolean} 是否有外部文件
 */
function hasExternalFiles(pluginPath) {
  const config = readPluginConfig(pluginPath)
  return config && config.externalFiles && config.externalFiles.length > 0
}

/**
 * 获取外部文件列表
 * @param {string} pluginPath - 插件目录路径
 * @returns {Array} 外部文件配置列表
 */
function getExternalFiles(pluginPath) {
  const config = readPluginConfig(pluginPath)
  if (!config || !config.externalFiles) {
    return []
  }
  return config.externalFiles
}

/**
 * 检查目标文件是否存在
 * @param {string} targetPath - 目标文件路径
 * @returns {boolean} 文件是否存在
 */
function targetFileExists(targetPath) {
  return fs.existsSync(targetPath)
}

/**
 * 复制文件（新建）
 * @param {string} sourcePath - 源文件路径
 * @param {string} targetPath - 目标文件路径
 */
function copyFile(sourcePath, targetPath) {
  const dir = path.dirname(targetPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.copyFileSync(sourcePath, targetPath)
}

/**
 * 备份文件
 * @param {string} filePath - 文件路径
 */
function backupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${filePath}.backup.${timestamp}`
  fs.copyFileSync(filePath, backupPath)
  console.log(chalk.gray(`  备份: ${path.basename(backupPath)}`))
}

module.exports = {
  readPluginConfig,
  hasExternalFiles,
  getExternalFiles,
  targetFileExists,
  copyFile,
  backupFile
}