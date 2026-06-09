const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const { downloadPlugin, getPluginInfo, fetchManifest } = require('../utils/download')
const { findProjectRoot, isPluginInstalled } = require('../utils/fs')
const config = require('../config')

/**
 * 安装单个插件
 * @param {string} pluginName - 插件名称
 * @param {string} projectDir - 项目目录
 * @param {object} manifest - 远程 manifest
 * @param {object} options - 命令选项
 */
async function installOne(pluginName, projectDir, manifest, options) {
  // 检查插件是否已安装
  if (isPluginInstalled(projectDir, pluginName)) {
    console.log(chalk.yellow(`⊘ 插件 "${pluginName}" 已安装，跳过`))
    console.log(chalk.gray('  如需升级，请使用 update 命令'))
    return
  }

  // 检查插件是否存在于远程
  if (!manifest.plugins[pluginName]) {
    console.log(chalk.red(`✖ 插件 "${pluginName}" 不存在于远程仓库`))
    return
  }

  console.log(chalk.cyan(`正在安装 "${pluginName}"...`))

  const installPath = await downloadPlugin({
    owner: config.github.owner,
    repo: config.github.repo,
    branch: options.branch || config.github.branch,
    pluginName,
    targetDir: projectDir,
    token: options.token || config.github.token,
  })

  const pluginInfo = getPluginInfo(installPath)
  if (pluginInfo) {
    console.log(chalk.green(`✔ ${pluginName}@${pluginInfo.version} 安装成功`))
  } else {
    console.log(chalk.green(`✔ ${pluginName} 安装成功`))
  }
  console.log(chalk.gray(`  ${installPath}`))
}

/**
 * 安装插件命令（支持多个）
 * @param {string[]} pluginNames - 插件名称列表
 * @param {object} options - 命令选项
 */
async function install(pluginNames, options) {
  const spinner = ora()

  try {
    if (!pluginNames || pluginNames.length === 0) {
      console.log(chalk.red('请指定插件名称'))
      console.log(chalk.gray('用法：uts-plugin install <plugin-name> [plugin-name2 ...]'))
      process.exit(1)
    }

    // 查找项目根目录
    const projectDir = findProjectRoot(process.cwd())
    if (!projectDir) {
      console.log(chalk.red('错误：未找到 uni-app 项目根目录'))
      console.log(chalk.gray('请在 uni-app 项目目录下执行此命令'))
      process.exit(1)
    }

    // 获取远程 manifest（只请求一次）
    spinner.start('正在获取插件清单...')
    const manifest = await fetchManifest({
      owner: config.github.owner,
      repo: config.github.repo,
      branch: options.branch || config.github.branch,
      token: options.token || config.github.token,
    })
    spinner.stop()

    console.log(chalk.gray(`仓库：${config.github.owner}/${config.github.repo}`))
    console.log('')

    // 逐个安装
    for (let i = 0; i < pluginNames.length; i++) {
      if (i > 0) console.log('') // 插件之间空行
      await installOne(pluginNames[i], projectDir, manifest, options)
    }
  } catch (error) {
    spinner.fail('安装失败')
    console.log(chalk.red(error.message))
    process.exit(1)
  }
}

module.exports = install
