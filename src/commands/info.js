const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const { fetchManifest } = require('../utils/download')
const { findProjectRoot, isPluginInstalled } = require('../utils/fs')
const config = require('../config')

/**
 * 查看插件详情命令
 * @param {string} pluginName - 插件名称
 * @param {object} options - 命令选项
 */
async function info(pluginName, options) {
  const spinner = ora()

  try {
    if (!pluginName) {
      console.log(chalk.red('请指定插件名称'))
      console.log(chalk.gray('用法：uts-plugin info <plugin-name>'))
      process.exit(1)
    }

    spinner.start('正在获取插件信息...')

    const manifest = await fetchManifest({
      owner: config.github.owner,
      repo: config.github.repo,
      branch: options.branch || config.github.branch,
      token: options.token || config.github.token,
      source: options.source
    })

    spinner.stop()

    // 检查插件是否存在
    const pluginInfo = manifest.plugins[pluginName]
    if (!pluginInfo) {
      console.log(chalk.red(`插件 "${pluginName}" 不存在`))
      console.log(chalk.gray('可用插件：'))
      const availablePlugins = Object.keys(manifest.plugins)
      for (const name of availablePlugins.slice(0, 5)) {
        console.log(chalk.gray(`  - ${name}`))
      }
      if (availablePlugins.length > 5) {
        console.log(chalk.gray(`  ... 还有 ${availablePlugins.length - 5} 个插件`))
      }
      process.exit(1)
    }

    // 查找项目根目录
    const projectDir = findProjectRoot(process.cwd())
    const isInstalled = projectDir ? isPluginInstalled(projectDir, pluginName) : false

    // 显示插件详情
    console.log('')
    console.log(chalk.cyan('插件详情'))
    console.log(chalk.gray('─'.repeat(50)))
    console.log('')
    console.log(chalk.green('名称：') + pluginName)
    console.log(chalk.green('版本：') + (pluginInfo.version || '-'))
    console.log(chalk.green('描述：') + (pluginInfo.description || '-'))
    console.log(chalk.green('安装状态：') + (isInstalled ? chalk.green('已安装') : chalk.gray('未安装')))

    // 文件信息
    if (pluginInfo.files && pluginInfo.files.length > 0) {
      console.log('')
      console.log(chalk.green('包含文件：'))
      const files = pluginInfo.files.map(f => typeof f === 'object' ? f.path : f)
      for (const file of files) {
        console.log(chalk.gray(`  - ${file}`))
      }
    }

    // 外部文件信息
    if (pluginInfo.externalFiles && pluginInfo.externalFiles.length > 0) {
      console.log('')
      console.log(chalk.green('外部文件关联：'))
      for (const ext of pluginInfo.externalFiles) {
        console.log(chalk.gray(`  - ${ext.description || ext.source}`))
        console.log(chalk.gray(`    源：${ext.source}`))
        console.log(chalk.gray(`    目标：${ext.target}`))
        console.log(chalk.gray(`    策略：${ext.strategy || 'merge'}`))
      }
    }

    // 使用信息
    console.log('')
    console.log(chalk.green('使用方法：'))
    if (isInstalled) {
      console.log(chalk.gray(`  卸载：npx @junerver/uts-plugin-cli uninstall ${pluginName}`))
      console.log(chalk.gray(`  更新：npx @junerver/uts-plugin-cli update ${pluginName}`))
    } else {
      console.log(chalk.gray(`  安装：npx @junerver/uts-plugin-cli install ${pluginName}`))
    }

    console.log('')
    console.log(chalk.green('仓库地址：'))
    console.log(chalk.gray(`  https://github.com/${config.github.owner}/${config.github.repo}/tree/master/uni_modules/${pluginName}`))

  } catch (error) {
    spinner.fail('获取信息失败')
    console.log(chalk.red(error.message))
    process.exit(1)
  }
}

module.exports = info