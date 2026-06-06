import { describe, expect, it } from "vitest"
import { compileDesign } from "@grayhaven/nerve"
import {
  analyzeHarness,
  analysisCsv,
  exportConnectorContract,
  genericCutStripCsv,
  genericLabelPrinterCsv,
  genericTesterJson,
  importPinoutCsv,
  validateContract
} from "@grayhaven/nerve-exporters"
import motor from "../../../examples/motor-controller/src/main.harness.js"
import robot from "../../../examples/robot-platform/src/main.harness.js"

const { hir } = compileDesign(robot)
const { hir: motorHir } = compileDesign(motor)

describe("engineering analysis (PRD §34)", () => {
  const report = analyzeHarness(hir)

  it("computes per-wire resistance from gauge and length", () => {
    const w = report.wires.find((x) => x.id === "W_BAT_P")!
    // 12AWG, 80mm → 0.00521 Ω/m × 0.08 m
    expect(w.resistanceOhms).toBeCloseTo(0.0004, 4)
  })

  it("estimates bundle diameter per branch and harness totals", () => {
    const spine = report.branches.find((b) => b.id === "spine")!
    expect(spine.wireCount).toBeGreaterThan(3)
    expect(spine.bundleDiameterMm).toBeGreaterThan(5)
    expect(report.totals.wireLengthM).toBeGreaterThan(10)
    expect(report.totals.estimatedWeightG).toBeGreaterThan(50)
  })

  it("aggregates current across splices and reports voltage drop when current is known", () => {
    const { hir: withCurrent } = compileDesign({
      ...motor,
      wires: motor.wires.map((w) =>
        w.id === "W1" ? { ...w, currentEstimate: 4 } : w
      )
    })
    const r = analyzeHarness(withCurrent)
    const w1 = r.wires.find((x) => x.id === "W1")!
    // 20AWG 0.42m → 0.014 Ω; ×4A ≈ 0.056V
    expect(w1.voltageDropV).toBeCloseTo(0.056, 2)
  })

  it("is deterministic and exports CSV", () => {
    expect(analyzeHarness(hir)).toEqual(report)
    expect(analysisCsv(hir)).toContain("harness,total wire length")
  })
})

describe("shop-floor adapters (PRD §31)", () => {
  it("cut/strip adapter emits rows with revision metadata and HIR refs", () => {
    const { files, diagnostics } = genericCutStripCsv.generate(hir)
    const csv = files.get("cut-strip.machine.csv")!
    expect(csv).toContain("# revision: A")
    expect(csv).toContain("wire:W_BAT_P")
    expect(diagnostics).toEqual([])
  })

  it("skips unbuildable rows with structured diagnostics, not throws", () => {
    // Motor fixture: W3/W4 have no length → two warnings, rows skipped.
    const { files, diagnostics } = genericCutStripCsv.generate(motorHir)
    expect(diagnostics.map((d) => d.code)).toEqual(["HK-ADAPT-002", "HK-ADAPT-002"])
    expect(files.get("cut-strip.machine.csv")).not.toContain("W3,")
  })

  it("label printer and tester adapters emit per-object rows", () => {
    const labels = genericLabelPrinterCsv.generate(hir)
    expect(labels.files.get("labels.machine.csv")).toContain("L1,GH-R1 SPINE,1")
    const tester = genericTesterJson.generate(hir)
    const program = JSON.parse(tester.files.get("tester.program.json")!)
    expect(program.revision).toBe("A")
    expect(program.steps.length).toBeGreaterThan(50)
    expect(program.steps[0]).toMatchObject({ mode: "continuity", thresholdOhms: 2 })
  })

  it("rejects unknown HIR schema versions", () => {
    const future = { ...hir, schemaVersion: "9.9.9" as never }
    const { diagnostics } = genericTesterJson.generate(future)
    expect(diagnostics[0]?.code).toBe("HK-ADAPT-001")
  })
})

describe("interface contracts (PRD §37)", () => {
  const contract = exportConnectorContract(motorHir, "J1")!

  it("exports the harness-side pinout with revision metadata", () => {
    expect(contract.mpn).toBe("43025-0800")
    expect(contract.harness).toEqual({ id: "motor-controller-harness", revision: "A" })
    expect(contract.pinout.find((p) => p.pin === "3")?.signal).toBe("CAN_H")
  })

  it("a harness validates against its own exported contract", () => {
    expect(validateContract(motorHir, contract)).toEqual([])
  })

  it("detects swapped pins between PCB and harness (the §37 headline case)", () => {
    const swapped = {
      ...contract,
      pinout: contract.pinout.map((p) =>
        p.pin === "3" ? { ...p, signal: "CAN_L" } : p.pin === "4" ? { ...p, signal: "CAN_H" } : p
      )
    }
    const diags = validateContract(motorHir, swapped)
    expect(diags.map((d) => d.code)).toEqual(["HK-IFC-004", "HK-IFC-004"])
    expect(diags[0]?.message).toContain("harness carries CAN_H but the contract requires CAN_L")
  })

  it("detects missing and extra pins, and imports pinout CSV", () => {
    const fromCsv = importPinoutCsv("pin,signal\n1,VBAT_24V\n2,GND\n9,MYSTERY\n", {
      connector: "J1",
      mpn: "43025-0800"
    })
    const diags = validateContract(motorHir, fromCsv)
    const codes = diags.map((d) => d.code)
    expect(codes).toContain("HK-IFC-003") // contract pin 9 missing from harness
    expect(codes).toContain("HK-IFC-005") // harness pins 3-8 uncovered
  })
})
