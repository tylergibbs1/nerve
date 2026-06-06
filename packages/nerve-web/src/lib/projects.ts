/**
 * Project registry. M3 ships with the golden-fixture project bundled;
 * "open local project" (File System Access) is a later milestone.
 */
export interface ProjectMeta {
  readonly id: string
  readonly name: string
  readonly description: string
}

export const PROJECTS: ReadonlyArray<ProjectMeta> = [
  {
    id: "motor-controller",
    name: "Motor Controller Harness",
    description: "PRD §9.1 example — J1 controller to M1 motor, power + CAN"
  }
]
