import { connector, harness, wire, type ConnectorPart } from "@grayhaven/nerve"

const limitedPart: ConnectorPart = {
  mpn: "SYNTHETIC-GAUGE-LIMITED-2",
  pinCount: 2,
  wireGaugeRange: { min: "24AWG", max: "20AWG" }
}
const j1 = connector("J1", limitedPart, { pins: { 1: "PWR_12V", 2: "GND" } })
const j2 = connector("J2", limitedPart, { pins: { 1: "PWR_12V", 2: "GND" } })

export default harness("datasheet-wire-gauge-range", {
  revision: "A",
  units: "mm",
  connectors: [j1, j2],
  wires: [
    wire("W1", j1.pin(1), j2.pin(1), {
      signal: "PWR_12V",
      gauge: "18AWG",
      color: "red",
      length: 100
    }),
    wire("W2", j1.pin(2), j2.pin(2), {
      signal: "GND",
      gauge: "20AWG",
      color: "black",
      length: 100
    })
  ]
})
