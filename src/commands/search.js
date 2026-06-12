const chalk = require('chalk')
const ora = require('ora')
const { listRemotePlugins } = require('../utils/download')
const config = require('../config')

/**
 * 搜索插件命令
 * @param {string} keyword - 搜索关键词
 * @param {object} options - 命令选项
 */
async function search(keyword, options) {
  const spinner = ora()

  try {
    if (!keyword) {
      console.log(chalk.red('请指定搜索关键词'))
      console.log(chalk.gray('用法：uts-plugin search <keyword>'))
      process.exit(1)
    }

    spinner.start('正在搜索插件...')

    const plugins = await listRemotePlugins({
      owner: config.github.owner,
      repo: config.github.repo,
      branch: options.branch || config.github.branch,
      token: options.token || config.github.token
    })

    spinner.stop()

    // 搜索匹配的插件
    const keywordLower = keyword.toLowerCase()
    const matchedPlugins = plugins.filter(plugin => {
      const nameMatch = plugin.name.toLowerCase().includes(keywordLower)
      const descMatch = plugin.description && plugin.description.toLowerCase().includes(keywordLower)
      return nameMatch || descMatch
    })

    if (matchedPlugins.length === 0) {
      console.log(chalk.yellow(`未找到包含 "${keyword}" 的插件`))
      console.log(chalk.gray('提示：使用 list 命令查看所有可用插件'))
      return
    }

    console.log(chalk.cyan(`搜索结果：找到 ${matchedPlugins.length} 个插件`))
    console.log(chalk.gray(`仓库：${config.github.owner}/${config.github.repo}`))
    console.log('')
    console.log(chalk.gray('  名称                    版本      描述'))
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────'))

    for (const plugin of matchedPlugins) {
      const version = plugin.version || '-'
      const desc = plugin.description || '-'

      // 高亮匹配的关键词
      let displayName = plugin.name
      let displayDesc = desc

      if (plugin.name.toLowerCase().includes(keywordLower)) {
        displayName = plugin.name.replace(
          new RegExp(keyword, 'gi'),
          match => chalk.yellow(match)
        )
      }
      if (desc && desc.toLowerCase().includes(keywordLower)) {
        displayDesc = desc.replace(
          new RegExp(keyword, 'gi'),
          match => chalk.yellow(match)
        )
      }

      // 格式化输出
      const nameStr = displayName.padEnd(24)
      const versionStr = version.padEnd(10)
      console.log(`  ${chalk.green(nameStr)}${chalk.yellow(versionStr)}${chalk.gray(displayDesc)}`)
    }

    console.log('')
    console.log(chalk.gray('使用方法：'))
    console.log(chalk.gray('  查看详情：npx @junerver/uts-plugin-cli info <plugin-name>'))
    console.log(chalk.gray('  安装插件：npx @junerver/uts-plugin-cli install <plugin-name>'))

  } catch (error) {
    spinner.fail('搜索失败')
    console.log(chalk.red(error.message))
    process.exit(1)
  }
}

module.exports = search