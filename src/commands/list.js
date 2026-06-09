const chalk = require('chalk')
const ora = require('ora')
const { listRemotePlugins } = require('../utils/download')
const { findProjectRoot, listInstalledPlugins } = require('../utils/fs')
const { getPluginInfo } = require('../utils/download')
const config = require('../config')

/**
 * 列出插件命令
 * @param {object} options - 命令选项
 */
async function list(options) {
  const spinner = ora()

  try {
    // 查找项目根目录
    const projectDir = findProjectRoot(process.cwd())

    if (options.installed) {
      // 列出已安装插件
      if (!projectDir) {
        console.log(chalk.red('错误：未找到 uni-app 项目根目录'))
        process.exit(1)
      }

      const installed = listInstalledPlugins(projectDir)
      if (installed.length === 0) {
        console.log(chalk.yellow('暂无已安装的插件'))
        return
      }

      console.log(chalk.cyan('已安装的插件：'))
      console.log('')
      console.log(chalk.gray('  名称                    版本      描述'))
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────'))

      for (const pluginName of installed) {
        const pluginPath = require('path').join(projectDir, 'uni_modules', pluginName)
        const info = getPluginInfo(pluginPath)
        const version = info?.version || '-'
        const desc = info?.description || '-'

        // 格式化输出
        const nameStr = pluginName.padEnd(24)
        const versionStr = version.padEnd(10)
        console.log(`  ${chalk.green(nameStr)}${chalk.yellow(versionStr)}${chalk.gray(desc)}`)
      }
    } else {
      // 列出远程可用插件
      spinner.start('正在获取可用插件列表...')

      const plugins = await listRemotePlugins({
        owner: config.github.owner,
        repo: config.github.repo,
        branch: config.github.branch,
        token: options.token || config.github.token
      })

      spinner.stop()

      if (plugins.length === 0) {
        console.log(chalk.yellow('暂无可用插件'))
        return
      }

      console.log(chalk.cyan('可用插件列表：'))
      console.log(chalk.gray(`仓库：${config.github.owner}/${config.github.repo}`))
      console.log('')
      console.log(chalk.gray('  名称                    版本      描述'))
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────'))

      // 如果有项目目录，显示安装状态
      const installed = projectDir ? listInstalledPlugins(projectDir) : []

      for (const plugin of plugins) {
        const isInstalled = installed.includes(plugin.name)
        const installedInfo = isInstalled ? ' [已安装]' : ''
        const version = plugin.version || '-'
        const desc = plugin.description || '-'

        // 格式化输出
        const nameStr = plugin.name.padEnd(24)
        const versionStr = version.padEnd(10)
        const statusStr = isInstalled ? chalk.green(installedInfo) : ''
        console.log(`  ${chalk.green(nameStr)}${chalk.yellow(versionStr)}${chalk.gray(desc)}${statusStr}`)
      }

      console.log('')
      console.log(chalk.gray('使用方法：'))
      console.log(chalk.gray('  安装：npx @junerver/uts-plugin-cli install <plugin-name>'))
      console.log(chalk.gray('  卸载：npx @junerver/uts-plugin-cli uninstall <plugin-name>'))
      console.log(chalk.gray('  更新：npx @junerver/uts-plugin-cli update <plugin-name>'))
    }

  } catch (error) {
    spinner.fail('获取列表失败')
    console.log(chalk.red(error.message))
    process.exit(1)
  }
}

module.exports = list