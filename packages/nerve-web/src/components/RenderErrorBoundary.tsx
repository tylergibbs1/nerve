import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

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
      <Empty className="app-status app-status--error">
        <EmptyHeader>
          <EmptyTitle>This view didn&rsquo;t render</EmptyTitle>
          <EmptyDescription>
            The harness itself is fine — the editor beside this pane still has your work. Try the
            view again, or switch tabs and come back.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <span className="status-cause">{this.state.error.message}</span>
          <Button variant="secondary" size="sm" onClick={() => this.setState({ error: undefined })}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
}
