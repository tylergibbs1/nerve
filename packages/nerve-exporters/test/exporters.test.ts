import { describe, expect, it } from "vitest"
import { compileDesign } from "@grayhaven/nerve"
import {
  bomCsv,
  buildPacket,
  canRelease,
  coverage,
  cutListCsv,
  generateTestPlan,
  labelScheduleCsv,
  schematicSvg,
  testPlanCsv
} from "@grayhaven/nerve-exporters"
import design from "../../../examples/motor-controller/src/main.harness.js"

const { hir } = compileDesign(design)

describe("CSV exporters (PRD §20)", () => {
  it("BOM has the §20.1 columns and connector rollup", () => {
    const csv = bomCsv(hir)
    const [header, ...rows] = csv.trim().split("\n")
    expect(header).toBe(
      "Item number,Quantity,Unit of measure,Internal part number,Manufacturer,Manufacturer part number,Description,Category,Used by,Approved alternates,Notes"
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain("43020-0800")
    expect(rows[0]).toContain("connector:M1")
    expect(csv).toMatchSnapshot()
  })

  it("cut list has the §20.2 columns, with default tolerance applied", () => {
    const csv = cutListCsv(hir, { defaultWireTolerance: 10 })
    const lines = csv.trim().split("\n")
    expect(lines[0]).toBe(
      "Wire ID,Signal,Gauge,Color,Stripe,Cut length,Finished length,Tolerance,From connector,From pin,To connector,To pin,Terminal A,Terminal B,Branch,Notes"
    )
    expect(lines[1]).toBe("W1,VBAT_24V,18AWG,red,,420,420,10,J1,1,M1,1,,,,")
    expect(csv).toMatchSnapshot()
  })

  it("label schedule has the §20.3 columns", () => {
    const csv = labelScheduleCsv(hir)
    const lines = csv.trim().split("\n")
    expect(lines[1]).toBe("L1,MOTOR CTRL A,1,,,main,50 from J1,,")
    expect(csv).toMatchSnapshot()
  })

  it("escapes cells containing commas and quotes", () => {
    const { hir: tricky } = compileDesign({
      ...design,
      labels: [
        {
          kind: "label",
          id: "L1",
          text: 'MOTOR "A", MAIN',
          attachTo: "main"
        }
      ]
    })
    expect(labelScheduleCsv(tricky)).toContain('"MOTOR ""A"", MAIN"')
  })
})

describe("test plan (PRD §9.9)", () => {
  const plan = generateTestPlan(hir)

  it("generates one continuity test per wire, matching the PRD shape", () => {
    const continuity = plan.tests.filter((t) => t.type === "continuity")
    expect(continuity).toHaveLength(4)
    expect(continuity[0]).toEqual({
      id: "T-001",
      type: "continuity",
      from: { connector: "J1", pin: "1" },
      to: { connector: "M1", pin: "1" },
      expected: "closed",
      net: "VBAT_24V",
      wire: "W1"
    })
  })

  it("generates no-short tests between distinct nets on each connector", () => {
    const noShort = plan.tests.filter((t) => t.type === "no-short")
    // 4 nets per connector → C(4,2)=6 pairs × 2 connectors.
    expect(noShort).toHaveLength(12)
    expect(noShort.every((t) => t.expected === "open")).toBe(true)
  })

  it("covers every wired net (acceptance criterion)", () => {
    const { nets, covered } = coverage(hir, plan)
    expect(covered).toBe(nets)
  })

  it("CSV form is deterministic", () => {
    expect(testPlanCsv(plan)).toBe(testPlanCsv(generateTestPlan(hir)))
    expect(testPlanCsv(plan)).toMatchSnapshot()
  })
})

describe("SVG schematic (PRD §9.5.1)", () => {
  const svg = schematicSvg(hir)

  it("renders title block, connectors, pins, and wires", () => {
    expect(svg).toContain("motor-controller-harness")
    expect(svg).toContain("rev A")
    expect(svg).toContain(">J1<")
    expect(svg).toContain(">M1<")
    expect(svg).toContain("43025-0800")
    expect(svg).toContain("W1 · 18AWG")
    expect(svg).toContain("W3 · 24AWG · twisted")
    expect(svg).toMatchSnapshot()
  })

  it("highlights wires with error diagnostics", () => {
    const withError = {
      ...hir,
      diagnostics: [
        {
          code: "HK-WIRE-004",
          severity: "error" as const,
          message: "test",
          target: "wire:W1"
        }
      ]
    }
    expect(schematicSvg(withError)).toContain('stroke="#d11"')
  })

  it("is deterministic", () => {
    expect(schematicSvg(hir)).toBe(svg)
  })
})

describe("manufacturing packet (PRD §9.8)", () => {
  it("contains all artifacts and is byte-deterministic", () => {
    const a = buildPacket(hir, { defaultWireTolerance: 10 })
    const b = buildPacket(hir, { defaultWireTolerance: 10 })
    expect([...a.files.keys()]).toEqual([
      "COVER.txt",
      "harness.json",
      "schematic.svg",
      "bom.csv",
      "cut-list.csv",
      "labels.csv",
      "tests.csv",
      "test-plan.json"
    ])
    expect(Buffer.from(a.zip).equals(Buffer.from(b.zip))).toBe(true)
  })

  it("cover sheet carries revision metadata, not timestamps", () => {
    const { files } = buildPacket(hir)
    const cover = files.get("COVER.txt")!
    expect(cover).toContain("Revision:     A")
    expect(cover).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it("release gate fails closed on errors", () => {
    expect(canRelease(hir)).toBe(true)
    expect(
      canRelease({
        ...hir,
        diagnostics: [
          { code: "X", severity: "error", message: "boom" }
        ]
      })
    ).toBe(false)
  })
})
