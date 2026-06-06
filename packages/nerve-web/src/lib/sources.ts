/**
 * Editable source per project (§9.6). Initial text is the bundled example
 * source; edits live in memory for the session. Local-project persistence
 * (File System Access) is a later milestone.
 */
import motorControllerSource from "../../../../examples/motor-controller/src/main.harness.ts?raw"
import sensorSpliceSource from "../../../../examples/sensor-splice/src/main.harness.ts?raw"
import robotPlatformSource from "../../../../examples/robot-platform/src/main.harness.ts?raw"

const initial: Readonly<Record<string, string>> = {
  "motor-controller": motorControllerSource,
  "sensor-splice": sensorSpliceSource,
  "robot-platform": robotPlatformSource
}

const edited = new Map<string, string>()

export const getSource = (projectId: string): string =>
  edited.get(projectId) ?? initial[projectId] ?? ""

export const setSource = (projectId: string, source: string): void => {
  edited.set(projectId, source)
}
