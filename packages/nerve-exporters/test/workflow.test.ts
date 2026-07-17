import { describe, expect, it } from "vitest"
import { compileDesign, connector, harness, splice, variant, wire } from "@grayhaven/nerve"
import {
  createBuildRecord,
  createRedline,
  createRelease,
  computeImpact,
  formboardSheets,
  generateTestPlan,
  hirFingerprint,
  ReleaseBlockedError,
  resolveRedline,
  suggestPatch,
  validateRedlineTarget
} from "@grayhaven/nerve-exporters"
import motor from "../../../examples/motor-controller/src/main.harness.js"
import robot from "../../../examples/robot-platform/src/main.harness.js"

const { hir } = compileDesign(motor)
const { hir: robotHir } = compileDesign(robot)

describe("formboard 1:1 tiling (PRD §33)", () => {
  const board = formboardSheets(robotHir, { paper: "letter" })

  it("tiles the board into mm-true sheets with overlays", () => {
    expect(board.rows * board.cols).toBe(board.sheets.length)
    expect(board.sheets.length).toBeGreaterThan(1)
    const first = board.sheets[0]!
    // Physical units + viewBox window = true 1:1 print.
    expect(first.svg).toContain('width="259.4mm"')
    expect(first.svg).toContain("CALIBRATION 100 mm")
    expect(first.svg).toContain("R1C1 of")
    // Fiducial crosses on every sheet; ruler only on sheet 1.
    expect(board.sheets[1]!.svg).not.toContain("CALIBRATION")
    expect(board.sheets[1]!.svg).toContain("<circle")
  })

  it("is deterministic", () => {
    expect(formboardSheets(robotHir, { paper: "letter" })).toEqual(board)
  })
})

describe("ECO / release records (PRD §35)", () => {
  const release = createRelease(hir, {
    eco: { id: "ECO-001", reason: "Initial release", author: "tg" },
    createdAt: "2026-06-06"
  })

  it("captures ECO, fingerprint, and counts; fingerprint tracks content", () => {
    expect(release.releaseId).toBe("motor-controller-harness@A")
    expect(release.hirFingerprint).toBe(hirFingerprint(hir))
    expect(release.counts.tests).toBe(generateTestPlan(hir).tests.length)
    const changed = { ...hir, wires: hir.wires.slice(1) }
    expect(hirFingerprint(changed)).not.toBe(release.hirFingerprint)
  })

  it("computes impact and risk against the previous release", () => {
    const revB = compileDesign(
      variant(motor, {
        id: "motor-controller-harness",
        revision: "B",
        wires: { override: { W1: { length: 800 }, W2: { length: 800 } } },
        connectors: {} // shared
      })
    ).hir
    const next = createRelease(revB, {
      eco: { id: "ECO-002", reason: "Stretch to 800mm" },
      createdAt: "2026-06-07",
      previous: { hir, releaseId: release.releaseId }
    })
    expect(next.supersedes).toBe("motor-controller-harness@A")
    expect(next.impact).toMatchObject({ wireChanges: 2, pinoutChanges: 0, risk: "low" })
    // Swapped pins escalate risk: the §35 change-risk score weights pinouts.
    const swapped = compileDesign({
      ...motor,
      connectors: [
        { ...motor.connectors[0]!, pins: { ...motor.connectors[0]!.pins, "3": "CAN_L", "4": "CAN_H" } },
        motor.connectors[1]!
      ]
    }).hir
    expect(computeImpact(hir, swapped).pinoutChanges).toBe(2)
  })

  it("fails closed on validation errors", () => {
    const bad = {
      ...hir,
      diagnostics: [{ code: "X", severity: "error" as const, message: "boom" }]
    }
    expect(() =>
      createRelease(bad, { eco: { id: "ECO-X", reason: "no" }, createdAt: "2026-06-06" })
    ).toThrow(ReleaseBlockedError)
  })

  it("fails closed when an electrical net cannot be proven by a continuity test", () => {
    const part = { mpn: "P", pinCount: 1 }
    const j1 = connector("J1", part, { pins: { 1: "SIG" } })
    const s1 = splice("S1", { type: "crimp" })
    const untestable = compileDesign(
      harness("untestable-net", {
        revision: "A",
        units: "mm",
        connectors: [j1],
        splices: [s1],
        wires: [wire("W1", j1.pin(1), s1, { signal: "SIG" })]
      })
    ).hir

    expect(() =>
      createRelease(untestable, {
        eco: { id: "ECO-X", reason: "Incomplete verification boundary" },
        createdAt: "2026-06-06"
      })
    ).toThrow(ReleaseBlockedError)
  })
})

describe("build records (PRD §36)", () => {
  const release = createRelease(hir, {
    eco: { id: "ECO-001", reason: "Initial release" },
    createdAt: "2026-06-06"
  })
  const plan = generateTestPlan(hir)

  it("computes verdicts from measured resistances against the plan", () => {
    const measurements = plan.tests.map((t) => ({
      id: t.id,
      measuredOhms: t.expected === "closed" ? 0.4 : 5_000_000
    }))
    const record = createBuildRecord(hir, release, measurements, {
      serial: "SN-0001",
      operator: "tech-a",
      buildDate: "2026-06-06",
      materialLots: { "43025-0800": "LOT-44" },
      tools: { crimp: "63819-0000 cal 2026-05" }
    })
    expect(record.summary).toEqual({
      pass: plan.tests.length,
      fail: 0,
      notRun: 0,
      status: "pass"
    })
    expect(record.hirFingerprint).toBe(release.hirFingerprint)
  })

  it("fails a short and marks missing measurements not-run", () => {
    const measurements = [
      { id: "T-001", measuredOhms: 0.3 },
      // T-005 is a no-short check: 12 ohms = a short between nets.
      { id: "T-005", measuredOhms: 12 }
    ]
    const record = createBuildRecord(hir, release, measurements, {
      serial: "SN-0002",
      operator: "tech-a",
      buildDate: "2026-06-06"
    })
    expect(record.summary.status).toBe("fail")
    expect(record.results.find((r) => r.id === "T-005")?.verdict).toBe("fail")
    expect(record.results.find((r) => r.id === "T-002")?.verdict).toBe("not-run")
  })
})

describe("technician redlines (PRD §39)", () => {
  it("validates targets, resolves with retained reasons, suggests structured patches", () => {
    expect(validateRedlineTarget(hir, "wire:W1")).toBeUndefined()
    expect(validateRedlineTarget(hir, "wire:NOPE")?.code).toBe("HK-RED-001")

    const redline = createRedline({
      id: "RL-001",
      target: "wire:W1",
      type: "incorrect-length",
      description: "420mm comes up short on the bench; needs 450.",
      proposedValue: "450",
      release: "motor-controller-harness@A",
      serial: "SN-0001",
      reportedBy: "tech-a"
    })
    expect(redline.status).toBe("open")

    const accepted = resolveRedline(redline, {
      accept: true,
      reason: "Confirmed against fixture; strain relief needs the slack.",
      by: "engineer-b",
      resolvedAt: "2026-06-07"
    })
    expect(accepted.status).toBe("accepted")
    expect(suggestPatch(accepted)).toEqual({
      wires: { override: { W1: { length: 450 } } }
    })

    const rejected = resolveRedline(redline, {
      accept: false,
      reason: "Length verified correct; fixture peg was misplaced.",
      resolvedAt: "2026-06-07"
    })
    expect(rejected.status).toBe("rejected")
    expect(rejected.resolution?.reason).toContain("fixture peg")
  })
})
