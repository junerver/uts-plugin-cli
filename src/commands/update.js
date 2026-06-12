const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const readline = require('readline')
const { downloadPlugin, downloadFiles, getPluginInfo, fetchManifest } = require('../utils/download')
const { findProjectRoot, isPluginInstalled, removePlugin, diffFiles } = require('../utils/fs')
const { hasExternalFiles, getExternalFiles } = require('../utils/external-files')
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
 * 更新单个插件
 * @param {string} pluginName - 插件名称
 * @param {string} projectDir - 项目目录
 * @param {object} manifest - 远程 manifest
 * @param {object} options - 命令选项
 */
async function updateOne(pluginName, projectDir, manifest, options) {
  const spinner = ora()

  // 检查插件是否已安装
  if (!isPluginInstalled(projectDir, pluginName)) {
    console.log(chalk.yellow(`⊘ 插件 "${pluginName}" 未安装，跳过`))
    console.log(chalk.gray('  如需安装，请使用 install 命令'))
    return
  }

  const pluginPath = path.join(projectDir, 'uni_modules', pluginName)

  // 获取当前版本
  const currentInfo = getPluginInfo(pluginPath)
  const currentVersion = currentInfo?.version || '未知'

  // 检查远程是否存在
  const remotePlugin = manifest.plugins[pluginName]
  if (!remotePlugin) {
    console.log(chalk.red(`✖ 远程仓库中未找到插件 "${pluginName}"`))
    return
  }

  const remoteVersion = remotePlugin.version || '未知'

  console.log(chalk.cyan(`${pluginName}`))
  console.log(chalk.gray(`  当前：v${currentVersion}  远程：v${remoteVersion}`))

  // 版本不同 或 --force → 全量更新
  if (currentVersion !== remoteVersion || options.force) {
    spinner.start(`  正在更新 (v${currentVersion} -> v${remoteVersion})...`)

    removePlugin(pluginPath)

    const installPath = await downloadPlugin({
      owner: config.github.owner,
      repo: config.github.repo,
      branch: options.branch || config.github.branch,
      pluginName,
      targetDir: projectDir,
    })

    spinner.succeed(`  ✔ 更新成功`)
    console.log(chalk.gray(`  ${installPath}`))
    
    // 处理外部文件
    const externalFiles = remotePlugin.externalFiles || []
    if (externalFiles.length > 0) {
      console.log(chalk.cyan(`  处理外部文件 (${externalFiles.length} 个)...`))
      const { processExternalFiles } = require('./install')
      await processExternalFiles(installPath, projectDir, remotePlugin, options.force)
    }
    
    return
  }

  // 版本相同 → 比对文件差异
  const remoteFiles = remotePlugin.files
  const hasHash = remoteFiles.length > 0 && typeof remoteFiles[0] === 'object'

  if (!hasHash) {
    // 旧格式：无法比对 hash
    if (options.force) {
      spinner.start('  正在强制更新...')
      removePlugin(pluginPath)
      const installPath = await downloadPlugin({
        owner: config.github.owner,
        repo: config.github.repo,
        branch: options.branch || config.github.branch,
        pluginName,
        targetDir: projectDir,
      })
      spinner.succeed('  ✔ 强制更新完成')
      console.log(chalk.gray(`  ${installPath}`))
      return
    }
    console.log(chalk.yellow('  远程清单不含文件 hash，无法比对（使用 --force 可强制更新）'))
    return
  }

  const diff = diffFiles(pluginPath, remoteFiles)
  const hasDiff = diff.added.length > 0 || diff.modified.length > 0 || diff.deleted.length > 0

  if (!hasDiff) {
    console.log(chalk.green(`  ✔ 已是最新版本，所有文件一致`))
    return
  }

  // 显示差异
  const total = diff.modified.length + diff.added.length
  console.log(chalk.yellow(`  检测到差异：${diff.modified.length} 修改, ${diff.added.length} 新增, ${diff.deleted.length} 多余`))

  if (diff.modified.length > 0) {
    for (const f of diff.modified) console.log(chalk.gray(`    ~ ${f}`))
  }
  if (diff.added.length > 0) {
    for (const f of diff.added) console.log(chalk.gray(`    + ${f}`))
  }
  if (diff.deleted.length > 0) {
    for (const f of diff.deleted) console.log(chalk.gray(`    - ${f}`))
  }

  const shouldOverwrite = await confirm(
    chalk.cyan(`  是否用远端内容覆盖？(${total} 个文件) [y/N] `)
  )

  if (!shouldOverwrite) {
    console.log(chalk.gray('  已跳过'))
    return
  }

  // 增量更新
  const filesToUpdate = [...diff.modified, ...diff.added]
  spinner.start(`  正在更新 ${filesToUpdate.length} 个文件...`)

  await downloadFiles({
    owner: config.github.owner,
    repo: config.github.repo,
    branch: options.branch || config.github.branch,
    pluginName,
    files: filesToUpdate,
    targetDir: projectDir,
    token: options.token || config.github.token,
  })

  spinner.succeed(`  ✔ ${filesToUpdate.length} 个文件更新完成`)
  if (diff.deleted.length > 0) {
    console.log(chalk.gray(`  （本地多余 ${diff.deleted.length} 个文件未删除，如需清理请手动处理）`))
  }
  
  // 处理外部文件
  const externalFiles = remotePlugin.externalFiles || []
  if (externalFiles.length > 0) {
    console.log(chalk.cyan(`  处理外部文件 (${externalFiles.length} 个)...`))
    const { processExternalFiles } = require('./install')
    await processExternalFiles(pluginPath, projectDir, remotePlugin, options.force)
  }
}

/**
 * 升级插件命令（支持多个）
 * @param {string[]} pluginNames - 插件名称列表
 * @param {object} options - 命令选项
 */
async function update(pluginNames, options) {
  const spinner = ora()

  try {
    if (!pluginNames || pluginNames.length === 0) {
      console.log(chalk.red('请指定插件名称'))
      console.log(chalk.gray('用法：uts-plugin update <plugin-name> [plugin-name2 ...]'))
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

    // 逐个更新
    for (let i = 0; i < pluginNames.length; i++) {
      if (i > 0) console.log('')
      await updateOne(pluginNames[i], projectDir, manifest, options)
    }
  } catch (error) {
    spinner.fail('更新失败')
    console.log(chalk.red(error.message))
    process.exit(1)
  }
}

module.exports = update
