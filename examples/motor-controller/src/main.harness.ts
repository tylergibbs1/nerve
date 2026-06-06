// Golden fixture: PRD §9.1 example authoring style, verbatim.
// If this file needs edits to compile, the DSL is wrong — not the fixture.
import { harness, connector, wire, branch, label } from "@grayhaven/nerve"
import { MolexMicroFit } from "@grayhaven/nerve-connectors"

const controller = connector("J1", MolexMicroFit["43025-0800"], {
  pins: {
    1: "VBAT_24V",
    2: "GND",
    3: "CAN_H",
    4: "CAN_L",
    5: "ENC_A",
    6: "ENC_B",
    7: "MOTOR_TEMP",
    8: "SHIELD_DRAIN",
  },
});

const motor = connector("M1", MolexMicroFit["43020-0800"], {
  pins: {
    1: "VBAT_24V",
    2: "GND",
    3: "CAN_H",
    4: "CAN_L",
    5: "ENC_A",
    6: "ENC_B",
    7: "MOTOR_TEMP",
    8: "SHIELD_DRAIN",
  },
});

export default harness("motor-controller-harness", {
  revision: "A",
  units: "mm",
  connectors: [controller, motor],
  wires: [
    wire("W1", controller.pin(1), motor.pin(1), {
      gauge: "18AWG",
      color: "red",
      length: 420,
      signal: "VBAT_24V",
    }),
    wire("W2", controller.pin(2), motor.pin(2), {
      gauge: "18AWG",
      color: "black",
      length: 420,
      signal: "GND",
    }),
    wire("W3", controller.pin(3), motor.pin(3), {
      gauge: "24AWG",
      color: "white",
      twistGroup: "CAN_PAIR",
      signal: "CAN_H",
    }),
    wire("W4", controller.pin(4), motor.pin(4), {
      gauge: "24AWG",
      color: "blue",
      twistGroup: "CAN_PAIR",
      signal: "CAN_L",
    }),
  ],
  branches: [
    branch("main", {
      path: [controller, motor],
      sleeve: "braided-pet",
      nominalLength: 420,
    }),
  ],
  labels: [
    label("L1", {
      text: "MOTOR CTRL A",
      attachTo: "main",
      offsetFrom: controller,
      distance: 50,
    }),
  ],
});
