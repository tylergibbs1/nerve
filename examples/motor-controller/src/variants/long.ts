// SKU variant: same harness stretched to an 800 mm run (PRD §8.4).
import { variant, label } from "@grayhaven/nerve"
import base from "../main.harness.js"

export default variant(base, {
  id: "motor-controller-harness-long",
  revision: "A",
  wires: {
    override: {
      W1: { length: 800 },
      W2: { length: 800 },
      W3: { length: 800 },
      W4: { length: 800 },
    },
  },
  branches: {
    override: {
      main: { nominalLength: 800 },
    },
  },
  labels: {
    remove: ["L1"],
    add: [
      label("L1", {
        text: "MOTOR CTRL A LONG",
        attachTo: "main",
        offsetFrom: "J1",
        distance: 50,
      }),
    ],
  },
});
