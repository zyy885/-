/**
 * 格式化例句显示：多个例句（换行分隔）用 / 符号连接
 * @param {string} ex - 原始例句文本
 * @returns {string} 格式化后的例句
 */
export function formatExample(ex) {
  if (!ex) return '';
  return ex.split(/\n+/).map(s => s.trim()).filter(Boolean).join(' / ');
}
