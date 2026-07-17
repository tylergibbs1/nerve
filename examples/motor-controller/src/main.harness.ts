// Golden fixture: PRD §9.1 example authoring style.
// If this file needs edits to compile, the DSL is wrong — not the fixture.
// ONE sanctioned deviation from the PRD text: W1/W2 are 20AWG, not 18AWG.
// Verified Molex data (2026-06-06) shows Micro-Fit 3.0 accepts 20-30 AWG
// only — the PRD's 18AWG is a part-selection error Nerve now catches
// (HK-MFG-004), which is the product doing its job.
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
  terminals: {
    1: "43030-0007",
    2: "43030-0007",
    3: "43030-0007",
    4: "43030-0007",
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
  terminals: {
    1: "43031-0007",
    2: "43031-0007",
    3: "43031-0007",
    4: "43031-0007",
  },
});

export default harness("motor-controller-harness", {
  revision: "A",
  units: "mm",
  connectors: [controller, motor],
  wires: [
    wire("W1", controller.pin(1), motor.pin(1), {
      gauge: "20AWG",
      color: "red",
      length: 420,
      signal: "VBAT_24V",
    }),
    wire("W2", controller.pin(2), motor.pin(2), {
      gauge: "20AWG",
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
