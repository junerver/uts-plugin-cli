const axios = require('axios')
const path = require('path')
const fs = require('fs')
const config = require('../config')

/**
 * 获取 raw.githubusercontent.com 的 URL（支持代理）
 * @param {string} owner - GitHub 用户名
 * @param {string} repo - 仓库名
 * @param {string} branch - 分支名
 * @param {string} filePath - 文件路径
 * @returns {string} URL
 */
function getRawUrl(owner, repo, branch, filePath) {
  const rawBase = getRawBaseUrl()
  return `${rawBase}/${owner}/${repo}/${branch}/${filePath}`
}

/**
 * 获取 raw 基础 URL（支持代理）
 * @returns {string}
 */
function getRawBaseUrl() {
  const proxyConfig = config.proxy
  
  if (proxyConfig.enabled === 'true') {
    return proxyConfig.raw
  }
  
  // 默认使用原生地址
  return 'https://raw.githubusercontent.com'
}

/**
 * 获取 API 基础 URL（支持代理）
 * @returns {string}
 */
function getApiBaseUrl() {
  const proxyConfig = config.proxy
  
  if (proxyConfig.enabled === 'true') {
    return proxyConfig.api
  }
  
  return 'https://api.github.com'
}

/**
 * 测试 GitHub 连接
 * @returns {Promise<boolean>}
 */
async function testGitHubConnection() {
  try {
    await axios.get('https://raw.githubusercontent.com', {
      timeout: 5000,
      headers: { 'User-Agent': 'uts-plugin-cli' }
    })
    return true
  } catch (error) {
    return false
  }
}

/**
 * 获取代理配置（自动检测）
 * @returns {Promise<string>} 'direct' | 'proxy'
 */
async function getProxyMode() {
  const proxyConfig = config.proxy
  
  if (proxyConfig.enabled === 'true') {
    return 'proxy'
  }
  
  if (proxyConfig.enabled === 'false') {
    return 'direct'
  }
  
  // auto 模式：测试连接
  console.log('正在检测 GitHub 连接...')
  const canConnect = await testGitHubConnection()
  
  if (canConnect) {
    console.log('✓ GitHub 直连正常')
    return 'direct'
  } else {
    console.log('⚠ 无法直连 GitHub，使用代理服务')
    return 'proxy'
  }
}

/**
 * 从 GitHub 仓库下载 plugins.json manifest
 * @param {object} options
 * @returns {Promise<object>} manifest 内容
 */
async function fetchManifest({ owner, repo, branch, token = null }) {
  const proxyMode = await getProxyMode()
  let url
  
  if (proxyMode === 'proxy') {
    url = getRawUrl(owner, repo, branch, 'plugins.json')
  } else {
    url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugins.json`
  }

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'uts-plugin-cli' }
    })
    return response.data
  } catch (error) {
    throw new Error(
      `无法获取插件清单，请检查仓库配置\n` +
      `仓库：${owner}/${repo}\n` +
      `确保仓库根目录存在 plugins.json 文件\n` +
      `如果网络问题，请尝试设置代理：\n` +
      `  $Env:UTS_PLUGIN_PROXY="true"`
    )
  }
}

/**
 * 使用 raw.githubusercontent.com 下载文件
 * @param {string} owner - GitHub 用户名
 * @param {string} repo - 仓库名
 * @param {string} branch - 分支名
 * @param {string} filePath - 文件路径
 * @param {string} savePath - 本地保存路径
 */
async function downloadFromRaw(owner, repo, branch, filePath, savePath) {
  const url = getRawUrl(owner, repo, branch, filePath)

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'uts-plugin-cli' }
  })

  // 确保目录存在
  const dir = path.dirname(savePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(savePath, Buffer.from(response.data))
}

/**
 * 从 GitHub 下载指定插件目录
 * @param {object} options
 * @param {string} options.owner - GitHub 用户名
 * @param {string} options.repo - 仓库名
 * @param {string} options.branch - 分支名
 * @param {string} options.pluginName - 插件名称
 * @param {string} options.targetDir - 目标目录
 * @param {string} options.token - GitHub token（可选，私有仓库需要）
 * @returns {Promise<string>} 安装路径
 */
async function downloadPlugin({ owner, repo, branch, pluginName, targetDir, token = null }) {
  // 从仓库获取 manifest
  const manifest = await fetchManifest({ owner, repo, branch, token })

  // 检查插件是否存在
  const pluginInfo = manifest.plugins[pluginName]
  if (!pluginInfo || !pluginInfo.files || pluginInfo.files.length === 0) {
    throw new Error(
      `插件 "${pluginName}" 不存在\n` +
      `可用插件：${Object.keys(manifest.plugins).join(', ')}`
    )
  }

  // 计算本地安装路径
  const installDir = path.join(targetDir, 'uni_modules', pluginName)

  // 下载所有文件
  for (const file of pluginInfo.files) {
    const filePath = `uni_modules/${pluginName}/${file}`
    const savePath = path.join(installDir, file)
    await downloadFromRaw(owner, repo, branch, filePath, savePath)
  }

  return installDir
}

/**
 * 获取本地插件版本信息
 * @param {string} pluginPath - 插件目录路径
 * @returns {object} 插件信息
 */
function getPluginInfo(pluginPath) {
  const packageJsonPath = path.join(pluginPath, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return null
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
}

/**
 * 从 GitHub 获取可用插件列表（包含版本信息）
 * @param {object} options
 * @returns {Promise<object[]>} 插件信息列表
 */
async function listRemotePlugins({ owner, repo, branch, token = null }) {
  const manifest = await fetchManifest({ owner, repo, branch, token })

  return Object.entries(manifest.plugins).map(([name, info]) => ({
    name,
    version: info.version || '-',
    description: info.description || '-'
  }))
}

module.exports = {
  downloadPlugin,
  getPluginInfo,
  listRemotePlugins
}