"use client";

/**
 * PixelCharacter - 단일 캐릭터 sprite sheet 렌더링
 *
 * 4프레임 sprite sheet 을 CSS background-image + background-size 400% 100% 로
 * 가로 슬라이드. facingLeft=true 면 transform: scaleX(-1) 좌우 반전.
 *
 * 좌표 (x, y) 는 캐릭터의 "중심" 좌표.
 *
 * 라벨 위치 (labelPlacement):
 *   above : 캐릭터 머리 위 (sprite 빈 영역). 정면 자리(planner) 기본.
 *   left  : 캐릭터 박스 좌측 *밖*. 좌측 줄 캐릭터용 — 위/아래 행 캐릭터를 가리지 않음.
 *   right : 캐릭터 박스 우측 *밖*. 우측 줄 캐릭터용.
 */

import type { CSSProperties } from "react";
import type { AgentRole } from "@/types";
import {
  CHARACTER_ASPECT_RATIO,
  CHARACTER_DISPLAY_WIDTH,
} from "@/lib/officeLayout";

export type CharacterAction =
  | "walk_front"
  | "walk_back"
  | "walk_side"
  | "sit_stand";

export type LabelPlacement = "above" | "left" | "right";

const TOTAL_FRAMES = 4;

export type PixelCharacterProps = {
  role: AgentRole;
  action: CharacterAction;
  frame: number;
  x: number;
  y: number;
  facingLeft?: boolean;
  width?: number;
  label?: string;
  labelPlacement?: LabelPlacement;
  zIndex?: number;
  className?: string;
};

export function PixelCharacter({
  role,
  action,
  frame,
  x,
  y,
  facingLeft = false,
  width = CHARACTER_DISPLAY_WIDTH,
  label,
  labelPlacement = "above",
  zIndex = 20,
  className = "",
}: PixelCharacterProps) {
  const height = width / CHARACTER_ASPECT_RATIO;
  const safeFrame =
    ((Math.floor(frame) % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  const bgPositionX = (safeFrame / (TOTAL_FRAMES - 1)) * 100;
  const src = `/office/characters/${role}/${action}.png`;

  const spriteStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundImage: `url(${src})`,
    backgroundSize: `${TOTAL_FRAMES * 100}% 100%`,
    backgroundPositionX: `${bgPositionX}%`,
    backgroundPositionY: "0%",
    backgroundRepeat: "no-repeat",
    transform: facingLeft ? "scaleX(-1)" : undefined,
    transformOrigin: "center",
  };

  const containerStyle: CSSProperties = {
    position: "absolute",
    left: x - width / 2,
    top: y - height / 2,
    width,
    height,
    zIndex,
    pointerEvents: "none",
  };

  // 라벨 스타일 (공통)
  const labelBase: CSSProperties = {
    position: "absolute",
    fontSize: 17,
    fontWeight: 700,
    color: "#fff",
    background: "rgba(0,0,0,0.78)",
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.15)",
    whiteSpace: "nowrap",
    fontFamily: "ui-monospace, monospace",
  };

  let labelStyle: CSSProperties = labelBase;
  if (labelPlacement === "above") {
    // 머리 위 (sprite 빈 영역)
    labelStyle = {
      ...labelBase,
      left: "50%",
      top: 30,
      transform: "translateX(-50%)",
    };
  } else if (labelPlacement === "left") {
    // 캐릭터 박스 좌측 바깥. 캐릭터 어깨 높이에 명패처럼.
    labelStyle = {
      ...labelBase,
      right: "100%",
      marginRight: 6,
      top: "38%",
      transform: "translateY(-50%)",
    };
  } else {
    // right : 캐릭터 박스 우측 바깥
    labelStyle = {
      ...labelBase,
      left: "100%",
      marginLeft: 6,
      top: "38%",
      transform: "translateY(-50%)",
    };
  }

  return (
    <div style={containerStyle} className={className} aria-hidden="true">
      <div style={spriteStyle} />
      {label && <div style={labelStyle}>{label}</div>}
    </div>
  );
}
