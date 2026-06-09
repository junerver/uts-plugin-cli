const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const readline = require('readline')
const { downloadPlugin, downloadFiles, getPluginInfo, fetchManifest } = require('../utils/download')
const { findProjectRoot, isPluginInstalled, removePlugin, diffFiles } = require('../utils/fs')
const config = require('../config')

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

    // 获取远程 manifest
    spinner.start('正在检查远程版本...')
    const manifest = await fetchManifest({
      owner: config.github.owner,
      repo: config.github.repo,
      branch: options.branch || config.github.branch,
      token: options.token || config.github.token,
    })
    spinner.stop()

    const remotePlugin = manifest.plugins[pluginName]
    if (!remotePlugin) {
      console.log(chalk.red(`远程仓库中未找到插件 "${pluginName}"`))
      return
    }

    const remoteVersion = remotePlugin.version || '未知'

    console.log(chalk.cyan(`当前版本：${currentVersion}`))
    console.log(chalk.cyan(`远程版本：${remoteVersion}`))

    // 版本不同 或 --force → 全量更新
    if (currentVersion !== remoteVersion || options.force) {
      console.log('')
      spinner.start(`正在更新插件 "${pluginName}" (v${currentVersion} -> v${remoteVersion})...`)

      removePlugin(pluginPath)

      const installPath = await downloadPlugin({
        owner: config.github.owner,
        repo: config.github.repo,
        branch: options.branch || config.github.branch,
        pluginName,
        targetDir: projectDir,
      })

      spinner.succeed(`插件 "${pluginName}" 更新成功！`)

      const newInfo = getPluginInfo(installPath)
      if (newInfo) {
        console.log('')
        console.log(chalk.cyan('更新后信息：'))
        console.log(chalk.gray(`  版本：${currentVersion} -> ${newInfo.version}`))
        console.log(chalk.gray(`  描述：${newInfo.description || '-'}`))
      }

      console.log('')
      console.log(chalk.gray(`安装路径：${installPath}`))
      return
    }

    // 版本相同 → 比对文件差异
    console.log('')
    spinner.start('版本相同，正在比对文件差异...')

    const remoteFiles = remotePlugin.files
    // 兼容旧格式（files 为字符串数组）和新格式（files 为对象数组）
    const hasHash = remoteFiles.length > 0 && typeof remoteFiles[0] === 'object'

    if (!hasHash) {
      // 旧格式：无法比对 hash
      if (options.force) {
        // --force: 全量更新
        console.log('')
        spinner.start(`正在强制更新插件 "${pluginName}"...`)
        removePlugin(pluginPath)
        const installPath = await downloadPlugin({
          owner: config.github.owner,
          repo: config.github.repo,
          branch: options.branch || config.github.branch,
          pluginName,
          targetDir: projectDir,
        })
        spinner.succeed(`插件 "${pluginName}" 强制更新完成！`)
        console.log(chalk.gray(`安装路径：${installPath}`))
        return
      }
      console.log(chalk.yellow('远程清单不含文件 hash，无法比对差异'))
      console.log(chalk.gray('如需强制更新，请使用 --force 选项'))
      return
    }

    const diff = diffFiles(pluginPath, remoteFiles)

    spinner.stop()

    const hasDiff = diff.added.length > 0 || diff.modified.length > 0 || diff.deleted.length > 0

    if (!hasDiff) {
      console.log(chalk.green(`✔ 插件 "${pluginName}" 已是最新版本 (v${currentVersion})，所有文件一致`))
      return
    }

    // 显示差异
    console.log('')
    console.log(chalk.yellow('检测到文件差异：'))

    if (diff.modified.length > 0) {
      console.log('')
      console.log(chalk.yellow(`  修改 (${diff.modified.length}):`))
      for (const f of diff.modified) {
        console.log(chalk.gray(`    ~ ${f}`))
      }
    }

    if (diff.added.length > 0) {
      console.log('')
      console.log(chalk.green(`  新增 (${diff.added.length}):`))
      for (const f of diff.added) {
        console.log(chalk.gray(`    + ${f}`))
      }
    }

    if (diff.deleted.length > 0) {
      console.log('')
      console.log(chalk.red(`  本地多余 (${diff.deleted.length}):`))
      for (const f of diff.deleted) {
        console.log(chalk.gray(`    - ${f}`))
      }
    }

    console.log('')
    const filesToUpdate = [...diff.modified, ...diff.added]
    const shouldOverwrite = await confirm(
      chalk.cyan(`是否用远端内容覆盖本地？(${filesToUpdate.length} 个文件将被更新) [y/N] `)
    )

    if (!shouldOverwrite) {
      console.log(chalk.gray('已取消更新'))
      return
    }

    // 增量更新：只下载变更的文件
    console.log('')
    spinner.start(`正在更新 ${filesToUpdate.length} 个文件...`)

    await downloadFiles({
      owner: config.github.owner,
      repo: config.github.repo,
      branch: options.branch || config.github.branch,
      pluginName,
      files: filesToUpdate,
      targetDir: projectDir,
      token: options.token || config.github.token,
    })

    spinner.succeed('文件更新完成！')

    console.log('')
    console.log(chalk.cyan('更新摘要：'))
    if (diff.modified.length > 0) console.log(chalk.gray(`  已更新：${diff.modified.length} 个文件`))
    if (diff.added.length > 0) console.log(chalk.gray(`  已新增：${diff.added.length} 个文件`))
    if (diff.deleted.length > 0) {
      console.log(chalk.gray(`  本地多余：${diff.deleted.length} 个文件（未删除）`))
      console.log(chalk.gray('  如需删除本地多余文件，请手动处理'))
    }

    console.log('')
    console.log(chalk.gray(`安装路径：${pluginPath}`))
  } catch (error) {
    spinner.fail('更新失败')
    console.log(chalk.red(error.message))
    process.exit(1)
  }
}

module.exports = update
