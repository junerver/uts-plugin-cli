const axios = require('axios')
const path = require('path')
const fs = require('fs')
const config = require('../config')

/**
 * 创建 axios 实例（支持代理）
 * @param {string} token - GitHub token（可选）
 * @returns {object} axios 实例
 */
function createAxiosInstance(token = null) {
  const axiosConfig = {
    headers: {
      'User-Agent': 'uts-plugin-cli',
      'Accept': 'application/json'
    },
    timeout: 15000
  }

  if (token) {
    axiosConfig.headers['Authorization'] = `token ${token}`
  }

  // 检查环境变量中的 HTTP 代理
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy

  if (httpsProxy) {
    // 使用代理
    const { URL } = require('url')
    try {
      const proxyUrl = new URL(httpsProxy)
      axiosConfig.proxy = {
        host: proxyUrl.hostname,
        port: parseInt(proxyUrl.port) || (proxyUrl.protocol === 'https:' ? 443 : 80),
        protocol: proxyUrl.protocol
      }
    } catch (e) {
      // 忽略无效的代理 URL
    }
  }

  return axios.create(axiosConfig)
}

/**
 * 获取插件清单
 * @param {object} options
 * @returns {Promise<object>} manifest 内容
 */
async function fetchManifest({ owner, repo, branch, token = null }) {
  const instance = createAxiosInstance(token)

  // 尝试多个来源获取 plugins.json
  const sources = [
    // 1. 直接访问 raw.githubusercontent.com
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugins.json`,
    // 2. 使用代理服务
    `https://ghp.ci/https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugins.json`,
    // 3. 使用另一个代理服务
    `https://raw.gitmirror.com/${owner}/${repo}/${branch}/plugins.json`
  ]

  let lastError = null

  for (const url of sources) {
    try {
      const response = await instance.get(url)
      if (response.data && typeof response.data === 'object' && response.data.plugins) {
        return response.data
      }
    } catch (error) {
      lastError = error
      // 继续尝试下一个来源
    }
  }

  // 如果所有来源都失败，尝试使用 GitHub API
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/plugins.json?ref=${branch}`
  try {
    const response = await instance.get(apiUrl)
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
    return JSON.parse(content)
  } catch (error) {
    lastError = error
  }

  throw new Error(
    `无法获取插件清单\n\n` +
    `请尝试以下解决方案：\n` +
    `1. 设置 HTTP 代理：\n` +
    `   PowerShell: $Env:HTTPS_PROXY="http://127.0.0.1:7890"\n` +
    `   CMD: set HTTPS_PROXY=http://127.0.0.1:7890\n` +
    `   Linux/Mac: export HTTPS_PROXY=http://127.0.0.1:7890\n\n` +
    `2. 或使用 GitHub token（推荐）：\n` +
    `   npx @junerver/uts-plugin-cli list --token ghp_xxxx\n\n` +
    `仓库：${owner}/${repo}`
  )
}

/**
 * 下载单个文件
 * @param {string} owner - GitHub 用户名
 * @param {string} repo - 仓库名
 * @param {string} branch - 分支名
 * @param {string} filePath - 文件路径
 * @param {string} savePath - 本地保存路径
 * @param {string} token - GitHub token（可选）
 */
async function downloadFile(owner, repo, branch, filePath, savePath, token = null) {
  const instance = createAxiosInstance(token)

  // 尝试多个来源下载
  const sources = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
    `https://ghp.ci/https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
    `https://raw.gitmirror.com/${owner}/${repo}/${branch}/${filePath}`
  ]

  for (const url of sources) {
    try {
      const response = await instance.get(url, { responseType: 'arraybuffer' })

      // 确保目录存在
      const dir = path.dirname(savePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(savePath, Buffer.from(response.data))
      return
    } catch (error) {
      // 继续尝试下一个来源
    }
  }

  // 如果所有来源都失败，尝试使用 GitHub API
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`
  try {
    const response = await instance.get(apiUrl)

    const dir = path.dirname(savePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const content = Buffer.from(response.data.content, 'base64')
    fs.writeFileSync(savePath, content)
    return
  } catch (error) {
    throw new Error(`下载失败：${filePath}`)
  }
}

/**
 * 从 GitHub 下载指定插件目录
 * @param {object} options
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
    await downloadFile(owner, repo, branch, filePath, savePath, token)
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