import { Component, type ReactNode } from "react"
import { Button } from "../ui/button.js"

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
        <p>This view failed to render: {this.state.error.message}</p>
        <Button variant="secondary" size="xs" onClick={() => this.setState({ error: undefined })}>
          Try again
        </Button>
      </div>
    )
  }
}
