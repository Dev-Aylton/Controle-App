export function findUnsafeRoleChecks(sql) {
  const unsafe = []
  const lines = sql.split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const memberRisk = /member_role\s*\([^)]*\)\s*(?:not\s+in|<>|!=)/i.test(line)
    const coalesced = /coalesce\s*\(\s*public\.member_role/i.test(line)
    const enumEmptyFallback = /coalesce\s*\(\s*public\.member_role\s*\([^)]*\)\s*,\s*''/i.test(line)
    if ((memberRisk && !coalesced) || enumEmptyFallback) unsafe.push({ line: index + 1, text: line.trim() })
  }
  return unsafe
}
