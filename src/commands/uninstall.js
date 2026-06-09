const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const readline = require('readline')
const { findProjectRoot, isPluginInstalled, removePlugin } = require('../utils/fs')

/**
 * 交互式确认提示
 * @param {string} message - 提示信息
 * @returns {Promise<boolean>}
 */
function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

/**
 * 卸载单个插件
 * @param {string} pluginName - 插件名称
 * @param {string} projectDir - 项目目录
 */
function uninstallOne(pluginName, projectDir) {
  const spinner = ora()
  const pluginPath = path.join(projectDir, 'uni_modules', pluginName)
  spinner.start(`正在卸载 "${pluginName}"...`)
  removePlugin(pluginPath)
  spinner.succeed(`✔ ${pluginName} 卸载成功`)
  console.log(chalk.gray(`  ${pluginPath}`))
}

/**
 * 卸载插件命令（支持多个）
 * @param {string[]} pluginNames - 插件名称列表
 * @param {object} options - 命令选项
 */
async function uninstall(pluginNames, options) {
  try {
    if (!pluginNames || pluginNames.length === 0) {
      console.log(chalk.red('请指定插件名称'))
      console.log(chalk.gray('用法：uts-plugin uninstall <plugin-name> [plugin-name2 ...]'))
      process.exit(1)
    }

    // 查找项目根目录
    const projectDir = findProjectRoot(process.cwd())
    if (!projectDir) {
      console.log(chalk.red('错误：未找到 uni-app 项目根目录'))
      console.log(chalk.gray('请在 uni-app 项目目录下执行此命令'))
      process.exit(1)
    }

    // 过滤出已安装的插件
    const installed = []
    const notInstalled = []
    for (const name of pluginNames) {
      if (isPluginInstalled(projectDir, name)) {
        installed.push(name)
      } else {
        notInstalled.push(name)
      }
    }

    // 提示未安装的
    for (const name of notInstalled) {
      console.log(chalk.yellow(`⊘ 插件 "${name}" 未安装，跳过`))
    }

    if (installed.length === 0) {
      return
    }

    // 确认卸载（除非使用 --force 选项）
    if (!options.force) {
      const list = installed.map((n) => `  - ${n}`).join('\n')
      console.log(chalk.yellow(`即将卸载以下 ${installed.length} 个插件：`))
      console.log(chalk.gray(list))
      console.log('')

      const answer = await confirm(chalk.yellow(`确定卸载吗？(y/N) `))
      if (!answer) {
        console.log(chalk.gray('已取消卸载'))
        return
      }
      console.log('')
    }

    // 执行卸载
    for (let i = 0; i < installed.length; i++) {
      if (i > 0) console.log('')
      uninstallOne(installed[i], projectDir)
    }
  } catch (error) {
    console.log('')
    console.log(chalk.red(`卸载失败：${error.message}`))
    process.exit(1)
  }
}

module.exports = uninstall
