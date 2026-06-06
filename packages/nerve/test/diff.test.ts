import { describe, expect, it } from "vitest"
import {
  compileDesign,
  diffHir,
  formatDiff,
  isEmptyDiff,
  label,
  wire,
  type HarnessDesign
} from "@grayhaven/nerve"
import design from "../../../examples/motor-controller/src/main.harness.js"

const hirOf = (d: HarnessDesign) => compileDesign(d).hir
const base = hirOf(design)

describe("diffHir (PRD §21)", () => {
  it("reports no differences for identical designs", () => {
    const d = diffHir(base, hirOf(design))
    expect(isEmptyDiff(d)).toBe(true)
    expect(formatDiff(d)).toBe("No differences.\n")
  })

  it("detects wire property and revision changes", () => {
    const revB = hirOf({
      ...design,
      revision: "B",
      wires: design.wires.map((w) =>
        w.id === "W1" ? { ...w, gauge: "16AWG", length: 450 } : w
      )
    })
    const d = diffHir(base, revB)
    expect(d.harness).toEqual([{ field: "revision", from: "A", to: "B" }])
    expect(d.wires.changed).toEqual([
      {
        id: "W1",
        changes: [
          { field: "gauge", from: "18AWG", to: "16AWG" },
          { field: "length", from: "420", to: "450" }
        ]
      }
    ])
    const text = formatDiff(d)
    expect(text).toContain("~ wire:W1")
    expect(text).toContain("gauge: 18AWG -> 16AWG")
  })

  it("detects added/removed wires and labels", () => {
    const j1 = design.connectors[0]!
    const m1 = design.connectors[1]!
    const revB = hirOf({
      ...design,
      wires: [
        ...design.wires.filter((w) => w.id !== "W4"),
        wire("W5", j1.pin(7), m1.pin(7), { gauge: "24AWG", color: "green", signal: "MOTOR_TEMP" })
      ],
      labels: [...design.labels, label("L2", { text: "MOTOR END", attachTo: "main" })]
    })
    const d = diffHir(base, revB)
    expect(d.wires.added).toEqual(["W5"])
    expect(d.wires.removed).toEqual(["W4"])
    expect(d.labels.added).toEqual(["L2"])
  })

  it("detects pinout changes (swapped pins) and connector changes", () => {
    const j1 = design.connectors[0]!
    const revB = hirOf({
      ...design,
      connectors: [
        // Swap CAN_H/CAN_L on J1 — the classic expensive mistake.
        { ...j1, pins: { ...j1.pins, "3": "CAN_L", "4": "CAN_H" } },
        design.connectors[1]!
      ]
    })
    const d = diffHir(base, revB)
    expect(d.pinouts).toEqual([
      { connector: "J1", pin: "3", from: "CAN_H", to: "CAN_L" },
      { connector: "J1", pin: "4", from: "CAN_L", to: "CAN_H" }
    ])
    expect(formatDiff(d)).toContain("connector:J1.pin:3: CAN_H -> CAN_L")
  })

  it("detects BOM quantity changes through connector changes", () => {
    const j1 = design.connectors[0]!
    const m1 = design.connectors[1]!
    const revB = hirOf({
      ...design,
      // Second receptacle of the same MPN → quantity 1 → 2.
      connectors: [j1, m1, { ...j1, ref: "J2", pin: j1.pin }]
    })
    const d = diffHir(base, revB)
    expect(d.connectors.added).toEqual(["J2"])
    expect(d.bom.changed[0]?.id).toBe("43025-0800")
    expect(d.bom.changed[0]?.changes[0]).toMatchObject({
      field: "quantity",
      from: "1",
      to: "2"
    })
  })
})
