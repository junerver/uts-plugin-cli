/**
 * uts-plugin-cli 配置文件
 */
module.exports = {
  github: {
    owner: 'junerver',
    repo: 'UtsPlugins',
    branch: 'master',
    token: process.env.GITHUB_TOKEN || null
  },
  // GitHub 代理配置
  // 当无法直连 GitHub 时，使用代理服务
  proxy: {
    // 是否启用代理（auto: 自动检测, true: 始终使用, false: 禁用）
    enabled: process.env.UTS_PLUGIN_PROXY || 'auto',
    // raw.githubusercontent.com 的代理
    raw: process.env.UTS_PLUGIN_RAW_PROXY || 'https://raw.gitmirror.com',
    // api.github.com 的代理
    api: process.env.UTS_PLUGIN_API_PROXY || 'https://api.github.com'
  },
  pluginDir: 'uni_modules',
  registry: 'uni_modules'
}