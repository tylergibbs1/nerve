import { describe, expect, it } from "vitest"
import { analyzeElectricalConstraints, compileDesign } from "@grayhaven/nerve"
import { graphJson } from "@grayhaven/nerve-exporters"
import design from "../../../examples/motor-controller/src/main.harness.js"

const { hir } = compileDesign(design)

describe("graph.json electrical semantics", () => {
  it("exports declared pin constraints and preserves unknown pins as unknown", () => {
    const graph = JSON.parse(graphJson(hir))
    const source = graph.nodes.find((node: { id: string }) => node.id === "connector:J1.pin:1")
    const unknown = graph.nodes.find((node: { id: string }) => node.id === "connector:J1.pin:5")

    expect(source.electrical).toEqual({
      role: "source",
      voltage: { minV: 22, maxV: 26 },
      currentA: 5
    })
    expect(unknown).not.toHaveProperty("electrical")
  })

  it("includes the deterministic electrical analysis as review evidence", () => {
    const analysis = analyzeElectricalConstraints(hir)
    const first = graphJson(hir)

    expect(analysis.findings).toEqual([])
    expect(JSON.parse(first).electrical).toEqual(analysis)
    expect(graphJson(hir)).toBe(first)
  })
})
