const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const { findProjectRoot, isPluginInstalled, removePlugin } = require('../utils/fs')

/**
 * 卸载插件命令
 * @param {string} pluginName - 插件名称
 * @param {object} options - 命令选项
 */
async function uninstall(pluginName, options) {
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
      console.log(chalk.yellow(`插件 "${pluginName}" 未安装`))
      return
    }

    const pluginPath = path.join(projectDir, 'uni_modules', pluginName)

    // 确认卸载（除非使用 --force 选项）
    if (!options.force) {
      const readline = require('readline')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })

      const answer = await new Promise(resolve => {
        rl.question(chalk.yellow(`确定要卸载插件 "${pluginName}" 吗？(y/N) `), resolve)
      })
      rl.close()

      if (answer.toLowerCase() !== 'y') {
        console.log(chalk.gray('已取消卸载'))
        return
      }
    }

    spinner.start(`正在卸载插件 "${pluginName}"...`)

    // 删除插件目录
    removePlugin(pluginPath)

    spinner.succeed(`插件 "${pluginName}" 卸载成功！`)
    console.log('')
    console.log(chalk.gray(`已删除：${pluginPath}`))

  } catch (error) {
    spinner.fail('卸载失败')
    console.log(chalk.red(error.message))
    process.exit(1)
  }
}

module.exports = uninstall