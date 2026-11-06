import { Component, type ReactNode } from "react";
import { hu } from "../i18n/hu.ts";
import { Notice } from "./Notice.tsx";
import { Button } from "./ui/Button.tsx";

type RegionBoundaryProps = { message: string; children: ReactNode };

type RegionBoundaryState = { hasFailed: boolean };

export class RegionBoundary extends Component<RegionBoundaryProps, RegionBoundaryState> {
  override state: RegionBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): RegionBoundaryState {
    return { hasFailed: true };
  }

  override render() {
    if (!this.state.hasFailed) {
      return this.props.children;
    }
    return (
      <div className="region-failed">
        <Notice
          tone="error"
          title={this.props.message}
          live="alert"
          actions={
            <Button size="sm" icon="rewind" onPress={() => this.setState({ hasFailed: false })}>
              {hu.app.retry}
            </Button>
          }
        />
      </div>
    );
  }
}
