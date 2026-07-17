import {
  connector,
  harness,
  protection,
  wire,
  type ConnectorPart
} from "@grayhaven/nerve"

const part: ConnectorPart = { mpn: "SYNTHETIC-2", pinCount: 2 }
const j1 = connector("J1", part, { pins: { 1: "PWR_12V", 2: "GND" } })
const j2 = connector("J2", part, { pins: { 1: "PWR_12V", 2: "GND" } })

export default harness("synthetic-overcurrent-protection", {
  revision: "A",
  units: "mm",
  connectors: [j1, j2],
  wires: [
    wire("W1", j1.pin(1), j2.pin(1), {
      signal: "PWR_12V",
      gauge: "24AWG",
      color: "red",
      length: 100
    }),
    wire("W2", j1.pin(2), j2.pin(2), {
      signal: "GND",
      gauge: "24AWG",
      color: "black",
      length: 100
    })
  ],
  protections: [
    protection("F1", { kind: "fuse", ratingA: 10, protects: ["W1"] })
  ]
})
