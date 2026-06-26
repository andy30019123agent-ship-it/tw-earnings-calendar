/** Shared label map and helpers for report types. Single source of truth. */
export const TYPE_LABEL = { 快報: '快報', 詳細: '詳細', 提醒: '提醒' }

/** Returns the CSS colour-class suffix for a given report type. */
export function typeColorClass(type) {
  return type === '法說會' ? 'conf' : 'earn'
}
