#!/usr/bin/env node

const { Command } = require('commander')
const chalk = require('chalk')
const pkg = require('../package.json')

const program = new Command()

program
  .name('uts-plugin')
  .description('UTS 插件管理工具 - 从 GitHub 仓库安装 uni-app 原生插件')
  .version(pkg.version)

program
  .command('install <plugin-name>')
  .alias('i')
  .description('安装 UTS 插件')
  .option('-b, --branch <branch>', '指定分支')
  .option('-t, --token <token>', 'GitHub token（用于私有仓库或提高 API 限制）')
  .action(require('../src/commands/install'))

program
  .command('uninstall <plugin-name>')
  .alias('rm')
  .description('卸载 UTS 插件')
  .option('-f, --force', '强制卸载，不提示确认')
  .action(require('../src/commands/uninstall'))

program
  .command('update <plugin-name>')
  .alias('u')
  .description('升级 UTS 插件')
  .option('-b, --branch <branch>', '指定分支')
  .option('-t, --token <token>', 'GitHub token（用于私有仓库或提高 API 限制）')
  .action(require('../src/commands/update'))

program
  .command('list')
  .alias('ls')
  .description('列出可用插件')
  .option('-i, --installed', '列出已安装的插件')
  .option('-t, --token <token>', 'GitHub token（用于私有仓库或提高 API 限制）')
  .action(require('../src/commands/list'))

// 显示帮助信息
program.on('--help', () => {
  console.log('')
  console.log(chalk.cyan('示例：'))
  console.log(chalk.gray('  $ npx uts-plugin-cli install jkr-abc-epay'))
  console.log(chalk.gray('  $ npx uts-plugin-cli uninstall jkr-abc-epay'))
  console.log(chalk.gray('  $ npx uts-plugin-cli update jkr-abc-epay'))
  console.log(chalk.gray('  $ npx uts-plugin-cli list'))
  console.log(chalk.gray('  $ npx uts-plugin-cli list --installed'))
  console.log('')
  console.log(chalk.cyan('私有仓库：'))
  console.log(chalk.gray('  $ npx uts-plugin-cli install jkr-abc-epay --token ghp_xxxx'))
  console.log(chalk.gray('  $ export GITHUB_TOKEN=ghp_xxxx'))
  console.log('')
  console.log(chalk.cyan('GitHub 仓库：'))
  console.log(chalk.gray('  https://github.com/junerver/UtsPlugins'))
})

program.parse()