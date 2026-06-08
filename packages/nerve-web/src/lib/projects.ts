/**
 * Project registry. M3 ships with the golden-fixture project bundled;
 * "open local project" (File System Access) is a later milestone.
 */
export interface ProjectMeta {
  readonly id: string
  readonly name: string
  readonly description: string
}

/** Ephemeral share-link project (not listed on the index page). */
export const SHARED_PROJECT: ProjectMeta = {
  id: "shared",
  name: "Shared Harness",
  description: "Opened from a share link — source lives in the URL fragment, nowhere else"
}

/** The in-browser scratch pad (the "New harness" action). Baseline is a
 * starter template; edits persist to localStorage, Share is the save. */
export const SCRATCH_PROJECT: ProjectMeta = {
  id: "scratch",
  name: "New Harness",
  description: "A blank in-browser harness — Share to keep it (the link is your save)"
}

export const projectMeta = (id: string): ProjectMeta | undefined =>
  id === SHARED_PROJECT.id
    ? SHARED_PROJECT
    : id === SCRATCH_PROJECT.id
      ? SCRATCH_PROJECT
      : PROJECTS.find((p) => p.id === id)

export const PROJECTS: ReadonlyArray<ProjectMeta> = [
  {
    id: "motor-controller",
    name: "Motor Controller Harness",
    description: "PRD §9.1 example — J1 controller to M1 motor, power + CAN"
  },
  {
    id: "sensor-splice",
    name: "Sensor Splice Harness",
    description: "Spliced power feed to two sensors, CAN in a shielded cable"
  },
  {
    id: "robot-platform",
    name: "Robot Platform Harness",
    description: "GH-R1 mobile platform — 22 connectors, CAN trunk with splice taps, 4 drive modules"
  }
]
