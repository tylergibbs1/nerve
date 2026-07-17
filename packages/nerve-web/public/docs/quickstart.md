> Grayhaven Nerve docs index: https://nerve-demo.vercel.app/llms.txt. Fetch it to discover all pages before exploring further.

# Review a harness reproducibly

Nerve turns structured harness facts into a versioned representation, stable diagnostics, and reproducible review artifacts. TypeScript is one supported input, not a requirement for a future service or API.

## Install

```bash
npm install @grayhaven/nerve @grayhaven/nerve-connectors @grayhaven/nerve-cli

npx --package=@grayhaven/nerve-cli nerve init .
npx --package=@grayhaven/nerve-cli nerve compile ./src/main.harness.ts
npx --package=@grayhaven/nerve-cli nerve review  ./src/main.harness.ts
npx --package=@grayhaven/nerve-cli nerve export  ./src/main.harness.ts
```

## First harness

```ts
import { harness, connector, wire } from "@grayhaven/nerve"
import { MolexMicroFit } from "@grayhaven/nerve-connectors"

const controller = connector("J1", MolexMicroFit["43025-0800"], {
  pins: { 1: "VBAT_24V", 2: "GND", 3: "CAN_H", 4: "CAN_L" },
})

export default harness("motor-controller-harness", {
  revision: "A",
  units: "mm",
  connectors: [controller, motor],
  wires: [
    wire("W1", controller.pin(1), motor.pin(1), {
      gauge: "20AWG", color: "red", length: 420,
    }),
  ],
})
```

`nerve review` writes a machine-readable finding report with the HIR fingerprint, built-in rule versions, findings, and limitations. `nerve export` writes the HIR, drawings, tables, test plan, instructions, and PDF packet.

The report is not a certification and does not replace qualified engineering review. A check can use only the facts present in the submitted design and configured part data.

Or skip the install entirely: [the editor in this app](/projects) compiles in your browser as you type.

## Share a harness

Use **Share** in the editor to place the project files in the URL fragment. There is no backend for this flow: the fragment stays in the browser, and opening the link recompiles the same design. A share URL can therefore carry a reproducible software example. Do not place restricted customer data in a share URL.
