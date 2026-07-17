import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { compileDesign } from "@grayhaven/nerve"
import { importWireViz } from "@grayhaven/nerve-wireviz"

const corpusDir = join(import.meta.dirname, "fixtures", "jpl-open-source-rover")
const readCorpus = (name: string): string => readFileSync(join(corpusDir, name), "utf8")
const prependYaml = [readCorpus("templates.yml")]

const encoderColors = ["red", "black", "red", "black", "blue", "white"]
const encoderGauges = ["18AWG", "18AWG", "22AWG", "22AWG", "22AWG", "22AWG"]
const encoderSignals = ["M+", "M-", "5V", "G", "EnA", "EnB"]

const cases = [
  {
    name: "back_encoder",
    title: "Back Encoder Cable (x2)",
    connectors: 4,
    cables: 2,
    lengths: [410, 410, 460, 460, 460, 460],
    gauges: encoderGauges,
    colors: encoderColors,
    toPins: ["1", "1", "1", "2", "3", "4"],
    signals: encoderSignals
  },
  {
    name: "back_servo",
    title: "Back Servo Cable (x2)",
    connectors: 2,
    cables: 1,
    lengths: [540, 540, 540],
    gauges: ["20AWG", "20AWG", "20AWG"],
    colors: ["white", "red", "black"],
    toPins: ["1", "2", "3"],
    signals: ["PWM", "+", "GND"]
  },
  {
    name: "encoder_extension",
    title: "Corner Encoder Extension Cable (x4)",
    connectors: 2,
    cables: 1,
    lengths: [360, 360, 360, 360],
    gauges: ["22AWG", "22AWG", "22AWG", "22AWG"],
    colors: ["red", "black", "blue", "white"],
    toPins: ["4", "3", "2", "1"],
    signals: ["5V", "GND", "EnA", "EnB"]
  },
  {
    name: "front_encoder",
    title: "Front Encoder Cable (x2)",
    connectors: 4,
    cables: 2,
    lengths: [540, 540, 530, 530, 530, 530],
    gauges: encoderGauges,
    colors: encoderColors,
    toPins: ["1", "1", "1", "2", "3", "4"],
    signals: encoderSignals
  },
  {
    name: "front_servo",
    title: "Front Servo Cable (x2)",
    connectors: 2,
    cables: 1,
    lengths: [410, 410, 410],
    gauges: ["20AWG", "20AWG", "20AWG"],
    colors: ["white", "red", "black"],
    toPins: ["1", "2", "3"],
    signals: ["PWM", "+", "GND"]
  },
  {
    name: "middle_encoder",
    title: "Middle Encoder Cable (x2)",
    connectors: 4,
    cables: 2,
    lengths: [30, 30, 440, 440, 440, 440],
    gauges: encoderGauges,
    colors: encoderColors,
    toPins: ["1", "1", "4", "3", "2", "1"],
    signals: encoderSignals
  }
] as const

describe("NASA/JPL Open Source Rover WireViz corpus", () => {
  it("pins the Apache-2.0 upstream source revision", () => {
    expect(JSON.parse(readCorpus("source.json"))).toMatchObject({
      repository: "https://github.com/nasa-jpl/open-source-rover",
      commit: "50dca639560b4b8cebf1852e6c7c2048ac770762",
      path: "electrical/wiring/wireviz",
      license: "Apache-2.0"
    })
  })

  it.each(cases)("imports $name without losing manufacturing semantics", (expected) => {
    const imported = importWireViz(readCorpus(`${expected.name}.yml`), {
      harnessId: `jpl-${expected.name}`,
      prependYaml
    })
    const compiled = compileDesign(imported.design)

    expect(imported.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([])
    expect(
      imported.diagnostics.every(
        (diagnostic) =>
          diagnostic.message.includes('"image"') ||
          diagnostic.message.includes('"show_pincount"')
      )
    ).toBe(true)
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.hir.harness.metadata.sourceTitle).toBe(expected.title)
    expect(compiled.hir.connectors).toHaveLength(expected.connectors)
    expect(compiled.hir.cables).toHaveLength(expected.cables)
    expect(compiled.hir.wires).toHaveLength(expected.lengths.length)
    expect(compiled.hir.wires.map((wire) => wire.length)).toEqual(expected.lengths)
    expect(compiled.hir.wires.map((wire) => wire.gauge)).toEqual(expected.gauges)
    expect(compiled.hir.wires.map((wire) => wire.color)).toEqual(expected.colors)
    expect(
      compiled.hir.wires.map((wire) => ("pin" in wire.to ? wire.to.pin : undefined))
    ).toEqual(expected.toPins)
    expect(compiled.hir.wires.map((wire) => wire.signal)).toEqual(expected.signals)
  })
})
