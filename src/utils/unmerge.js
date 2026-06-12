const JSON5 = require('json5')
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

/**
 * 解析 json5 文件
 * @param {string} filePath - 文件路径
 * @returns {object|null} 解析后的对象
 */
function parseJson5File(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON5.parse(content)
  } catch (error) {
    return null
  }
}

/**
 * 写入 json5 文件
 * @param {string} filePath - 文件路径
 * @param {object} data - 要写入的数据
 */
function writeJson5File(filePath, data) {
  const content = JSON5.stringify(data, null, 2)
  fs.writeFileSync(filePath, content, 'utf-8')
}

/**
 * 根据路径获取嵌套对象的值
 * @param {object} obj - 对象
 * @param {string[]} path - 路径
 * @returns {any} 值
 */
function getNestedValue(obj, pathParts) {
  let current = obj
  for (const part of pathParts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = current[part]
  }
  return current
}

/**
 * 根据路径设置嵌套对象的值
 * @param {object} obj - 对象
 * @param {string[]} path - 路径
 * @param {any} value - 值
 */
function setNestedValue(obj, pathParts, value) {
  let current = obj
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i]
    if (current[part] === null || current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part]
  }
  current[pathParts[pathParts.length - 1]] = value
}

/**
 * 从数组中移除指定元素
 * @param {Array} targetArr - 目标数组
 * @param {Array} itemsToRemove - 要移除的元素
 * @returns {boolean} 是否有变更
 */
function removeArrayItems(targetArr, itemsToRemove) {
  if (!targetArr || !Array.isArray(targetArr) || !itemsToRemove) {
    return false
  }

  let changed = false
  const removeSet = new Set(itemsToRemove.map(item => JSON.stringify(item)))

  for (const item of itemsToRemove) {
    const itemStr = JSON.stringify(item)
    const index = targetArr.findIndex(arrItem => JSON.stringify(arrItem) === itemStr)
    if (index !== -1) {
      targetArr.splice(index, 1)
      changed = true
    }
  }

  return changed
}

/**
 * 查找外部文件在目标文件中的变更位置
 * @param {string} targetPath - 目标文件路径
 * @param {object} externalFile - 外部文件配置
 * @returns {object} 变更信息
 */
function findExternalChanges(targetPath, externalFile) {
  const targetData = parseJson5File(targetPath)
  if (!targetData) {
    return { found: false, changes: [] }
  }

  const sourcePath = externalFile.source
  const arrayKeys = externalFile.arrayKeys || []

  // 构建要查找的变更
  const changes = []

  // 如果指定了 arrayKeys，查找这些字段的变更
  if (arrayKeys.length > 0) {
    for (const key of arrayKeys) {
      const pathParts = key.split('.')
      const value = getNestedValue(targetData, pathParts)
      if (value && Array.isArray(value) && value.length > 0) {
        changes.push({
          path: key,
          pathParts,
          type: 'array',
          value: value,
          description: `数组 "${key}" 中的 ${value.length} 个元素`
        })
      }
    }
  } else {
    // 如果没有指定 arrayKeys，查找所有数组字段
    function findArrays(obj, currentPath = []) {
      for (const key of Object.keys(obj)) {
        const fullPath = [...currentPath, key]
        if (Array.isArray(obj[key]) && obj[key].length > 0) {
          changes.push({
            path: fullPath.join('.'),
            pathParts: fullPath,
            type: 'array',
            value: obj[key],
            description: `数组 "${fullPath.join('.')}" 中的 ${obj[key].length} 个元素`
          })
        } else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          findArrays(obj[key], fullPath)
        }
      }
    }
    findArrays(targetData)
  }

  return {
    found: changes.length > 0,
    changes,
    targetData
  }
}

/**
 * 移除外部文件的变更
 * @param {string} targetPath - 目标文件路径
 * @param {object} externalFile - 外部文件配置
 * @param {object} options - 选项
 * @returns {boolean} 是否有变更
 */
function removeExternalChanges(targetPath, externalFile, options = {}) {
  const { dryRun = false, force = false } = options

  const targetData = parseJson5File(targetPath)
  if (!targetData) {
    return false
  }

  const arrayKeys = externalFile.arrayKeys || []
  let changed = false

  // 如果指定了 arrayKeys，只移除这些字段中的元素
  if (arrayKeys.length > 0) {
    for (const key of arrayKeys) {
      const pathParts = key.split('.')
      const value = getNestedValue(targetData, pathParts)
      if (value && Array.isArray(value)) {
        // 清空数组（移除所有通过外部文件添加的元素）
        if (!dryRun) {
          setNestedValue(targetData, pathParts, [])
          changed = true
          console.log(chalk.gray(`  移除: ${key} 中的所有元素`))
        } else {
          changed = true
          console.log(chalk.gray(`  将移除: ${key} 中的所有元素`))
        }
      }
    }
  }

  if (changed && !dryRun) {
    writeJson5File(targetPath, targetData)
  }

  return changed
}

module.exports = {
  parseJson5File,
  writeJson5File,
  findExternalChanges,
  removeExternalChanges
}