import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  /** Remounting key: an error state resets when this changes. */
  readonly resetKey: string
  readonly children: ReactNode
}

interface State {
  readonly error: Error | undefined
}

/** Keeps a crash in one render view from taking down the editor beside it. */
export class RenderErrorBoundary extends Component<Props, State> {
  override state: State = { error: undefined }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error !== undefined) {
      this.setState({ error: undefined })
    }
  }

  override render() {
    if (this.state.error === undefined) return this.props.children
    return (
      <div className="status error">
        <span className="status-title">This view didn&rsquo;t render</span>
        <p className="status-detail">
          The harness itself is fine — the editor beside this pane still has your work. Try the
          view again, or switch tabs and come back.
        </p>
        <span className="status-cause">{this.state.error.message}</span>
        <span className="status-actions">
          <Button variant="secondary" size="xs" onClick={() => this.setState({ error: undefined })}>
            Try again
          </Button>
        </span>
      </div>
    )
  }
}
