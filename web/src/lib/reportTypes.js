/** Shared label map and helpers for report types. Single source of truth. */
export const TYPE_LABEL = { 快報: '快報', 財報: '財報', 法說會: '法說會', 詳細: '法說會' }

/** Report types available as filters (in display order). */
export const TYPE_ORDER = ['快報', '財報', '法說會']

/** Returns the CSS colour-class suffix for a given report type. */
export function typeColorClass(type) {
  if (type === '財報') return 'earn'
  if (type === '法說會' || type === '詳細') return 'conf'
  return 'flash' // 快報（預設）
}
