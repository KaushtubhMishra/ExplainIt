"use client";

import { useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ExplainerVideo } from "../../../../packages/video/src/ExplainerVideo";
import type { ScenePlanType } from "@shared/schema";
import { estimatedTimeline } from "@/lib/preview-timeline";

// The selected scene, played with the same templates the final video uses (no sound yet).
export function PreviewPlayer({ plan, selected }: { plan: ScenePlanType; selected: number }) {
  const ref = useRef<PlayerRef>(null);
  const timeline = useMemo(() => estimatedTimeline(plan), [plan]);
  const scene = timeline.scenes[Math.min(selected, timeline.scenes.length - 1)];
  const inFrame = scene.startFrame;
  const outFrame = scene.startFrame + scene.durationFrames - 1;

  // Jump to a newly selected scene and play it. (Only on selection: edits that move the
  // scene's start frame shouldn't restart playback.)
  const inFrameRef = useRef(inFrame);
  inFrameRef.current = inFrame;
  useEffect(() => {
    ref.current?.seekTo(inFrameRef.current);
    ref.current?.play();
  }, [selected]);

  return (
    <div className="mx-auto w-full max-w-[220px] lg:max-w-[300px]">
      <div className="overflow-hidden rounded-[28px] bg-navy-deep shadow-xl ring-4 ring-navy-deep">
        <Player
          ref={ref}
          component={ExplainerVideo}
          inputProps={{ plan, timeline }}
          durationInFrames={timeline.totalFrames}
          compositionWidth={timeline.width}
          compositionHeight={timeline.height}
          fps={timeline.fps}
          inFrame={inFrame}
          outFrame={outFrame}
          style={{ width: "100%", aspectRatio: "9 / 16" }}
          controls
          loop
          autoPlay
          acknowledgeRemotionLicense
        />
      </div>
      <p className="mt-2 text-center text-xs text-ink-soft">Preview of scene {selected + 1} · no sound yet</p>
    </div>
  );
}
