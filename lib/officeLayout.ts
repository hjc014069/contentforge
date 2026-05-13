/**
 * 픽셀 오피스 좌표 정의
 * - 배경 이미지: 1672 x 941
 * - 모든 좌표는 캐릭터/가구의 "중심 좌표"
 */

import type { AgentRole } from "@/types";

export const OFFICE_WIDTH = 1672;
export const OFFICE_HEIGHT = 941;

export const CHARACTER_DISPLAY_WIDTH = 120;
export const CHARACTER_ASPECT_RATIO = 270 / 720;
export const CHARACTER_DISPLAY_HEIGHT =
  CHARACTER_DISPLAY_WIDTH / CHARACTER_ASPECT_RATIO; // 약 320

export type SeatDirection = "front" | "side";

export type Seat = {
  x: number;
  y: number;
  facingLeft: boolean;
  direction: SeatDirection;
};

const PLANNER_SEAT_X = 836;
const PLANNER_SEAT_Y = 260;

const LEFT_COL_X = 720;
const RIGHT_COL_X = 952;
const ROW_Y = [405, 550, 695];

export const SEATS: Record<AgentRole, Seat> = {
  planner: {
    x: PLANNER_SEAT_X,
    y: PLANNER_SEAT_Y,
    facingLeft: false,
    direction: "front",
  },
  social: { x: LEFT_COL_X, y: ROW_Y[0], facingLeft: false, direction: "side" },
  visual: { x: LEFT_COL_X, y: ROW_Y[1], facingLeft: false, direction: "side" },
  seo: { x: LEFT_COL_X, y: ROW_Y[2], facingLeft: false, direction: "side" },
  writer: { x: RIGHT_COL_X, y: ROW_Y[0], facingLeft: true, direction: "side" },
  scripter: { x: RIGHT_COL_X, y: ROW_Y[1], facingLeft: true, direction: "side" },
  imagegen: { x: RIGHT_COL_X, y: ROW_Y[2], facingLeft: true, direction: "side" },
};

export const PLANNER_DESK = {
  x: PLANNER_SEAT_X,
  y: PLANNER_SEAT_Y + 75,
  width: 380,
};

export const PLANNER_CHAIR = {
  x: PLANNER_SEAT_X,
  y: PLANNER_SEAT_Y - 25,
  // PNG 캔버스 중 의자가 폭의 19% 만 차지. width=500 → 실제 의자 폭 95, 높이 140
  width: 500,
};

export const MEETING_DESKS = (
  [
    { x: LEFT_COL_X, y: ROW_Y[0], facingLeft: false },
    { x: LEFT_COL_X, y: ROW_Y[1], facingLeft: false },
    { x: LEFT_COL_X, y: ROW_Y[2], facingLeft: false },
    { x: RIGHT_COL_X, y: ROW_Y[0], facingLeft: true },
    { x: RIGHT_COL_X, y: ROW_Y[1], facingLeft: true },
    { x: RIGHT_COL_X, y: ROW_Y[2], facingLeft: true },
  ] as const
).map((p) => ({
  ...p,
  desk: { offsetX: 50, offsetY: 35, width: 400 },
  chair: { offsetX: -10, offsetY: 27, width: 280 },
}));

export const FREE_ZONES = {
  top: { x1: 100, y1: 40, x2: 1572, y2: 150 },
  bottom: { x1: 100, y1: 820, x2: 1572, y2: 880 },
  leftEdge: { x1: 100, y1: 400, x2: 350, y2: 800 },
  rightEdge: { x1: 1322, y1: 400, x2: 1572, y2: 800 },
};

export const ALL_AGENT_ROLES: AgentRole[] = [
  "planner",
  "social",
  "visual",
  "seo",
  "writer",
  "scripter",
  "imagegen",
];

export const AGENT_LABELS: Record<AgentRole, string> = {
  planner: "Planner",
  social: "Social",
  visual: "Visual",
  seo: "SEO",
  writer: "Writer",
  scripter: "Scripter",
  imagegen: "ImageGen",
};

// ===== Wander Zone =====

export type WanderZone = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export const WHOLE_ZONE: WanderZone = {
  minX: 160,
  maxX: OFFICE_WIDTH - 160,
  minY: 200,
  maxY: OFFICE_HEIGHT - 140,
};

export const ZONE_BY_ROLE: Record<AgentRole, WanderZone | null> = {
  planner: WHOLE_ZONE,
  social: WHOLE_ZONE,
  visual: WHOLE_ZONE,
  seo: WHOLE_ZONE,
  writer: WHOLE_ZONE,
  scripter: WHOLE_ZONE,
  imagegen: WHOLE_ZONE,
};

// ===== Lane =====

export type Lane = { min: number; max: number };

export const HORIZONTAL_LANES: Lane[] = [
  { min: 525, max: 555 },
  { min: 670, max: 700 },
  { min: 815, max: 845 },
  { min: 880, max: 910 },
];

export const VERTICAL_LANES: Lane[] = [
  { min: 580, max: 620 },
  { min: 1052, max: 1092 },
];

export function isInHorizontalLane(footY: number): boolean {
  for (const l of HORIZONTAL_LANES) {
    if (footY >= l.min && footY <= l.max) return true;
  }
  return false;
}

export function isInVerticalLane(x: number): boolean {
  for (const l of VERTICAL_LANES) {
    if (x >= l.min && x <= l.max) return true;
  }
  return false;
}

// ===== Forbidden Box =====

export type Box = { x1: number; y1: number; x2: number; y2: number };

const PLANNER_DESK_RATIO = { w: 0.59, h: 0.39 };
const PLANNER_CHAIR_RATIO = { w: 0.19, h: 0.42 };
const MEETING_DESK_RATIO = { w: 0.6, h: 0.7 };
const MEETING_CHAIR_RATIO = { w: 0.6, h: 0.78 };

function drawBox(
  centerX: number,
  centerY: number,
  width: number,
  aspect = 1080 / 720
): Box {
  const drawW = width;
  const drawH = width / aspect;
  return {
    x1: centerX - drawW / 2,
    y1: centerY - drawH / 2,
    x2: centerX + drawW / 2,
    y2: centerY + drawH / 2,
  };
}

function realBox(
  centerX: number,
  centerY: number,
  width: number,
  ratio: { w: number; h: number },
  aspect = 1080 / 720
): Box {
  const drawH = width / aspect;
  const realW = width * ratio.w;
  const realH = drawH * ratio.h;
  return {
    x1: centerX - realW / 2,
    y1: centerY - realH / 2,
    x2: centerX + realW / 2,
    y2: centerY + realH / 2,
  };
}

export function meetingDeskBottomY(rowIndex: number): number {
  const m = MEETING_DESKS[rowIndex];
  return drawBox(
    m.x + (m.facingLeft ? -1 : 1) * m.desk.offsetX,
    m.y + m.desk.offsetY,
    m.desk.width
  ).y2;
}

export function meetingChairBottomY(rowIndex: number): number {
  const m = MEETING_DESKS[rowIndex];
  return drawBox(
    m.x + (m.facingLeft ? -1 : 1) * m.chair.offsetX,
    m.y + m.chair.offsetY,
    m.chair.width
  ).y2;
}

export const PLANNER_DESK_BOTTOM_Y = drawBox(
  PLANNER_DESK.x,
  PLANNER_DESK.y,
  PLANNER_DESK.width
).y2;

export const PLANNER_CHAIR_BOTTOM_Y = realBox(
  PLANNER_CHAIR.x,
  PLANNER_CHAIR.y,
  PLANNER_CHAIR.width,
  PLANNER_CHAIR_RATIO
).y2;

const CHAR_HALF_W = CHARACTER_DISPLAY_WIDTH / 2;
const PAD_X = CHAR_HALF_W * 0.5;
const PAD_Y = 20;

function lowerHalfPadBox(b: Box): Box {
  const midY = (b.y1 + b.y2) / 2;
  return {
    x1: b.x1 - PAD_X,
    y1: midY,
    x2: b.x2 + PAD_X,
    y2: b.y2 + PAD_Y,
  };
}

const MEETING_CHAIR_FORBIDDEN: Box[] = MEETING_DESKS.map((m) => {
  const cx = m.x + (m.facingLeft ? -1 : 1) * m.chair.offsetX;
  const cy = m.y + m.chair.offsetY;
  return lowerHalfPadBox(realBox(cx, cy, m.chair.width, MEETING_CHAIR_RATIO));
});

const PLANNER_DESK_FORBIDDEN: Box = lowerHalfPadBox(
  realBox(PLANNER_DESK.x, PLANNER_DESK.y, PLANNER_DESK.width, PLANNER_DESK_RATIO)
);

const PLANNER_CHAIR_FORBIDDEN: Box = lowerHalfPadBox(
  realBox(PLANNER_CHAIR.x, PLANNER_CHAIR.y, PLANNER_CHAIR.width, PLANNER_CHAIR_RATIO)
);

export const FORBIDDEN_BOXES_FOR_WANDER: Box[] = [
  ...MEETING_CHAIR_FORBIDDEN,
  PLANNER_DESK_FORBIDDEN,
  PLANNER_CHAIR_FORBIDDEN,
];

export function isInsideBox(x: number, y: number, b: Box): boolean {
  return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
}

export function isInsideAnyBox(x: number, y: number, boxes: Box[]): boolean {
  for (const b of boxes) {
    if (isInsideBox(x, y, b)) return true;
  }
  return false;
}

export const _RATIOS = {
  PLANNER_DESK_RATIO,
  PLANNER_CHAIR_RATIO,
  MEETING_DESK_RATIO,
  MEETING_CHAIR_RATIO,
};
