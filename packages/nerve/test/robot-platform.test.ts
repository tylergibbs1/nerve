import { describe, expect, it } from "vitest"
import { compileDesign, runRules } from "@grayhaven/nerve"
import { builtinRules } from "@grayhaven/nerve-rules"
import design from "../../../examples/robot-platform/src/main.harness.js"

/**
 * Dogfood fixture: a realistic medium harness (PRD §14 "medium" class edge).
 * Locks in that a non-trivial design — splice taps, CAN trunk, cable,
 * 3-level branch tree, composed drive modules — validates completely clean.
 */
describe("robot-platform harness (dogfood)", () => {
  const { hir, diagnostics } = compileDesign(design)

  it("compiles with zero structural diagnostics", () => {
    expect(diagnostics).toEqual([])
  })

  it("validates with zero errors AND zero warnings under all built-in rules", () => {
    expect(runRules(hir, builtinRules)).toEqual([])
  })

  it("has realistic scale", () => {
    expect(hir.connectors.length).toBe(22)
    expect(hir.wires.length).toBe(65)
    expect(hir.splices.length).toBe(4)
    expect(hir.branches.length).toBe(6)
    // CAN trunk: MCU + 4 drivers + IMU joined through the CAN_H splice.
    expect(hir.splices.find((s) => s.id === "S_CANH")?.wires).toHaveLength(6)
  })

  it("compiles a medium harness fast enough to feel interactive (PRD §14)", () => {
    const start = performance.now()
    for (let i = 0; i < 50; i++) compileDesign(design)
    const perCompile = (performance.now() - start) / 50
    expect(perCompile).toBeLessThan(50) // ms
  })
})
