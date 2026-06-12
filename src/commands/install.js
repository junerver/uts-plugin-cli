const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const ora = require('ora')
const readline = require('readline')
const { downloadPlugin, getPluginInfo, fetchManifest } = require('../utils/download')
const { findProjectRoot, isPluginInstalled } = require('../utils/fs')
const { hasExternalFiles, getExternalFiles, targetFileExists, copyFile, backupFile } = require('../utils/external-files')
const { mergeJson5Files, overwriteJson5Files, writeJson5File, parseJson5File } = require('../utils/merge')
const config = require('../config')

/**
 * 创建命令行交互接口
 * @returns {object} readline接口
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
}

/**
 * 询问用户选择处理方式
 * @param {string} fileName - 文件名
 * @param {string} strategy - 默认策略
 * @param {boolean} force - 是否强制使用默认策略
 * @returns {Promise<string>} 用户选择的策略
 */
async function askForStrategy(fileName, strategy, force = false) {
  if (force) {
    return strategy
  }
  
  const rl = createInterface()
  
  return new Promise((resolve) => {
    console.log(chalk.yellow(`\n发现外部文件: ${fileName}`))
    console.log(chalk.gray('请选择处理方式:'))
    console.log(chalk.gray('  1. merge    - 深度合并（推荐）'))
    console.log(chalk.gray('  2. overwrite - 完全覆盖'))
    console.log(chalk.gray('  3. skip     - 跳过不处理'))
    
    rl.question(chalk.cyan(`请输入选项 [1-3] (默认: ${strategy === 'merge' ? '1' : strategy === 'overwrite' ? '2' : '3'}): `), (answer) => {
      rl.close()
      
      const choice = answer.trim() || (strategy === 'merge' ? '1' : strategy === 'overwrite' ? '2' : '3')
      
      switch (choice) {
        case '1':
          resolve('merge')
          break
        case '2':
          resolve('overwrite')
          break
        case '3':
        default:
          resolve('skip')
          break
      }
    })
  })
}

/**
 * 处理单个外部文件
 * @param {object} externalFile - 外部文件配置
 * @param {string} pluginPath - 插件目录路径
 * @param {string} projectDir - 项目目录
 * @param {boolean} force - 是否强制使用默认策略
 */
async function processExternalFile(externalFile, pluginPath, projectDir, force = false) {
  // 外部文件存储在插件的 _external 目录下
  // source 相对于 _external 目录
  const sourcePath = path.join(pluginPath, '_external', externalFile.source)
  // target 相对于项目根目录
  const targetPath = path.join(projectDir, externalFile.target)
  const strategy = externalFile.strategy || 'merge'
  // arrayKeys 为空或不填时，合并全部字段
  const arrayKeys = externalFile.arrayKeys || []
  
  if (!fs.existsSync(sourcePath)) {
    console.log(chalk.yellow(`⊘ 源文件不存在: ${externalFile.source}`))
    return
  }
  
  if (!targetFileExists(targetPath)) {
    console.log(chalk.green(`✔ 目标文件不存在，直接复制: ${externalFile.target}`))
    copyFile(sourcePath, targetPath)
    return
  }
  
  // 目标文件存在，需要用户选择处理方式
  const selectedStrategy = await askForStrategy(path.basename(targetPath), strategy, force)
  
  if (selectedStrategy === 'skip') {
    console.log(chalk.gray(`⊘ 跳过: ${externalFile.target}`))
    return
  }
  
  // 备份原文件
  backupFile(targetPath)
  
  if (selectedStrategy === 'merge') {
    console.log(chalk.cyan(`合并: ${externalFile.target}`))
    const mergedData = mergeJson5Files(targetPath, sourcePath, externalFile.arrayKeys || [])
    writeJson5File(targetPath, mergedData)
  } else if (selectedStrategy === 'overwrite') {
    console.log(chalk.cyan(`覆盖: ${externalFile.target}`))
    const sourceData = parseJson5File(sourcePath)
    if (sourceData) {
      writeJson5File(targetPath, sourceData)
    }
  }
}

/**
 * 处理所有外部文件
 * @param {string} pluginPath - 插件目录路径
 * @param {string} projectDir - 项目目录
 * @param {object} manifestPlugin - manifest中的插件信息
 * @param {boolean} force - 是否强制使用默认策略
 */
async function processExternalFiles(pluginPath, projectDir, manifestPlugin, force = false) {
  // 优先从manifest读取外部文件配置
  let externalFiles = []
  
  if (manifestPlugin && manifestPlugin.externalFiles) {
    externalFiles = manifestPlugin.externalFiles
  } else if (hasExternalFiles(pluginPath)) {
    // 回退到本地配置文件
    externalFiles = getExternalFiles(pluginPath)
  }
  
  if (externalFiles.length === 0) {
    return
  }
  
  console.log(chalk.cyan(`\n处理外部文件 (${externalFiles.length} 个):`))
  
  for (const externalFile of externalFiles) {
    await processExternalFile(externalFile, pluginPath, projectDir, force)
  }
  
  // 清理特殊文件和目录
  cleanupSpecialFiles(pluginPath)
}

/**
 * 清理插件目录中的特殊文件
 * @param {string} pluginPath - 插件目录路径
 */
function cleanupSpecialFiles(pluginPath) {
  // 清理 _external 目录
  const externalDir = path.join(pluginPath, '_external')
  if (fs.existsSync(externalDir)) {
    fs.rmSync(externalDir, { recursive: true, force: true })
    console.log(chalk.gray('  清理: _external/'))
  }
  
  // 注意：保留 .uts-plugin.json 文件，以便卸载时读取配置处理外部文件
}

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
    source: options.source
  })

  const pluginInfo = getPluginInfo(installPath)
  if (pluginInfo) {
    console.log(chalk.green(`✔ ${pluginName}@${pluginInfo.version} 安装成功`))
  } else {
    console.log(chalk.green(`✔ ${pluginName} 安装成功`))
  }
  console.log(chalk.gray(`  ${installPath}`))
  
  // 处理外部文件
  await processExternalFiles(installPath, projectDir, manifest.plugins[pluginName], options.force)
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
