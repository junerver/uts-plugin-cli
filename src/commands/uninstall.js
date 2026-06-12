const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const ora = require('ora')
const readline = require('readline')
const { findProjectRoot, isPluginInstalled, removePlugin } = require('../utils/fs')
const { readPluginConfig } = require('../utils/external-files')
const { findExternalChanges, removeExternalChanges } = require('../utils/unmerge')

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
 * 处理插件的外部文件变更
 * @param {string} pluginPath - 插件路径
 * @param {string} projectDir - 项目目录
 * @param {boolean} force - 是否强制
 * @returns {Promise<boolean>} 是否有变更
 */
async function handleExternalFiles(pluginPath, projectDir, force = false) {
  // 读取插件配置
  const pluginConfig = readPluginConfig(pluginPath)
  if (!pluginConfig || !pluginConfig.externalFiles || pluginConfig.externalFiles.length === 0) {
    return false
  }

  console.log(chalk.cyan('\n检查外部文件变更...'))

  let hasChanges = false

  for (const ext of pluginConfig.externalFiles) {
    const targetPath = path.join(projectDir, ext.target)

    // 检查目标文件是否存在
    if (!fs.existsSync(targetPath)) {
      continue
    }

    // 查找变更
    const result = findExternalChanges(targetPath, ext)

    if (!result.found || result.changes.length === 0) {
      continue
    }

    hasChanges = true

    console.log(chalk.yellow(`\n外部文件: ${ext.target}`))
    console.log(chalk.gray(`描述: ${ext.description || '无'}`))

    // 显示变更详情
    console.log(chalk.gray('发现以下变更:'))
    for (const change of result.changes) {
      console.log(chalk.gray(`  - ${change.description}`))
      // 显示前几个元素
      const preview = change.value.slice(0, 3).map(v =>
        typeof v === 'object' ? JSON.stringify(v) : v
      ).join(', ')
      const suffix = change.value.length > 3 ? `, ... (共 ${change.value.length} 个)` : ''
      console.log(chalk.gray(`    内容: [${preview}${suffix}]`))
    }

    // 询问用户是否移除
    if (!force) {
      const answer = await confirm(chalk.yellow(`\n是否移除这些变更？(y/N) `))
      if (!answer) {
        console.log(chalk.gray('跳过'))
        continue
      }
    }

    // 执行移除
    console.log(chalk.cyan('正在移除变更...'))
    removeExternalChanges(targetPath, ext)
    console.log(chalk.green(`✔ 已移除 ${ext.target} 中的变更`))
  }

  return hasChanges
}

/**
 * 卸载单个插件
 * @param {string} pluginName - 插件名称
 * @param {string} projectDir - 项目目录
 * @param {object} options - 命令选项
 */
async function uninstallOne(pluginName, projectDir, options) {
  const spinner = ora()
  const pluginPath = path.join(projectDir, 'uni_modules', pluginName)

  // 处理外部文件变更
  await handleExternalFiles(pluginPath, projectDir, options.force)

  // 卸载插件
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
      await uninstallOne(installed[i], projectDir, options)
    }
  } catch (error) {
    console.log('')
    console.log(chalk.red(`卸载失败：${error.message}`))
    process.exit(1)
  }
}

module.exports = uninstall
