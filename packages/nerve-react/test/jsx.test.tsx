/** @jsxImportSource @grayhaven/nerve-react */
/**
 * The JSX layer is authoring sugar ONLY: the same harness written as JSX
 * and as function calls must compile to byte-identical HIR.
 */
import { describe, expect, it } from "vitest"
import { compileDesign } from "@grayhaven/nerve"
import { Branch, Connector, Harness, Label, Wire } from "@grayhaven/nerve-react"
import functionStyle from "../../../examples/motor-controller/src/main.harness.js"
import { MolexMicroFit } from "@grayhaven/nerve-connectors"

const PINS = {
  1: "VBAT_24V", 2: "GND", 3: "CAN_H", 4: "CAN_L",
  5: "ENC_A", 6: "ENC_B", 7: "MOTOR_TEMP", 8: "SHIELD_DRAIN"
} as const

const CONTROLLER_ELECTRICAL = {
  1: { role: "source", voltage: { minV: 22, maxV: 26 }, currentA: 5 },
  2: { role: "ground", voltage: { minV: 0, maxV: 0 } },
  3: {
    role: "bidirectional",
    protocol: "CAN",
    differential: { pair: "CAN", polarity: "positive" }
  },
  4: {
    role: "bidirectional",
    protocol: "CAN",
    differential: { pair: "CAN", polarity: "negative" }
  }
} as const

const MOTOR_ELECTRICAL = {
  1: { role: "sink", voltage: { minV: 18, maxV: 30 }, currentA: 4 },
  2: { role: "ground", voltage: { minV: 0, maxV: 0 } },
  3: {
    role: "bidirectional",
    protocol: "CAN",
    differential: { pair: "CAN", polarity: "positive" }
  },
  4: {
    role: "bidirectional",
    protocol: "CAN",
    differential: { pair: "CAN", polarity: "negative" }
  }
} as const

const jsxStyle = (
  <Harness id="motor-controller-harness" revision="A" units="mm">
    <Connector
      ref="J1"
      part={MolexMicroFit["43025-0800"]}
      pins={PINS}
      terminals={{ 1: "43030-0007", 2: "43030-0007", 3: "43030-0007", 4: "43030-0007" }}
      electrical={CONTROLLER_ELECTRICAL}
    />
    <Connector
      ref="M1"
      part={MolexMicroFit["43020-0800"]}
      pins={PINS}
      terminals={{ 1: "43031-0007", 2: "43031-0007", 3: "43031-0007", 4: "43031-0007" }}
      electrical={MOTOR_ELECTRICAL}
    />
    <Wire id="W1" from="J1.1" to="M1.1" gauge="20AWG" color="red" length={420} signal="VBAT_24V" />
    <Wire id="W2" from="J1.2" to="M1.2" gauge="20AWG" color="black" length={420} signal="GND" />
    <Wire id="W3" from="J1.3" to="M1.3" gauge="24AWG" color="white" twistGroup="CAN_PAIR" signal="CAN_H" />
    <Wire id="W4" from="J1.4" to="M1.4" gauge="24AWG" color="blue" twistGroup="CAN_PAIR" signal="CAN_L" />
    <Branch id="main" path={["J1", "M1"]} sleeve="braided-pet" nominalLength={420} />
    <Label id="L1" text="MOTOR CTRL A" attachTo="main" offsetFrom="J1" distance={50} />
  </Harness>
)

describe("@grayhaven/nerve-react (experimental JSX authoring)", () => {
  it("compiles JSX to byte-identical HIR vs the function DSL", () => {
    const a = JSON.stringify(compileDesign(jsxStyle).hir, null, 2)
    const b = JSON.stringify(compileDesign(functionStyle).hir, null, 2)
    expect(a).toBe(b)
  })

  it("string endpoints parse pins and splices", () => {
    const w = <Wire id="W9" from="J1.12" to="S1" gauge="24AWG" />
    expect(w).toMatchObject({
      from: { kind: "pin-ref", connector: "J1", pin: "12" },
      to: { kind: "splice-ref", splice: "S1" }
    })
  })

  it("nested arrays and conditionals flatten like JSX children should", () => {
    const drops = ["A", "B"].map((s, i) => (
      <Wire id={`W${i}`} from={`J1.${i + 1}`} to={`M1.${i + 1}`} signal={s} gauge="24AWG" />
    ))
    const h = (
      <Harness id="t" revision="A" units="mm">
        <Connector ref="J1" part={MolexMicroFit["43025-0800"]} pins={{ 1: "A", 2: "B" }} />
        <Connector ref="M1" part={MolexMicroFit["43020-0800"]} pins={{ 1: "A", 2: "B" }} />
        {drops}
        {false}
      </Harness>
    )
    expect(compileDesign(h).hir.wires).toHaveLength(2)
  })
})
