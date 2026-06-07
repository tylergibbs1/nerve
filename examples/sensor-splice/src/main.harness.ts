// Splice + cable example: a controller feeds two sensors. Power is spliced
// at S1/S2 on the main branch; CAN runs as conductors of a shielded cable.
import { harness, connector, wire, branch, label, splice, cable } from "@grayhaven/nerve"
import { JstPH } from "@grayhaven/nerve-connectors"

// Parts come from the verified library (PRD §30/§42).
const jst3 = JstPH["PHR-3"]
const jst4 = JstPH["PHR-4"]

const controller = connector("J1", jst4, {
  pins: { 1: "V5", 2: "GND", 3: "CAN_H", 4: "CAN_L" },
})

const sensorA = connector("P1", jst3, {
  pins: { 1: "V5", 2: "GND", 3: "CAN_H" },
})

const sensorB = connector("P2", jst3, {
  pins: { 1: "V5", 2: "GND", 3: "CAN_L" },
})

const powerSplice = splice("S1", {
  type: "crimp",
  part: "GT-0.5",
  branch: "main",
  location: 120,
  notes: "Seal with adhesive-lined heat shrink.",
})

const groundSplice = splice("S2", {
  type: "crimp",
  part: "GT-0.5",
  branch: "main",
  location: 130,
  notes: "Seal with adhesive-lined heat shrink.",
})

const canCable = cable("C1", {
  type: "2x26AWG twisted shielded",
  conductors: 2,
  shield: "braid",
  jacket: "PVC",
  outerDiameter: 3.4,
})

export default harness("sensor-splice-harness", {
  revision: "A",
  units: "mm",
  connectors: [controller, sensorA, sensorB],
  splices: [powerSplice, groundSplice],
  cables: [canCable],
  wires: [
    // Power feed into the splices, then out to each sensor.
    wire("W1", controller.pin(1), powerSplice, { gauge: "24AWG", color: "red", length: 120, signal: "V5" }),
    wire("W2", powerSplice, sensorA.pin(1), { gauge: "26AWG", color: "red", length: 180, signal: "V5" }),
    wire("W3", powerSplice, sensorB.pin(1), { gauge: "26AWG", color: "red", length: 220, signal: "V5" }),
    wire("W4", controller.pin(2), groundSplice, { gauge: "24AWG", color: "black", length: 130, signal: "GND" }),
    wire("W5", groundSplice, sensorA.pin(2), { gauge: "26AWG", color: "black", length: 170, signal: "GND" }),
    wire("W6", groundSplice, sensorB.pin(2), { gauge: "26AWG", color: "black", length: 210, signal: "GND" }),
    // CAN pair as cable conductors.
    wire("W7", controller.pin(3), sensorA.pin(3), {
      gauge: "26AWG", color: "white", length: 300, signal: "CAN_H",
      twistGroup: "CAN", cable: "C1", conductor: 1,
    }),
    wire("W8", controller.pin(4), sensorB.pin(3), {
      gauge: "26AWG", color: "blue", length: 300, signal: "CAN_L",
      twistGroup: "CAN", cable: "C1", conductor: 2,
    }),
  ],
  branches: [
    branch("main", { path: [controller, sensorA, sensorB], sleeve: "braided-pet", nominalLength: 300 }),
  ],
  labels: [
    label("L1", { text: "SENSOR TRUNK", attachTo: "main", offsetFrom: controller, distance: 40 }),
  ],
});
