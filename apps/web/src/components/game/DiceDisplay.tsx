"use client";

import type { CSSProperties } from "react";

interface DiceDisplayProps {
  dice: [number, number, number] | null;
  /** 演出中はサイコロが投入〜回転する。falseなら確定姿勢で静止表示 */
  animating?: boolean;
  /** 振り直しごとに変わる値を渡すとCSSアニメーションが再発火する */
  animationKey?: string;
}

const DIE_SIZE = 40;
const HALF = DIE_SIZE / 2;

// 3x3グリッド（0〜8、左上から右下）のどのセルにドットを置くか
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// キューブの6面配置（対面の和が7になる実物のサイコロ配置）
const CUBE_FACES: Array<{ value: number; transform: string }> = [
  { value: 1, transform: `translateZ(${HALF}px)` },
  { value: 6, transform: `rotateY(180deg) translateZ(${HALF}px)` },
  { value: 3, transform: `rotateY(90deg) translateZ(${HALF}px)` },
  { value: 4, transform: `rotateY(-90deg) translateZ(${HALF}px)` },
  { value: 5, transform: `rotateX(90deg) translateZ(${HALF}px)` },
  { value: 2, transform: `rotateX(-90deg) translateZ(${HALF}px)` },
];

// 出目を正面（上面として見せる側）に向けるためのキューブ回転
const FACE_ROTATION: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: 90, ry: 0 },
  3: { rx: 0, ry: -90 },
  4: { rx: 0, ry: 90 },
  5: { rx: -90, ry: 0 },
  6: { rx: 0, ry: 180 },
};

// ダイスごとの演出バリエーション（軌道の振れ幅・回転方向・開始遅延・静止時の傾き）
const SWAYS = [1, -0.85, 0.65];
const SPIN_DIRS = [1, -1, 1];
const DELAYS_MS = [0, 90, 180];
const RESTING = [
  { y: 4, tilt: -6 },
  { y: -3, tilt: 4 },
  { y: 5, tilt: -2 },
];

export function DiceDisplay({
  dice,
  animating = false,
  animationKey,
}: DiceDisplayProps) {
  const values: Array<number | null> = dice ?? [null, null, null];

  return (
    <div className="relative h-28 w-52">
      {/* お椀 外側（漆塗り） */}
      <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-stone-900 via-red-950 to-red-900 shadow-[0_6px_14px_rgba(0,0,0,0.3)]" />
      {/* お椀 内側（木地） */}
      <div
        className="absolute inset-[7px] rounded-[50%] shadow-[inset_0_8px_18px_rgba(0,0,0,0.4),inset_0_-2px_6px_rgba(255,255,255,0.25)]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, #f7ecd2 0%, #ecd9ab 55%, #c9a86a 100%)",
        }}
      />
      {/* サイコロ層（keyの変更でアニメーションを確実に再発火させる） */}
      <div
        className="absolute inset-0 flex items-center justify-center gap-3"
        key={animationKey}
      >
        {values.map((value, index) =>
          value === null ? (
            <UnrolledDie key={index} />
          ) : (
            <Die3D
              animating={animating}
              index={index}
              key={index}
              value={value}
            />
          ),
        )}
      </div>
    </div>
  );
}

function UnrolledDie() {
  return (
    <div className="grid size-10 place-items-center rounded-sm border border-stone-400/60 bg-[#fffaf0]/70 text-lg font-bold text-stone-300 shadow-sm">
      ?
    </div>
  );
}

function Die3D({
  value,
  index,
  animating,
}: {
  value: number;
  index: number;
  animating: boolean;
}) {
  const { rx, ry } = FACE_ROTATION[value] ?? FACE_ROTATION[1];
  const rest = RESTING[index] ?? RESTING[0];
  const delay = `${DELAYS_MS[index] ?? 0}ms`;

  return (
    // slot: 静止位置の微調整と傾き。perspectiveはここで与える
    <div
      style={{
        transform: `translateY(${rest.y}px) rotate(${rest.tilt}deg)`,
        perspective: "560px",
      }}
    >
      {/* thrower: 投入〜周回〜静止の位置アニメーション */}
      <div
        className={animating ? "bowl-thrower" : undefined}
        style={
          {
            transformStyle: "preserve-3d",
            animationDelay: delay,
            "--sway": SWAYS[index] ?? 1,
          } as CSSProperties
        }
      >
        {/* cube: 乱回転→最終姿勢の自転アニメーション */}
        <div
          className={animating ? "bowl-cube-spin" : undefined}
          style={
            {
              width: DIE_SIZE,
              height: DIE_SIZE,
              transformStyle: "preserve-3d",
              transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
              animationDelay: delay,
              "--final-rx": `${rx}deg`,
              "--final-ry": `${ry}deg`,
              "--spin-dir": SPIN_DIRS[index] ?? 1,
            } as CSSProperties
          }
        >
          {CUBE_FACES.map((face) => (
            <DieFace
              key={face.value}
              transform={face.transform}
              value={face.value}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DieFace({ value, transform }: { value: number; transform: string }) {
  const pips = PIP_LAYOUT[value] ?? [];

  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 rounded-sm border border-stone-400 bg-[#fffaf0] p-[5px]"
      style={{ transform, backfaceVisibility: "hidden" }}
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <span className="grid place-items-center" key={cell}>
          {pips.includes(cell) && (
            <span
              className={[
                "size-1.5 rounded-full",
                value === 1 ? "bg-red-600" : "bg-stone-900",
              ].join(" ")}
            />
          )}
        </span>
      ))}
    </div>
  );
}
