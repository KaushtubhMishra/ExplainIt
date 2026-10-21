import React from "react";
import { Composition } from "remotion";
import { ExplainerVideo, type ExplainerProps } from "./ExplainerVideo";
import previewProps from "./preview-props.json";

// Studio shows the most recently rendered run (render-video writes preview-props.json).
const defaults = previewProps as unknown as ExplainerProps;

export const Root: React.FC = () => (
  <Composition
    id="Explainer"
    component={ExplainerVideo}
    fps={defaults.timeline.fps}
    width={defaults.timeline.width}
    height={defaults.timeline.height}
    durationInFrames={defaults.timeline.totalFrames}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({ durationInFrames: props.timeline.totalFrames })}
  />
);
