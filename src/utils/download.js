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
async function fetchManifest({ owner, repo, branch, token = null, onProgress = null, source = null }) {
  const instance = createAxiosInstance(token)

  // 根据 source 参数构建源列表
  let sources = []
  
  if (source === 'gitee') {
    // 仅使用 Gitee
    sources = [
      { url: `https://gitee.com/${config.gitee.owner}/${config.gitee.repo}/raw/${config.gitee.branch}/plugins.json`, name: 'Gitee' }
    ]
  } else if (source === 'github') {
    // 仅使用 GitHub
    sources = [
      { url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugins.json`, name: 'GitHub 直连' },
      { url: `https://ghp.ci/https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugins.json`, name: 'ghp.ci 代理' },
      { url: `https://raw.gitmirror.com/${owner}/${repo}/${branch}/plugins.json`, name: 'gitmirror 代理' }
    ]
  } else {
    // 自动选择：GitHub 优先，然后 GitHub 代理，最后 Gitee
    sources = [
      { url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugins.json`, name: 'GitHub 直连' },
      { url: `https://ghp.ci/https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugins.json`, name: 'ghp.ci 代理' },
      { url: `https://raw.gitmirror.com/${owner}/${repo}/${branch}/plugins.json`, name: 'gitmirror 代理' },
      { url: `https://gitee.com/${config.gitee.owner}/${config.gitee.repo}/raw/${config.gitee.branch}/plugins.json`, name: 'Gitee' }
    ]
  }

  for (const source of sources) {
    if (onProgress) {
      onProgress(`尝试 ${source.name}...`)
    }

    try {
      const response = await instance.get(source.url)
      if (response.data && typeof response.data === 'object' && response.data.plugins) {
        if (onProgress) {
          onProgress(`✓ 通过 ${source.name} 获取清单成功`)
        }
        return response.data
      }
    } catch (error) {
      if (onProgress) {
        onProgress(`✗ ${source.name} 失败`)
      }
      // 继续尝试下一个来源
    }
  }

  // 如果所有来源都失败，尝试使用 GitHub API
  if (source !== 'gitee') {
    if (onProgress) {
      onProgress('尝试 GitHub API...')
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/plugins.json?ref=${branch}`
    try {
      const response = await instance.get(apiUrl)
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
      if (onProgress) {
        onProgress(`✓ 通过 API 获取清单成功`)
      }
      return JSON.parse(content)
    } catch (error) {
      if (onProgress) {
        onProgress(`✗ API 请求失败`)
      }
    }
  }

  throw new Error(
    `无法获取插件清单\n\n` +
    `请尝试以下解决方案：\n` +
    `1. 设置 HTTP 代理：\n` +
    `   PowerShell: $Env:HTTPS_PROXY="http://127.0.0.1:7890"\n` +
    `   CMD: set HTTPS_PROXY=http://127.0.0.1:7890\n\n` +
    `2. 或使用 GitHub token：\n` +
    `   npx @junerver/uts-plugin-cli list --token ghp_xxxx\n\n` +
    `3. 或指定使用 Gitee：\n` +
    `   npx @junerver/uts-plugin-cli list --source gitee`
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
 * @param {function} onProgress - 进度回调
 * @param {string} source - 仓库源：github 或 gitee（可选）
 */
async function downloadFile(owner, repo, branch, filePath, savePath, token = null, onProgress = null, source = null) {
  const instance = createAxiosInstance(token)

  // 根据 source 参数构建源列表
  let sources = []
  
  if (source === 'gitee') {
    // 仅使用 Gitee
    sources = [
      `https://gitee.com/${config.gitee.owner}/${config.gitee.repo}/raw/${config.gitee.branch}/${filePath}`
    ]
  } else if (source === 'github') {
    // 仅使用 GitHub
    sources = [
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
      `https://ghp.ci/https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
      `https://raw.gitmirror.com/${owner}/${repo}/${branch}/${filePath}`
    ]
  } else {
    // 自动选择：GitHub 优先，然后 GitHub 代理，最后 Gitee
    sources = [
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
      `https://ghp.ci/https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
      `https://raw.gitmirror.com/${owner}/${repo}/${branch}/${filePath}`,
      `https://gitee.com/${config.gitee.owner}/${config.gitee.repo}/raw/${config.gitee.branch}/${filePath}`
    ]
  }

  for (const url of sources) {
    try {
      const response = await instance.get(url, { responseType: 'arraybuffer' })

      // 确保目录存在
      const dir = path.dirname(savePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(savePath, Buffer.from(response.data))
      return true
    } catch (error) {
      // 继续尝试下一个来源
    }
  }

  // 如果所有来源都失败，尝试使用 GitHub API
  if (source !== 'gitee') {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`
    try {
      const response = await instance.get(apiUrl)

      const dir = path.dirname(savePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const content = Buffer.from(response.data.content, 'base64')
      fs.writeFileSync(savePath, content)
      return true
    } catch (error) {
      throw new Error(`下载失败：${filePath}`)
    }
  }

  throw new Error(`下载失败：${filePath}`)
}

/**
 * 从 GitHub 下载指定插件目录
 * @param {object} options
 * @returns {Promise<string>} 安装路径
 */
async function downloadPlugin({ owner, repo, branch, pluginName, targetDir, token = null, onProgress = null, source = null }) {
  // 从仓库获取 manifest
  const manifest = await fetchManifest({ owner, repo, branch, token, onProgress, source })

  // 检查插件是否存在
  const pluginInfo = manifest.plugins[pluginName]
  if (!pluginInfo || !pluginInfo.files || pluginInfo.files.length === 0) {
    throw new Error(
      `插件 "${pluginName}" 不存在\n` +
      `可用插件：${Object.keys(manifest.plugins).join(', ')}`
    )
  }

  if (onProgress) {
    onProgress(`找到 ${pluginInfo.files.length} 个文件，开始下载...`)
  }

  // 计算本地安装路径
  const installDir = path.join(targetDir, 'uni_modules', pluginName)

  // 下载所有文件
  let downloaded = 0
  const total = pluginInfo.files.length

  for (const file of pluginInfo.files) {
    // 处理文件对象和字符串两种格式
    const filePath = typeof file === 'object' ? file.path : file
    const downloadPath = `uni_modules/${pluginName}/${filePath}`
    const savePath = path.join(installDir, filePath)
    await downloadFile(owner, repo, branch, downloadPath, savePath, token, null, source)

    downloaded++
    if (onProgress) {
      onProgress(`[${downloaded}/${total}] ${filePath}`)
    }
  }

  // 下载外部文件（如果存在）
  // externalFiles.source 相对于 _external 目录
  if (pluginInfo.externalFiles && pluginInfo.externalFiles.length > 0) {
    if (onProgress) {
      onProgress(`下载 ${pluginInfo.externalFiles.length} 个外部文件...`)
    }
    
    for (const extFile of pluginInfo.externalFiles) {
      // 外部文件存储在 uni_modules/pluginName/_external/ 目录下
      const localPath = path.join(installDir, '_external', extFile.source)
      // 从仓库下载（路径为 uni_modules/pluginName/_external/source）
      const repoPath = `uni_modules/${pluginName}/_external/${extFile.source}`
      try {
        await downloadFile(owner, repo, branch, repoPath, localPath, token, null, source)
      } catch (error) {
        if (onProgress) {
          onProgress(`外部文件下载失败: ${repoPath}`)
        }
      }
    }
  }

  return installDir
}

/**
 * 增量下载指定文件
 * @param {object} options
 * @returns {Promise<string>} 安装路径
 */
async function downloadFiles({ owner, repo, branch, pluginName, files, targetDir, token = null }) {
  const installDir = path.join(targetDir, 'uni_modules', pluginName)

  let downloaded = 0
  const total = files.length

  for (const file of files) {
    const filePath = `uni_modules/${pluginName}/${file}`
    const savePath = path.join(installDir, file)
    await downloadFile(owner, repo, branch, filePath, savePath, token)

    downloaded++
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
async function listRemotePlugins({ owner, repo, branch, token = null, source = null }) {
  const manifest = await fetchManifest({ owner, repo, branch, token, source })

  return Object.entries(manifest.plugins).map(([name, info]) => ({
    name,
    version: info.version || '-',
    description: info.description || '-'
  }))
}

module.exports = {
  downloadPlugin,
  downloadFiles,
  getPluginInfo,
  listRemotePlugins,
  fetchManifest
}