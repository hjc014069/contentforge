"use client";

/**
 * AnimatedCharacter
 * mode:
 *   - "sit"     : 자기 자리로 걸어가 sit_stand frame 3 (앉은 자세) 고정
 *   - "wander"  : bounds 안 무작위 목표로 자유 이동 (lane 기반)
 *   - "working" : 자기 자리로 걸어가 sit_stand frame 3 (정적, 일하는 자세)
 *
 * 시각효과:
 *   - working 모드 + 자리 도착 후 → 머리 위 말풍선 (작업 중 표시)
 *   - working → sit/wander 전환 시 2초간 ✓ 완료 이펙트
 */

import { useEffect, useRef, useState } from "react";
import type { AgentRole } from "@/types";
import {
  CHARACTER_ASPECT_RATIO,
  CHARACTER_DISPLAY_WIDTH,
  isInHorizontalLane,
  isInVerticalLane,
  isInsideAnyBox,
  type Box,
} from "@/lib/officeLayout";
import {
  PixelCharacter,
  type CharacterAction,
  type LabelPlacement,
} from "./PixelCharacter";

export type AnimatedCharacterMode = "sit" | "wander" | "working";

export type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type AnimState = {
  x: number;
  y: number;
  action: CharacterAction;
  facingLeft: boolean;
};

type Props = {
  role: AgentRole;
  mode: AnimatedCharacterMode;
  homeX: number;
  homeY: number;
  homeFacingLeft: boolean;
  bounds: Bounds;
  forbiddenBoxes?: Box[];
  useDynamicZ?: boolean;
  zBase?: number;
  width?: number;
  label?: string;
  labelPlacement?: LabelPlacement;
  zIndex?: number;
  onArriveHome?: () => void;
};

const WALK_FRAMES = 4;
const WALK_FRAME_MS = 180;
const SPEED_PX_PER_SEC = 65;
const ARRIVAL_RADIUS = 10;
const DWELL_MIN_MS = 800;
const DWELL_RANGE_MS = 1800;
const PICK_MAX_ATTEMPTS = 20;
const LANE_AXIS_THRESHOLD = 0.3;
const DONE_EFFECT_DURATION_MS = 2000;

// 역할별 작업 중 이모지 (말풍선 안)
const ROLE_EMOJI: Record<AgentRole, string> = {
  planner: "🤔",
  social: "✍️",
  visual: "🖼️",
  seo: "🏷️",
  writer: "📝",
  scripter: "🎬",
  imagegen: "🎨",
};

function pickRandom(b: Bounds) {
  return {
    x: b.minX + Math.random() * (b.maxX - b.minX),
    y: b.minY + Math.random() * (b.maxY - b.minY),
  };
}

function pickRandomAvoiding(b: Bounds, forbidden: Box[] | undefined) {
  if (!forbidden || forbidden.length === 0) return pickRandom(b);
  for (let i = 0; i < PICK_MAX_ATTEMPTS; i++) {
    const p = pickRandom(b);
    if (!isInsideAnyBox(p.x, p.y, forbidden)) return p;
  }
  return pickRandom(b);
}

// 작업 중 말풍선
function SpeechBubble({
  x,
  y,
  emoji,
  zIndex,
}: {
  x: number;
  y: number;
  emoji: string;
  zIndex: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x - 28,
        top: y - 34,
        width: 56,
        height: 38,
        background: "#fff",
        border: "3px solid #1f2937",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        zIndex,
        pointerEvents: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      }}
      aria-hidden="true"
    >
      <span style={{ lineHeight: 1 }}>{emoji}</span>
      {/* 말풍선 꼬리 (아래쪽 작은 삼각형) */}
      <div
        style={{
          position: "absolute",
          bottom: -8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "8px solid #1f2937",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -5,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderTop: "6px solid #fff",
        }}
      />
    </div>
  );
}

// 작업 완료 이펙트 (✓ 표시 2초)
function DoneEffect({
  x,
  y,
  zIndex,
}: {
  x: number;
  y: number;
  zIndex: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x - 24,
        top: y - 60,
        width: 48,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 40,
        fontWeight: 900,
        color: "#22c55e",
        zIndex,
        pointerEvents: "none",
        textShadow:
          "0 0 8px rgba(34,197,94,0.9), 0 0 16px rgba(34,197,94,0.6)",
        animation: "contentforge-done-pop 2s ease-out forwards",
      }}
      aria-hidden="true"
    >
      ✓
      <style>{`
        @keyframes contentforge-done-pop {
          0%   { transform: scale(0.3); opacity: 0; }
          20%  { transform: scale(1.3); opacity: 1; }
          40%  { transform: scale(1.0); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function AnimatedCharacter({
  role,
  mode,
  homeX,
  homeY,
  homeFacingLeft,
  bounds,
  forbiddenBoxes,
  useDynamicZ = false,
  zBase = 0,
  width,
  label,
  labelPlacement,
  zIndex,
  onArriveHome,
}: Props) {
  const [state, setState] = useState<AnimState>({
    x: homeX,
    y: homeY,
    action: "sit_stand",
    facingLeft: homeFacingLeft,
  });
  const [frame, setFrame] = useState(3);

  // 완료 이펙트 표시 여부 (working → 다른 모드 전환 시 잠깐 표시)
  const [showDoneEffect, setShowDoneEffect] = useState(false);
  const prevModeRef = useRef(mode);

  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = mode;
    if (prev === "working" && mode !== "working") {
      setShowDoneEffect(true);
      const t = setTimeout(
        () => setShowDoneEffect(false),
        DONE_EFFECT_DURATION_MS
      );
      return () => clearTimeout(t);
    }
  }, [mode]);

  useEffect(() => {
    const charWidth = width ?? CHARACTER_DISPLAY_WIDTH;
    const charHeight = charWidth / CHARACTER_ASPECT_RATIO;
    const halfH = charHeight / 2;

    const isHoming = mode === "working" || mode === "sit";
    const effectiveForbidden = isHoming ? undefined : forbiddenBoxes;

    let raf = 0;
    let lastTime = 0;
    let lastFrameTime = 0;
    let target = isHoming
      ? { x: homeX, y: homeY }
      : pickRandomAvoiding(bounds, effectiveForbidden);
    let dwellUntil = 0;
    let arrivedHome = false;
    const startDelay = isHoming ? 0 : Math.random() * 800;
    let startedAt = 0;

    const tick = (t: number) => {
      if (isHoming && arrivedHome) return;

      if (!startedAt) startedAt = t;
      if (t - startedAt < startDelay) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!lastTime) {
        lastTime = t;
        lastFrameTime = t;
      }
      const dt = Math.min((t - lastTime) / 1000, 0.05);
      lastTime = t;

      setState((s) => {
        if (!isHoming && t < dwellUntil) {
          return s.action === "sit_stand" ? s : { ...s, action: "sit_stand" };
        }

        const dx = target.x - s.x;
        const dy = target.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ARRIVAL_RADIUS) {
          if (isHoming) {
            arrivedHome = true;
            if (onArriveHome) setTimeout(onArriveHome, 0);
            return {
              x: homeX,
              y: homeY,
              action: "sit_stand",
              facingLeft: homeFacingLeft,
            };
          }
          dwellUntil = t + DWELL_MIN_MS + Math.random() * DWELL_RANGE_MS;
          target = pickRandomAvoiding(bounds, effectiveForbidden);
          return s.action === "sit_stand" ? s : { ...s, action: "sit_stand" };
        }

        const moveDist = SPEED_PX_PER_SEC * dt;

        let stepX = 0;
        let stepY = 0;

        if (isHoming) {
          stepX = (dx / dist) * moveDist;
          stepY = (dy / dist) * moveDist;
        } else {
          const footY = s.y + halfH;
          const inH = isInHorizontalLane(footY);
          const inV = isInVerticalLane(s.x);

          if (inH && !inV) {
            const dxRatio = Math.abs(dx) / dist;
            if (dxRatio > LANE_AXIS_THRESHOLD) {
              stepX = (dx / dist) * moveDist;
              stepY = 0;
            } else {
              stepX = (dx / dist) * moveDist;
              stepY = (dy / dist) * moveDist;
            }
          } else if (inV && !inH) {
            const dyRatio = Math.abs(dy) / dist;
            if (dyRatio > LANE_AXIS_THRESHOLD) {
              stepX = 0;
              stepY = (dy / dist) * moveDist;
            } else {
              stepX = (dx / dist) * moveDist;
              stepY = (dy / dist) * moveDist;
            }
          } else {
            stepX = (dx / dist) * moveDist;
            stepY = (dy / dist) * moveDist;
          }
        }

        const nextX = s.x + stepX;
        const nextY = s.y + stepY;

        const hasForbidden = !!(
          effectiveForbidden && effectiveForbidden.length > 0
        );
        const currentlyInForbidden =
          hasForbidden && isInsideAnyBox(s.x, s.y, effectiveForbidden!);
        if (
          hasForbidden &&
          !currentlyInForbidden &&
          isInsideAnyBox(nextX, nextY, effectiveForbidden!)
        ) {
          dwellUntil = t + DWELL_MIN_MS + Math.random() * DWELL_RANGE_MS;
          target = pickRandomAvoiding(bounds, effectiveForbidden);
          return s.action === "sit_stand" ? s : { ...s, action: "sit_stand" };
        }

        const absSx = Math.abs(stepX);
        const absSy = Math.abs(stepY);
        let action: CharacterAction;
        let facingLeft = s.facingLeft;
        if (absSx > absSy * 0.7) {
          action = "walk_side";
          facingLeft = stepX < 0;
        } else if (stepY < 0) {
          action = "walk_back";
        } else {
          action = "walk_front";
        }

        return { x: nextX, y: nextY, action, facingLeft };
      });

      if (t - lastFrameTime > WALK_FRAME_MS) {
        setFrame((f) => (f + 1) % WALK_FRAMES);
        lastFrameTime = t;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, bounds, forbiddenBoxes, width, homeX, homeY, homeFacingLeft, onArriveHome]);

  let renderFrame: number;
  if (state.action === "sit_stand") {
    if (mode === "sit" || mode === "working") renderFrame = 3;
    else renderFrame = 0;
  } else {
    renderFrame = frame;
  }

  const charWidth = width ?? CHARACTER_DISPLAY_WIDTH;
  const charHeight = charWidth / CHARACTER_ASPECT_RATIO;
  const footY = state.y + charHeight / 2;
  const resolvedZIndex = useDynamicZ ? Math.round(zBase + footY) : zIndex;
  // 말풍선/이펙트 z-index: 캐릭터보다 위
  const effectZIndex = (resolvedZIndex ?? 100) + 5;

  // 말풍선 표시 조건: working 모드 + 자기 자리에 앉아 있음
  const showBubble = mode === "working" && state.action === "sit_stand";
  // 캐릭터 머리 위 좌표 (말풍선/이펙트 위치 기준)
  const headX = state.x;
  const headY = state.y - charHeight / 2;

  return (
    <>
      <PixelCharacter
        role={role}
        action={state.action}
        frame={renderFrame}
        x={state.x}
        y={state.y}
        facingLeft={state.facingLeft}
        width={width}
        label={label}
        labelPlacement={labelPlacement}
        zIndex={resolvedZIndex}
      />
      {showBubble && (
        <SpeechBubble
          x={headX}
          y={headY}
          emoji={ROLE_EMOJI[role]}
          zIndex={effectZIndex}
        />
      )}
      {showDoneEffect && (
        <DoneEffect x={headX} y={headY} zIndex={effectZIndex + 1} />
      )}
    </>
  );
}
