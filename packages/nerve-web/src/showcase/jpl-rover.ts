import {
  compileDesign,
  runRules,
  type Diagnostic,
  type Hir
} from "@grayhaven/nerve"
import {
  bomTable,
  cutListTable,
  generateTestPlan,
  hirFingerprint,
  schematicSvg,
  type TableData,
  type TestPlan
} from "@grayhaven/nerve-exporters"
import { builtinRules } from "@grayhaven/nerve-rules"
import { importWireViz } from "@grayhaven/nerve-wireviz"
import templates from "../../../nerve-wireviz/test/fixtures/jpl-open-source-rover/templates.yml?raw"
import backEncoder from "../../../nerve-wireviz/test/fixtures/jpl-open-source-rover/back_encoder.yml?raw"
import backServo from "../../../nerve-wireviz/test/fixtures/jpl-open-source-rover/back_servo.yml?raw"
import encoderExtension from "../../../nerve-wireviz/test/fixtures/jpl-open-source-rover/encoder_extension.yml?raw"
import frontEncoder from "../../../nerve-wireviz/test/fixtures/jpl-open-source-rover/front_encoder.yml?raw"
import frontServo from "../../../nerve-wireviz/test/fixtures/jpl-open-source-rover/front_servo.yml?raw"
import middleEncoder from "../../../nerve-wireviz/test/fixtures/jpl-open-source-rover/middle_encoder.yml?raw"

export const JPL_SOURCE = {
  repository: "https://github.com/nasa-jpl/open-source-rover",
  commit: "50dca639560b4b8cebf1852e6c7c2048ac770762",
  path: "electrical/wiring/wireviz",
  license: "Apache-2.0"
} as const

interface CorpusEntry {
  readonly slug: string
  readonly name: string
  readonly source: string
}

const corpus: ReadonlyArray<CorpusEntry> = [
  { slug: "front-encoder", name: "Front encoder", source: frontEncoder },
  { slug: "front-servo", name: "Front servo", source: frontServo },
  { slug: "middle-encoder", name: "Middle encoder", source: middleEncoder },
  { slug: "back-encoder", name: "Back encoder", source: backEncoder },
  { slug: "back-servo", name: "Back servo", source: backServo },
  { slug: "encoder-extension", name: "Encoder extension", source: encoderExtension }
]

export interface JplHarnessProof extends CorpusEntry {
  readonly title: string
  readonly hir: Hir
  readonly schematic: string
  readonly fingerprint: string
  readonly importDiagnostics: ReadonlyArray<Diagnostic>
  readonly reviewDiagnostics: ReadonlyArray<Diagnostic>
  readonly bom: TableData
  readonly cutList: TableData
  readonly testPlan: TestPlan
  readonly releaseReady: boolean
}

const buildProof = (entry: CorpusEntry): JplHarnessProof => {
  const imported = importWireViz(entry.source, {
    harnessId: `jpl-${entry.slug}`,
    revision: "A",
    prependYaml: [templates]
  })
  const compiled = compileDesign(imported.design)
  const beforeRules: Hir = {
    ...compiled.hir,
    diagnostics: [...imported.diagnostics, ...compiled.diagnostics]
  }
  const reviewDiagnostics = runRules(beforeRules, builtinRules)
  const hir: Hir = {
    ...beforeRules,
    diagnostics: [...beforeRules.diagnostics, ...reviewDiagnostics]
  }

  return {
    ...entry,
    title: imported.design.metadata?.["sourceTitle"] ?? entry.name,
    hir,
    schematic: schematicSvg(hir),
    fingerprint: hirFingerprint(hir),
    importDiagnostics: imported.diagnostics,
    reviewDiagnostics,
    bom: bomTable(hir),
    cutList: cutListTable(hir),
    testPlan: generateTestPlan(hir),
    releaseReady: !hir.diagnostics.some((diagnostic) => diagnostic.severity === "error")
  }
}

export const JPL_HARNESSES: ReadonlyArray<JplHarnessProof> = corpus.map(buildProof)

export const JPL_SHOWCASE_SUMMARY = {
  designs: JPL_HARNESSES.length,
  conductors: JPL_HARNESSES.reduce((total, proof) => total + proof.hir.wires.length, 0),
  ruleCount: builtinRules.length,
  packetFiles: 22
} as const
