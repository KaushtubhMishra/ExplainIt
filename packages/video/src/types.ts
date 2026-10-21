import type { ScenePlanType, SceneType } from "../../shared/src/schema";
import type { SceneTimeline, Timeline } from "../../shared/src/timeline";
import type { ThemeColors } from "./themes";

export type { ScenePlanType, SceneType, SceneTimeline, Timeline };

export type TemplateProps<C> = {
  content: C;
  timing: SceneTimeline;
  colors: ThemeColors;
  font: string;
  hindi: boolean;
  // Step numbering that continues across consecutive step scenes ("Step 4 of 9").
  stepOffset: number;
  stepTotal: number;
};

export type Content<T extends SceneType["content"]["template"]> = Extract<SceneType["content"], { template: T }>;
