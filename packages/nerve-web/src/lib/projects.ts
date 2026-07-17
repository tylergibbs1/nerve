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
  description: "Opened from a share link. The source lives in the link itself, nowhere else"
}

/** The in-browser scratch pad (the "New harness" action). Baseline is a
 * starter template; edits persist to localStorage, Share is the save. */
export const SCRATCH_PROJECT: ProjectMeta = {
  id: "scratch",
  name: "New Harness",
  description: "A blank harness in your browser. Share to keep it; the link is your save"
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
    description: "A controller wired to a motor: power and CAN over two connectors"
  },
  {
    id: "sensor-splice",
    name: "Sensor Splice Harness",
    description: "Spliced power feed to two sensors, CAN in a shielded cable"
  },
  {
    id: "robot-platform",
    name: "Robot Platform Harness",
    description: "A mobile platform: 22 connectors, a CAN trunk with splice taps, 4 drive modules"
  }
]
