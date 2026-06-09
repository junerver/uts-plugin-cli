const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const { downloadPlugin, getPluginInfo } = require('../utils/download')
const { findProjectRoot, isPluginInstalled, removePlugin } = require('../utils/fs')
const config = require('../config')

/**
 * 升级插件命令
 * @param {string} pluginName - 插件名称
 * @param {object} options - 命令选项
 */
async function update(pluginName, options) {
  const spinner = ora()

  try {
    // 查找项目根目录
    const projectDir = findProjectRoot(process.cwd())
    if (!projectDir) {
      console.log(chalk.red('错误：未找到 uni-app 项目根目录'))
      console.log(chalk.gray('请在 uni-app 项目目录下执行此命令'))
      process.exit(1)
    }

    // 检查插件是否已安装
    if (!isPluginInstalled(projectDir, pluginName)) {
      console.log(chalk.yellow(`插件 "${pluginName}" 未安装，请先使用 install 命令安装`))
      return
    }

    const pluginPath = path.join(projectDir, 'uni_modules', pluginName)

    // 获取当前版本
    const currentInfo = getPluginInfo(pluginPath)
    const currentVersion = currentInfo?.version || '未知'

    console.log(chalk.cyan(`当前版本：${currentVersion}`))

    spinner.start(`正在更新插件 "${pluginName}"...`)

    // 先删除旧版本
    removePlugin(pluginPath)

    // 下载新版本
    const installPath = await downloadPlugin({
      owner: config.github.owner,
      repo: config.github.repo,
      branch: options.branch || config.github.branch,
      pluginName,
      targetDir: projectDir
    })

    spinner.succeed(`插件 "${pluginName}" 更新成功！`)

    // 显示新版本信息
    const newInfo = getPluginInfo(installPath)
    if (newInfo) {
      console.log('')
      console.log(chalk.cyan('更新后信息：'))
      console.log(chalk.gray(`  版本：${currentVersion} -> ${newInfo.version}`))
      console.log(chalk.gray(`  描述：${newInfo.description || '-'}`))
    }

    console.log('')
    console.log(chalk.gray(`安装路径：${installPath}`))

  } catch (error) {
    spinner.fail('更新失败')
    console.log(chalk.red(error.message))
    process.exit(1)
  }
}

module.exports = update