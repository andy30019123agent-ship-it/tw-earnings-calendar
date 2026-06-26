import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './reports'

describe('parseFrontmatter', () => {
  it('擷取 frontmatter 與內文', () => {
    const raw = `---\nid: 2330\nname: 台積電\ndate: 2026-06-27\ntype: 快報\n---\n內文一行`
    const r = parseFrontmatter(raw)
    expect(r.id).toBe('2330')
    expect(r.type).toBe('快報')
    expect(r.body.trim()).toBe('內文一行')
  })
})
