const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const { downloadPlugin, getPluginInfo } = require('../utils/download')
const { findProjectRoot, isPluginInstalled } = require('../utils/fs')
const config = require('../config')

/**
 * 安装插件命令
 * @param {string} pluginName - 插件名称
 * @param {object} options - 命令选项
 */
async function install(pluginName, options) {
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
    if (isPluginInstalled(projectDir, pluginName)) {
      console.log(chalk.yellow(`插件 "${pluginName}" 已安装`))
      console.log(chalk.gray('如需升级，请使用 update 命令'))
      return
    }

    console.log(chalk.cyan(`正在从 GitHub 下载插件 "${pluginName}"...`))
    console.log(chalk.gray(`仓库：${config.github.owner}/${config.github.repo}`))
    console.log(chalk.gray(`目录：uni_modules/${pluginName}`))
    console.log('')

    // 下载插件（带进度回调）
    const installPath = await downloadPlugin({
      owner: config.github.owner,
      repo: config.github.repo,
      branch: options.branch || config.github.branch,
      pluginName,
      targetDir: projectDir,
      token: options.token || config.github.token,
      onProgress: (message) => {
        console.log(chalk.gray(`  ${message}`))
      }
    })

    console.log('')
    console.log(chalk.green(`✔ 插件 "${pluginName}" 安装成功！`))

    // 显示插件信息
    const pluginInfo = getPluginInfo(installPath)
    if (pluginInfo) {
      console.log('')
      console.log(chalk.cyan('插件信息：'))
      console.log(chalk.gray(`  名称：${pluginInfo.displayName || pluginInfo.name}`))
      console.log(chalk.gray(`  版本：${pluginInfo.version}`))
      console.log(chalk.gray(`  描述：${pluginInfo.description || '-'}`))
    }

    console.log('')
    console.log(chalk.gray(`安装路径：${installPath}`))
    console.log('')
    console.log(chalk.yellow('提示：请确保在页面中使用条件编译指令包裹插件代码'))
    console.log(chalk.gray('// #ifdef APP-HARMONY'))
    console.log(chalk.gray('import { xxx } from "@/uni_modules/' + pluginName + '"'))
    console.log(chalk.gray('// #endif'))

  } catch (error) {
    console.log('')
    console.log(chalk.red(`✖ 安装失败：${error.message}`))
    process.exit(1)
  }
}

module.exports = install