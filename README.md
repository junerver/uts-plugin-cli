# UTS Plugin CLI

UTS 插件管理工具 - 从 GitHub 仓库安装 uni-app 原生插件

## 安装

```bash
npm install -g @junerver/uts-plugin-cli
```

或者直接使用 npx：

```bash
npx @junerver/uts-plugin-cli <command>
```

## 使用方法

### 列出可用插件

```bash
npx @junerver/uts-plugin-cli list
```

### 安装插件

在 uni-app 项目根目录下执行：

```bash
npx @junerver/uts-plugin-cli install <plugin-name>
```

示例：

```bash
cd my-uni-app
npx @junerver/uts-plugin-cli install jkr-abc-epay
```

### 卸载插件

```bash
npx @junerver/uts-plugin-cli uninstall <plugin-name>
```

强制卸载（不提示确认）：

```bash
npx @junerver/uts-plugin-cli uninstall <plugin-name> --force
```

### 升级插件

```bash
npx @junerver/uts-plugin-cli update <plugin-name>
```

### 查看已安装插件

```bash
npx @junerver/uts-plugin-cli list --installed
```

## 命令别名

| 命令 | 别名 |
|------|------|
| `install` | `i` |
| `uninstall` | `rm` |
| `update` | `u` |
| `list` | `ls` |

示例：

```bash
npx @junerver/uts-plugin-cli i jkr-abc-epay
npx @junerver/uts-plugin-cli rm jkr-abc-epay
npx @junerver/uts-plugin-cli u jkr-abc-epay
npx @junerver/uts-plugin-cli ls
```

## 网络代理

如果无法访问 GitHub，可设置 HTTP 代理：

### PowerShell

```powershell
$Env:HTTPS_PROXY="http://127.0.0.1:7890"
npx @junerver/uts-plugin-cli list
```

### CMD

```cmd
set HTTPS_PROXY=http://127.0.0.1:7890
npx @junerver/uts-plugin-cli list
```

### Linux/Mac

```bash
export HTTPS_PROXY=http://127.0.0.1:7890
npx @junerver/uts-plugin-cli list
```

## 插件来源

所有插件来自 GitHub 仓库：[junerver/UtsPlugins](https://github.com/junerver/UtsPlugins)

CLI 通过读取仓库根目录的 `plugins.json` 文件获取插件列表和文件信息。

## 自动化流程

UtsPlugins 仓库配置了 **husky + pre-commit hook**，每次提交时会自动：

1. 检测 `uni_modules/` 目录是否有变更
2. 如果有变更，自动运行 `scripts/generate-manifest.js`
3. 更新 `plugins.json` 文件并添加到暂存区

**开发者只需正常提交代码，plugins.json 会自动同步。**

## 添加新插件

1. 在 `uni_modules/` 目录下创建新插件
2. 正常提交代码
3. pre-commit hook 会自动更新 `plugins.json`

无需手动维护文件清单！

## 私有仓库

对于私有仓库，需要提供 GitHub token：

```bash
# 通过命令行参数
npx @junerver/uts-plugin-cli install jkr-abc-epay --token ghp_xxxx

# 通过环境变量
export GITHUB_TOKEN=*** @junerver/uts-plugin-cli install jkr-abc-epay
```

## 注意事项

1. **必须在 uni-app 项目根目录下执行安装命令**（需要有 `manifest.json` 或 `pages.json` 文件）
2. 安装后的插件位于项目的 `uni_modules/` 目录下
3. 使用插件时需要添加条件编译指令：

```typescript
// #ifdef APP-HARMONY
import { xxx } from "@/uni_modules/plugin-name"
// #endif
```

## License

MIT