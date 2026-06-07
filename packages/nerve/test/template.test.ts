import { describe, expect, it } from "vitest"
import {
  compileDesign,
  connector,
  harness,
  harnessTemplate,
  hasErrors,
  mergeFragments,
  prefixRefs,
  splice,
  wire,
  type ConnectorPart,
  type HarnessFragment
} from "@grayhaven/nerve"

const sensorPart: ConnectorPart = { mpn: "PHR-4", pinCount: 4 }
const trunkPart: ConnectorPart = { mpn: "TRUNK-16", pinCount: 16 }

// External trunk connector the drops plug into — NOT part of any fragment.
const trunk = connector("J1", trunkPart, {
  pins: { 1: "CAN_H", 2: "CAN_L", 3: "CAN_H", 4: "CAN_L" }
})

/** PRD §18's example shape: a parametric CAN sensor drop. */
const canDrop = harnessTemplate(
  "can-sensor-drop",
  (opts: { trunkHPin: number; trunkLPin: number; length: number }): HarnessFragment => {
    const sensor = connector("SENSOR", sensorPart, { pins: { 1: "CAN_H", 2: "CAN_L" } })
    return {
      connectors: [sensor],
      wires: [
        wire("CAN-H", trunk.pin(opts.trunkHPin), sensor.pin(1), {
          signal: "CAN_H",
          gauge: "24AWG",
          color: "white",
          length: opts.length,
          twistGroup: "drop-twist"
        }),
        wire("CAN-L", trunk.pin(opts.trunkLPin), sensor.pin(2), {
          signal: "CAN_L",
          gauge: "24AWG",
          color: "blue",
          length: opts.length,
          twistGroup: "drop-twist"
        })
      ]
    }
  }
)

const build = () => {
  const d1 = prefixRefs("D1", canDrop({ trunkHPin: 1, trunkLPin: 2, length: 300 }))
  const d2 = prefixRefs("D2", canDrop({ trunkHPin: 3, trunkLPin: 4, length: 450 }))
  const drops = mergeFragments(d1, d2)
  return harness("template-fixture", {
    revision: "A",
    units: "mm",
    connectors: [trunk, ...(drops.connectors ?? [])],
    wires: [...(drops.wires ?? [])],
    splices: [...(drops.splices ?? [])],
    cables: [...(drops.cables ?? [])],
    branches: [...(drops.branches ?? [])],
    labels: [...(drops.labels ?? [])]
  })
}

describe("harnessTemplate + prefixRefs (PRD §18)", () => {
  it("two instances coexist without collisions; external refs untouched", () => {
    const { hir, diagnostics } = compileDesign(build())
    expect(hasErrors(diagnostics)).toBe(false)
    expect(hir.connectors.map((c) => c.ref)).toEqual(["D1-SENSOR", "D2-SENSOR", "J1"])
    expect(hir.wires.map((w) => w.id)).toEqual(["D1-CAN-H", "D1-CAN-L", "D2-CAN-H", "D2-CAN-L"])
    // Internal endpoint rewritten, external trunk endpoint untouched.
    const w = hir.wires.find((x) => x.id === "D2-CAN-H")!
    expect(w.from).toEqual({ connector: "J1", pin: "3" })
    expect(w.to).toEqual({ connector: "D2-SENSOR", pin: "1" })
  })

  it("is deterministic: same options, byte-identical HIR", () => {
    expect(JSON.stringify(compileDesign(build()).hir)).toBe(
      JSON.stringify(compileDesign(build()).hir)
    )
  })

  it("carries the template name for tooling", () => {
    expect(canDrop.templateName).toBe("can-sensor-drop")
  })

  it("rewrites splice endpoints, branch parents, and wire→cable refs", () => {
    const frag: HarnessFragment = {
      splices: [splice("SP", { branch: "stub" })],
      branches: [
        { kind: "branch", id: "stub", path: [], parent: "outside" },
        { kind: "branch", id: "sub", path: [], parent: "stub" }
      ],
      wires: [wire("W", connector("C", sensorPart, { pins: { 1: "X" } }).pin(1), splice("SP"))],
      connectors: [connector("C", sensorPart, { pins: { 1: "X" } })],
      cables: [{ kind: "cable", id: "K" }]
    }
    const out = prefixRefs("T", frag)
    expect(out.splices?.[0]).toMatchObject({ id: "T-SP", branch: "T-stub" })
    // Internal parent prefixed; external parent untouched.
    expect(out.branches?.map((b) => b.parent)).toEqual(["outside", "T-stub"])
    expect(out.wires?.[0]?.to).toEqual({ kind: "splice-ref", splice: "T-SP" })
    expect(out.wires?.[0]?.from).toEqual({ kind: "pin-ref", connector: "T-C", pin: "1" })
    expect(out.cables?.[0]?.id).toBe("T-K")
    // Rebuilt connector's pin() closes over the new ref.
    expect(out.connectors?.[0]?.pin(1)).toEqual({ kind: "pin-ref", connector: "T-C", pin: "1" })
  })
})
