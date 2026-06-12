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

安装时如果插件包含外部文件（如鸿蒙配置文件），会提示选择处理方式：
- **merge** - 深度合并（推荐），智能合并配置项
- **overwrite** - 完全覆盖现有文件
- **skip** - 跳过不处理

使用 `--force` 参数可跳过交互提示，自动使用插件指定的默认策略：

```bash
npx @junerver/uts-plugin-cli install jkr-abc-epay --force
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

| 命令        | 别名 |
| ----------- | ---- |
| `install`   | `i`  |
| `uninstall` | `rm` |
| `update`    | `u`  |
| `list`      | `ls` |

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
export GITHUB_TOKEN=*** npx @junerver/uts-plugin-cli install jkr-abc-epay
```

## 注意事项

1. **必须在 uni-app 项目根目录下执行安装命令**（需要有 `manifest.json` 或 `pages.json` 文件）
2. 安装后的插件位于项目的 `uni_modules/` 目录下
3. 使用插件时需要添加条件编译指令：

```typescript
// #ifdef APP-HARMONY
import { xxx } from "@/uni_modules/plugin-name";
// #endif
```

## 外部文件关联

某些插件（如鸿蒙SDK插件）需要修改项目根目录下的配置文件。CLI支持声明外部关联文件，安装时自动处理合并。

### 目录结构

插件仓库中的目录结构：

```
uni_modules/jkr-abc-epay/
├── .uts-plugin.json          # 外部文件声明（可选）
├── _external/                # 外部文件存储目录（约定）
│   └── module.json5          # 外部配置文件片段
├── utssdk/                   # 插件自身文件
└── package.json
```

- `_external` 目录：约定的外部文件存储目录，**不会收录到 `files` 中**
- `.uts-plugin.json`：声明外部文件的处理规则
- **安装后会自动清理** `_external` 目录和 `.uts-plugin.json` 文件

### 配置格式

插件目录下创建 `.uts-plugin.json` 文件：

```json
{
  "externalFiles": [
    {
      "source": "module.json5",
      "target": "harmony-configs/entry/src/main/module.json5",
      "strategy": "merge",
      "description": "配置ACL 受限权限",
      "arrayKeys": ["module.querySchemes"]
    }
  ]
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `source` | 源文件路径（相对于插件的 `_external` 目录） |
| `target` | 目标文件路径（相对于项目根目录） |
| `strategy` | 默认处理策略：`merge`（合并）、`overwrite`（覆盖） |
| `description` | 文件描述（可选） |
| `arrayKeys` | 需要追加去重的数组键名（仅 merge 策略生效）。**为空或不填时，合并全部字段** |

### arrayKeys 说明

`arrayKeys` 支持嵌套路径，使用点号分隔：

```json
{
  "arrayKeys": ["module.querySchemes"]
}
```

- `"module.querySchemes"`：表示 `module` 对象下的 `querySchemes` 数组需要去重追加
- 为空数组 `[]` 或不填时：所有数组字段都会去重追加

### 路径解析规则

| 字段 | 路径起点 | 示例 |
|------|----------|------|
| `files[].path` | 插件目录 | `utssdk/app-harmony/config.json` |
| `externalFiles[].source` | 插件的 `_external` 目录 | `module.json5` |
| `externalFiles[].target` | 项目根目录 | `harmony-configs/entry/src/main/module.json5` |

### 支持的配置文件

目前主要支持鸿蒙系统的 json5 格式配置文件：

1. `/harmony-configs/oh-package.json5` - 项目依赖文件
2. `/harmony-configs/build-profile.json5` - 数字签名配置
3. `/harmony-configs/entry/src/main/module.json5` - ACL 权限配置
4. `/harmony-configs/AppScope/app.json5` - 应用名称和版本信息

## License

MIT
