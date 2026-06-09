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
  pluginDir: 'uni_modules',
  registry: 'uni_modules'
}