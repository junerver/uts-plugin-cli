/**
 * uts-plugin-cli 配置文件
 */
module.exports = {
  github: {
    owner: 'junerver',
    repo: 'UtsPlugins',
    branch: 'master',
    token: process.env.GITHUB_TOKEN || null  // 支持通过环境变量设置 token
  },
  pluginDir: 'uni_modules',
  registry: 'uni_modules'
}