"use client";

/**
 * OfficeRoom - 픽셀 오피스 시각화의 메인 컨테이너
 *
 * z-index : footY 기반 동적 (z = Z_BASE + footY)
 *
 * 캐릭터 모드 결정 우선순위:
 *   1. agentStates[role] 에 따라:
 *      - working → working (자기 자리로 걸어가 정적 앉음)
 *      - done    → 5초 이내면 sit, 5초 후엔 wander
 *      - skipped → wander
 *      - idle    → 파이프라인 진행 중이면 sit, 아니면 wander/sit
 *   2. 비활성 에이전트는 demoMode 따라 wander/sit
 *
 * 자동 시작: internalDemo 초기값 true.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type {
  AgentRole,
  ActiveAgentRole,
  AgentState,
} from "@/types";
import {
  OFFICE_WIDTH,
  OFFICE_HEIGHT,
  SEATS,
  PLANNER_DESK,
  PLANNER_CHAIR,
  MEETING_DESKS,
  ALL_AGENT_ROLES,
  AGENT_LABELS,
  ZONE_BY_ROLE,
  FORBIDDEN_BOXES_FOR_WANDER,
  PLANNER_DESK_BOTTOM_Y,
  PLANNER_CHAIR_BOTTOM_Y,
  meetingDeskBottomY,
  meetingChairBottomY,
} from "@/lib/officeLayout";
import {
  AnimatedCharacter,
  type AnimatedCharacterMode,
  type Bounds,
} from "./AnimatedCharacter";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const Z_BASE = 100;
const zFromFootY = (footY: number) => Math.round(Z_BASE + footY);

const WANDER_BOUNDS: Bounds = {
  minX: 220,
  maxX: OFFICE_WIDTH - 220,
  minY: 380,
  maxY: OFFICE_HEIGHT - 130,
};

const ACTIVE_AGENT_ROLES_ARR: ActiveAgentRole[] = [
  "planner",
  "social",
  "visual",
  "seo",
  "writer",
  "scripter",
];

const ACTIVE_AGENT_SET = new Set<AgentRole>(ACTIVE_AGENT_ROLES_ARR);

// done 후 wander 로 전환되기까지 걸리는 시간 (15초)
const DONE_TO_WANDER_MS = 15000;

function useScaleToFit(targetWidth: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / targetWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [targetWidth]);

  return { ref, scale };
}

function FurnitureImage({
  src,
  centerX,
  centerY,
  width,
  facingLeft = false,
  zIndex,
  alt = "",
}: {
  src: string;
  centerX: number;
  centerY: number;
  width: number;
  facingLeft?: boolean;
  zIndex: number;
  alt?: string;
}) {
  const aspect = 1080 / 720;
  const height = width / aspect;
  const style: CSSProperties = {
    position: "absolute",
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
    zIndex,
    pointerEvents: "none",
    transform: facingLeft ? "scaleX(-1)" : undefined,
    transformOrigin: "center",
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} style={style} draggable={false} />
  );
}

export type OfficeRoomProps = {
  showLabels?: boolean;
  showGrid?: boolean;
  characterWidth?: number;
  forcedDemoMode?: boolean;
  agentStates?: Partial<Record<ActiveAgentRole, AgentState>>;
  /** 이번 작업에 참여하는 활성 에이전트. 그 외는 wander 유지. */
  activeAgents?: ActiveAgentRole[];
  /** done 진입 시각 (부모가 관리, 컴포넌트 마운트와 무관하게 유지) */
  doneSinceMs?: Partial<Record<ActiveAgentRole, number>>;
};

export function OfficeRoom({
  showLabels = false,
  showGrid = false,
  characterWidth,
  forcedDemoMode,
  agentStates,
  activeAgents,
  doneSinceMs: doneSinceMsProp,
}: OfficeRoomProps = {}) {
  const { ref, scale } = useScaleToFit(OFFICE_WIDTH);
  const [internalDemo, setInternalDemo] = useState(true);
  const demoMode = forcedDemoMode ?? internalDemo;

  // 1초 tick 으로 15초 경과 체크용 re-render
  const [nowMs, setNowMs] = useState(() => Date.now());
  // doneSinceMs 는 부모에서 관리 (마운트/언마운트 사이에도 유지)
  const doneSinceMs = doneSinceMsProp ?? {};

  // 15초 카운트용 1초 tick (done 있을 때만 실행)
  const hasAnyDone = Object.keys(doneSinceMs).length > 0;
  useEffect(() => {
    if (!hasAnyDone) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasAnyDone]);

  // 파이프라인 진행 중 여부
  const pipelineActive = !!(
    agentStates &&
    Object.values(agentStates).some((s) => s === "working" || s === "done")
  );

  // 활성 에이전트 (없으면 4명 기본값)
  const activeRolesForMode = new Set<AgentRole>(
    activeAgents ?? ["planner", "social", "visual", "seo"]
  );

  function getCharacterMode(role: AgentRole): AnimatedCharacterMode {
    const isModeActive = activeRolesForMode.has(role);
    if (isModeActive && agentStates) {
      const state = agentStates[role as ActiveAgentRole];
      if (state === "working") return "working";
      if (state === "done") {
        const ts = doneSinceMs[role as ActiveAgentRole];
        if (ts && nowMs - ts >= DONE_TO_WANDER_MS) return "wander";
        return "sit";
      }
      if (state === "skipped") return demoMode ? "wander" : "sit";
      if (state === "idle") {
        return pipelineActive ? "sit" : demoMode ? "wander" : "sit";
      }
    }
    // 모드에서 비활성 (예: instagram 모드의 writer/scripter) → 데모 모드 따라 wander
    return demoMode ? "wander" : "sit";
  }

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${OFFICE_WIDTH} / ${OFFICE_HEIGHT}`,
        overflow: "hidden",
        borderRadius: 16,
        background: "#0b0f1a",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OFFICE_WIDTH,
          height: OFFICE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/office/background.png"
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: OFFICE_WIDTH,
            height: OFFICE_HEIGHT,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        <FurnitureImage
          src="/office/planner_chair.png"
          centerX={PLANNER_CHAIR.x}
          centerY={PLANNER_CHAIR.y}
          width={PLANNER_CHAIR.width}
          zIndex={zFromFootY(PLANNER_CHAIR_BOTTOM_Y)}
          alt="planner-chair"
        />

        {MEETING_DESKS.map((m, i) => {
          const sign = m.facingLeft ? -1 : 1;
          return (
            <FurnitureImage
              key={`chair-${i}`}
              src="/office/chair.png"
              centerX={m.x + sign * m.chair.offsetX}
              centerY={m.y + m.chair.offsetY}
              width={m.chair.width}
              facingLeft={m.facingLeft}
              zIndex={zFromFootY(meetingChairBottomY(i))}
              alt="chair"
            />
          );
        })}

        {ALL_AGENT_ROLES.map((role) => {
          const seat = SEATS[role];
          const placement =
            seat.direction === "front"
              ? "above"
              : seat.facingLeft
              ? "right"
              : "left";
          const zone = ZONE_BY_ROLE[role];
          const characterMode = getCharacterMode(role);
          return (
            <AnimatedCharacter
              key={role}
              role={role}
              mode={characterMode}
              homeX={seat.x}
              homeY={seat.y}
              homeFacingLeft={seat.facingLeft}
              bounds={zone ?? WANDER_BOUNDS}
              forbiddenBoxes={FORBIDDEN_BOXES_FOR_WANDER}
              useDynamicZ
              zBase={Z_BASE}
              width={characterWidth}
              label={showLabels ? AGENT_LABELS[role] : undefined}
              labelPlacement={placement}
            />
          );
        })}

        <FurnitureImage
          src="/office/planner_desk.png"
          centerX={PLANNER_DESK.x}
          centerY={PLANNER_DESK.y}
          width={PLANNER_DESK.width}
          zIndex={zFromFootY(PLANNER_DESK_BOTTOM_Y)}
          alt="planner-desk"
        />

        {MEETING_DESKS.map((m, i) => {
          const sign = m.facingLeft ? -1 : 1;
          return (
            <FurnitureImage
              key={`desk-${i}`}
              src="/office/desk.png"
              centerX={m.x + sign * m.desk.offsetX}
              centerY={m.y + m.desk.offsetY}
              width={m.desk.width}
              facingLeft={m.facingLeft}
              zIndex={zFromFootY(meetingDeskBottomY(i))}
              alt="desk"
            />
          );
        })}

        {showGrid && <DebugGrid />}
      </div>

      {forcedDemoMode === undefined && (
        <button
          type="button"
          onClick={() => setInternalDemo((d) => !d)}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 2000,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: internalDemo
              ? "rgba(168,85,247,0.85)"
              : "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "ui-monospace, monospace",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          {internalDemo ? "■ 정지" : "▶ 캐릭터 움직임"}
        </button>
      )}
    </div>
  );
}

function DebugGrid() {
  const lines: ReactElement[] = [];
  for (let x = 0; x <= OFFICE_WIDTH; x += 100) {
    lines.push(
      <div
        key={`vx-${x}`}
        style={{
          position: "absolute",
          left: x,
          top: 0,
          width: 1,
          height: OFFICE_HEIGHT,
          background: "rgba(255,0,255,0.25)",
          zIndex: 100,
          pointerEvents: "none",
        }}
      />
    );
  }
  for (let y = 0; y <= OFFICE_HEIGHT; y += 100) {
    lines.push(
      <div
        key={`hy-${y}`}
        style={{
          position: "absolute",
          left: 0,
          top: y,
          width: OFFICE_WIDTH,
          height: 1,
          background: "rgba(255,0,255,0.25)",
          zIndex: 100,
          pointerEvents: "none",
        }}
      />
    );
  }
  return <>{lines}</>;
}

export type { AgentRole };
