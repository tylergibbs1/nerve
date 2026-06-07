/**
 * Mutation-audit killers: each test here exists because a Stryker mutant
 * SURVIVED the suite (2026-06-07 audit, score 85.84%). Mostly negative
 * assertions — the suite proved what fires, but not what must NOT match,
 * so anchor-dropping regex mutants lived.
 */
import { describe, expect, it } from "vitest"
import {
  differentialPartner,
  isPowerSignal,
  parseAwg,
  ruleCodeFromNumber,
  ruleCodeNumber
} from "@grayhaven/nerve-rules"

describe("differentialPartner anchors (regex mutants)", () => {
  it("does not pair signals with trailing garbage (kills $-drop mutants)", () => {
    expect(differentialPartner("CAN_H_SHIELD")).toBeUndefined()
    expect(differentialPartner("RS485_A_TAP")).toBeUndefined()
    expect(differentialPartner("USB_DP_OLD")).toBeUndefined()
    expect(differentialPartner("SIG_P_X")).toBeUndefined()
  })

  it("pairs the no-underscore spellings (kills _?-tightening mutants)", () => {
    expect(differentialPartner("CANH")).toBe("CANL")
    expect(differentialPartner("CANL")).toBe("CANH")
    expect(differentialPartner("RS485A")).toBe("RS485B")
    expect(differentialPartner("USBDP")).toBe("USBDM")
    expect(differentialPartner("USBDM")).toBe("USBDP")
  })

  it("bus index must be digits (kills \\d->\\D mutant)", () => {
    expect(differentialPartner("CANX_L")).toBeUndefined()
    expect(differentialPartner("CAN12_H")).toBe("CAN12_L")
  })
})

describe("signal classification edges", () => {
  it("decimal voltage rails are power (kills \\d+->\\d in POWER_SIGNAL)", () => {
    expect(isPowerSignal("3.3V")).toBe(true)
    expect(isPowerSignal("3.25V_RAIL")).toBe(true)
    expect(isPowerSignal("+1.85V")).toBe(true)
  })
})

describe("parseAwg edges", () => {
  it("rejects zero and keeps whitespace tolerance", () => {
    expect(parseAwg("0AWG")).toBeUndefined()
    expect(parseAwg("  18 AWG  ")).toBe(18)
  })
})

describe("rule-code numeric boundaries", () => {
  it("suffix 999 stays in band; 1000 is impossible by grammar", () => {
    expect(ruleCodeNumber("HK-DOC-999")).toBe(1999)
    expect(ruleCodeFromNumber(1999)).toBe("HK-DOC-999")
    expect(ruleCodeNumber("HK-DOC-1000")).toBeUndefined()
  })
})
