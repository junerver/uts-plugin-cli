# AGENTS.md - UTS Plugin CLI

## 项目概述

UTS 插件管理工具 - 从 GitHub 仓库安装 uni-app 原生插件。

## 仓库结构

```
uts-plugin-cli/
├── bin/
│   └── index.js                   # CLI 入口
├── src/
│   ├── commands/
│   │   ├── install.js             # 安装命令
│   │   ├── update.js              # 升级命令
│   │   ├── uninstall.js           # 卸载命令
│   │   ├── list.js                # 列表命令
│   │   ├── search.js              # 搜索命令
│   │   └── info.js                # 详情命令
│   ├── utils/
│   │   ├── download.js            # 下载工具
│   │   ├── fs.js                  # 文件系统工具
│   │   ├── external-files.js      # 外部文件处理模块
│   │   └── merge.js               # json5 合并工具
│   └── config.js                  # 配置文件
├── .github/
│   └── workflows/
│       └── publish.yml            # npm 发布工作流
├── package.json
└── README.md
```

## 核心模块

### external-files.js（外部文件处理）

负责处理插件的外部文件关联功能。

**主要函数：**
- `readPluginConfig(pluginPath)`: 读取插件配置文件
- `hasExternalFiles(pluginPath)`: 检查是否有外部文件
- `getExternalFiles(pluginPath)`: 获取外部文件列表
- `targetFileExists(targetPath)`: 检查目标文件是否存在
- `copyFile(sourcePath, targetPath)`: 复制文件
- `backupFile(filePath)`: 备份文件

### merge.js（json5 合并工具）

负责 json5 格式配置文件的解析和合并。

**主要函数：**
- `parseJson5File(filePath)`: 解析 json5 文件
- `writeJson5File(filePath, data)`: 写入 json5 文件
- `mergeJson5Files(targetPath, sourcePath, arrayKeys)`: 合并 json5 文件
  - `arrayKeys` 支持嵌套路径（如 `module.querySchemes`）
  - 为空时合并全部字段

### install.js（安装命令）

负责插件的安装和外部文件处理。

**关键流程：**
1. 下载插件文件到 `uni_modules/pluginName/`
2. 下载外部文件到 `uni_modules/pluginName/_external/`
3. 处理外部文件合并到项目配置
4. 清理 `_external` 目录和 `.uts-plugin.json` 文件

## 外部文件关联功能

### 路径解析规则

| 字段 | 路径起点 | 示例 |
|------|----------|------|
| `files[].path` | 插件目录 | `utssdk/app-harmony/config.json` |
| `externalFiles[].source` | 插件的 `_external` 目录 | `module.json5` |
| `externalFiles[].target` | 项目根目录 | `harmony-configs/entry/src/main/module.json5` |

### 配置格式

```json
{
  "externalFiles": [
    {
      "source": "module.json5",
      "target": "harmony-configs/entry/src/main/module.json5",
      "strategy": "merge",
      "description": "配置 querySchemes",
      "arrayKeys": ["module.querySchemes"]
    }
  ]
}
```

### 安装后清理

安装完成后会自动清理：
- `_external` 目录
- `.uts-plugin.json` 文件

## 开发规范

### 代码风格

- 使用 CommonJS 模块系统
- 遵循现有代码风格
- 不添加不必要的注释

### 提交规范

使用 Gitmoji 格式：

```
✨ [Feature]: 新增功能
🐛 [Fix]: 修复问题
📦 [Release]: 版本发布
🔧 [Fix]: 修复配置
```

### 版本管理

- 遵循 Semantic Versioning
- 更新 `package.json` 中的 `version`
- 创建对应的 git tag（如 `v1.1.1`）
- npm 会自动发布新版本

## 测试

### 端到端测试

1. 创建测试项目目录
2. 添加 `manifest.json` 和 `pages.json`
3. 创建现有的配置文件（如 `harmony-configs/entry/src/main/module.json5`）
4. 运行 CLI 安装命令
5. 验证合并结果和清理结果

### 测试命令

```bash
# 创建测试项目
mkdir -p test-project/harmony-configs/entry/src/main
cd test-project

# 运行安装
npx @junerver/uts-plugin-cli install jkr-abc-epay --force

# 验证结果
cat harmony-configs/entry/src/main/module.json5
ls -la uni_modules/jkr-abc-epay/
```

## 相关项目

- [UtsPlugins](https://github.com/junerver/UtsPlugins) - 插件仓库
