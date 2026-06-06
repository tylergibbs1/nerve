/**
 * Assembly instruction generation (PRD §20.4).
 *
 * Generated from HIR only, in build order: materials → cut → twist →
 * populate → branch assembly → labels → inspection → test. Process-level
 * data (crimp heights, pull forces, tooling) arrives with the
 * Manufacturing Operations IR (PRD §28); these instructions cover what HIR
 * already knows.
 */
import type { Hir } from "@grayhaven/nerve"

export const assemblyInstructions = (hir: Hir): string => {
  const lines: Array<string> = []
  const section = (title: string) => {
    lines.push("", title, "-".repeat(title.length))
  }
  let step = 0
  const add = (text: string) => {
    step += 1
    lines.push(`${String(step).padStart(2, " ")}. ${text}`)
  }

  lines.push(
    `ASSEMBLY INSTRUCTIONS — ${hir.harness.id} rev ${hir.harness.revision}`,
    `Units: ${hir.harness.units}. Generated from HIR ${hir.schemaVersion}; every step references design object IDs.`
  )

  section("Materials")
  for (const item of hir.bom) {
    add(`Gather ${item.quantity}x ${item.mpn}${item.description !== undefined ? ` (${item.description})` : ""} — used by ${item.usedBy.join(", ")}.`)
  }

  section("Cut wires")
  for (const w of hir.wires) {
    const spec = [w.gauge, w.color].filter((s) => s !== undefined).join(" ")
    const len =
      w.length !== undefined
        ? `${w.length} ${hir.harness.units}${w.lengthTolerance !== undefined ? ` ±${w.lengthTolerance}` : ""}`
        : "length per board"
    add(`Cut ${w.id}: ${spec || "wire"}, ${len}${w.signal !== undefined ? ` [${w.signal}]` : ""}.`)
  }

  const twistGroups = new Map<string, Array<string>>()
  for (const w of hir.wires) {
    if (w.twistGroup === undefined) continue
    const list = twistGroups.get(w.twistGroup) ?? []
    list.push(w.id)
    twistGroups.set(w.twistGroup, list)
  }
  if (twistGroups.size > 0) {
    section("Twist pairs")
    for (const [group, wires] of [...twistGroups.entries()].sort()) {
      add(`Twist ${wires.join(" + ")} together (${group}).`)
    }
  }

  section("Populate connectors")
  for (const c of hir.connectors) {
    const wired = hir.wires.filter(
      (w) => w.from.connector === c.ref || w.to.connector === c.ref
    )
    add(`Populate ${c.ref} (${c.mpn}${c.gender !== undefined ? `, ${c.gender}` : ""}):`)
    for (const w of wired) {
      const end = w.from.connector === c.ref ? w.from : w.to
      lines.push(`      cavity ${end.pin}: ${w.id}${w.signal !== undefined ? ` (${w.signal})` : ""}`)
    }
  }

  if (hir.branches.length > 0) {
    section("Branch assembly")
    for (const b of hir.branches) {
      const parts = [
        `Route branch ${b.id} (${b.path.join(" → ")})`,
        b.nominalLength !== undefined ? `${b.nominalLength} ${hir.harness.units} nominal` : undefined,
        b.sleeve !== undefined ? `sleeve with ${b.sleeve}` : undefined
      ].filter((s): s is string => s !== undefined)
      add(parts.join("; ") + ".")
    }
  }

  if (hir.labels.length > 0) {
    section("Apply labels")
    for (const l of hir.labels) {
      const placement =
        l.offsetFrom !== undefined && l.distance !== undefined
          ? ` ${l.distance} ${hir.harness.units} from ${l.offsetFrom}`
          : ""
      add(`Apply ${l.id} "${l.text}" on ${l.attachTo}${placement}.`)
    }
  }

  section("Inspection")
  add("Verify every cavity against the pinout table; check seating/lock engagement.")
  add("Verify wire colors and labels against the schedule.")
  add("Verify branch lengths and sleeve coverage against the board drawing.")

  section("Test")
  add("Run the continuity-test procedure (tests.csv / test-plan.json); record results per test ID.")

  return lines.join("\n") + "\n"
}
