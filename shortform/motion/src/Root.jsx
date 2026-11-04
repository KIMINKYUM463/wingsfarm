import { Composition, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { Main } from "./Main.jsx";
import sample from "./sample.json";

// 프리텐다드(OFL, 재배포 가능) — 맑은 고딕은 윈도우 전용이라 배포용 영상에 쓰지 않는다
for (const [w, n] of [["900", "Black"], ["800", "ExtraBold"], ["700", "Bold"], ["600", "SemiBold"]]) {
  loadFont({ family: "Pretendard", url: staticFile(`fonts/Pretendard-${n}.woff2`), weight: w });
}

export const Root = () => (
  <Composition
    id="Motion"
    component={Main}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={sample}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(30, props.scenes.reduce((a, s) => a + s.frames, 0)),
    })}
  />
);
