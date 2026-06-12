const JSON5 = require('json5')
const fs = require('fs')

/**
 * 解析json5文件
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
    console.error(`解析json5文件失败: ${filePath}`, error.message)
    return null
  }
}

/**
 * 写入json5文件
 * @param {string} filePath - 文件路径
 * @param {object} data - 要写入的数据
 */
function writeJson5File(filePath, data) {
  const content = JSON5.stringify(data, null, 2)
  fs.writeFileSync(filePath, content, 'utf-8')
}

/**
 * 深度合并两个对象
 * @param {object} target - 目标对象
 * @param {object} source - 源对象
 * @returns {object} 合并后的对象
 */
function deepMerge(target, source) {
  const result = { ...target }
  
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key], source[key])
      } else {
        result[key] = deepMerge({}, source[key])
      }
    } else if (Array.isArray(source[key])) {
      if (Array.isArray(result[key])) {
        result[key] = [...result[key], ...source[key]]
      } else {
        result[key] = [...source[key]]
      }
    } else {
      result[key] = source[key]
    }
  }
  
  return result
}

/**
 * 合并json5文件（追加数组元素）
 * @param {string} targetPath - 目标文件路径
 * @param {string} sourcePath - 源文件路径
 * @param {string[]} arrayKeys - 需要追加的数组键名，支持嵌套路径如 "module.querySchemes"
 * @returns {object} 合并后的对象
 */
function mergeJson5Files(targetPath, sourcePath, arrayKeys = []) {
  const targetData = parseJson5File(targetPath)
  const sourceData = parseJson5File(sourcePath)
  
  if (!sourceData) {
    return targetData
  }
  
  if (!targetData) {
    return sourceData
  }
  
  // 先复制目标数据
  const result = JSON.parse(JSON.stringify(targetData))
  
  // 判断是否需要对所有数组进行去重追加
  // arrayKeys 为空或不填时，合并全部字段（包括数组去重追加）
  const mergeAllArrays = !arrayKeys || arrayKeys.length === 0
  
  // 解析嵌套路径，如 "module.querySchemes" -> ["module", "querySchemes"]
  function parsePath(pathStr) {
    return pathStr.split('.').filter(Boolean)
  }
  
  // 检查指定路径是否是需要去重追加的数组
  function isArrayKey(pathParts) {
    if (mergeAllArrays) return true
    
    const pathStr = pathParts.join('.')
    return arrayKeys.some(key => {
      const keyParts = parsePath(key)
      // 完全匹配或前缀匹配（用于嵌套对象内的数组）
      return keyParts.join('.') === pathStr || 
             (pathStr.startsWith(keyParts.slice(0, -1).join('.') + '.') && 
              pathStr.endsWith('.' + keyParts[keyParts.length - 1]))
    })
  }
  
  // 递归合并对象
  function mergeObjects(target, source, currentPath = []) {
    for (const key of Object.keys(source)) {
      const currentKeyPath = [...currentPath, key]
      
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          mergeObjects(target[key], source[key], currentKeyPath)
        } else {
          target[key] = JSON.parse(JSON.stringify(source[key]))
        }
      } else if (Array.isArray(source[key])) {
        // 判断是否需要去重追加
        if (isArrayKey(currentKeyPath)) {
          if (!target[key]) {
            target[key] = []
          }
          // 去重追加
          const existingSet = new Set(target[key].map(item => JSON.stringify(item)))
          for (const item of source[key]) {
            const itemStr = JSON.stringify(item)
            if (!existingSet.has(itemStr)) {
              target[key].push(item)
              existingSet.add(itemStr)
            }
          }
        } else {
          // 不在 arrayKeys 中的数组，直接覆盖
          target[key] = JSON.parse(JSON.stringify(source[key]))
        }
      } else {
        target[key] = source[key]
      }
    }
  }
  
  mergeObjects(result, sourceData)
  
  return result
}

/**
 * 覆盖json5文件
 * @param {string} targetPath - 目标文件路径
 * @param {string} sourcePath - 源文件路径
 * @returns {object} 覆盖后的对象
 */
function overwriteJson5Files(targetPath, sourcePath) {
  const sourceData = parseJson5File(sourcePath)
  if (!sourceData) {
    return null
  }
  return sourceData
}

module.exports = {
  parseJson5File,
  writeJson5File,
  deepMerge,
  mergeJson5Files,
  overwriteJson5Files
}