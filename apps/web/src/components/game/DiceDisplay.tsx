"use client";

import type { CSSProperties } from "react";

// 3x3グリッド（0〜8、左上から右下）のどのセルにドットを置くか
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

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

function cubeFaces(half: number): Array<{ value: number; transform: string }> {
  return [
    { value: 1, transform: `translateZ(${half}px)` },
    { value: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { value: 3, transform: `rotateY(90deg) translateZ(${half}px)` },
    { value: 4, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { value: 5, transform: `rotateX(90deg) translateZ(${half}px)` },
    { value: 2, transform: `rotateX(-90deg) translateZ(${half}px)` },
  ];
}

// ---------- FlatDice: プレイヤー行のコンパクトな出目表示（お椀なし） ----------

interface FlatDiceProps {
  dice: [number, number, number] | null;
  /** 演出中（お椀で回転中）は自分の行では出目を隠す */
  hidden?: boolean;
}

export function FlatDice({ dice, hidden = false }: FlatDiceProps) {
  const values: Array<number | null> = hidden ? [null, null, null] : dice ?? [null, null, null];

  return (
    <div className="flex gap-1.5">
      {values.map((value, index) => (
        <div
          className="grid size-8 place-items-center rounded-sm border border-stone-400 bg-[#fffaf0] p-1"
          key={index}
        >
          {value === null ? (
            <span className="text-sm font-bold text-stone-300">?</span>
          ) : (
            <div className="grid size-full grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, cell) => (
                <span className="grid place-items-center" key={cell}>
                  {(PIP_LAYOUT[value] ?? []).includes(cell) && (
                    <span
                      className={[
                        "size-1 rounded-full",
                        value === 1 ? "bg-red-600" : "bg-stone-900",
                      ].join(" ")}
                    />
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- SharedBowl: 卓の中央に1つだけ置く大きなお椀 ----------

interface SharedBowlProps {
  dice: [number, number, number] | null;
  playerName: string | null;
  animating: boolean;
  animationKey: string;
  canRoll: boolean;
  remaining: number;
  onRoll: () => void;
}

const BOWL_DIE_SIZE = 52;

export function SharedBowl({
  dice,
  playerName,
  animating,
  animationKey,
  canRoll,
  remaining,
  onRoll,
}: SharedBowlProps) {
  const values: Array<number | null> = dice ?? [null, null, null];
  const label = playerName
    ? animating
      ? `${playerName} が振っています…`
      : `${playerName} の出目`
    : "まだ誰も振っていません";

  return (
    <div className="mb-5 flex flex-col items-center gap-3">
      <button
        aria-label={
          canRoll ? `お椀をタップして振る（あと${remaining}回）` : label
        }
        className={[
          "relative size-56 shrink-0 rounded-full sm:size-72",
          canRoll ? "cursor-pointer" : "cursor-default",
        ].join(" ")}
        data-testid="shared-bowl"
        disabled={!canRoll}
        onClick={canRoll ? onRoll : undefined}
        type="button"
      >
        {/* お椀 外側（漆塗り） */}
        <div
          className={[
            "absolute inset-0 rounded-full bg-gradient-to-b from-stone-900 via-red-950 to-red-900 shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition",
            canRoll ? "hover:brightness-110" : "",
          ].join(" ")}
        />
        {/* お椀 内側（木地） */}
        <div
          className="absolute inset-[10px] rounded-full shadow-[inset_0_10px_26px_rgba(0,0,0,0.4),inset_0_-3px_8px_rgba(255,255,255,0.25)]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 35%, #f7ecd2 0%, #ecd9ab 55%, #c9a86a 100%)",
          }}
        />
        {/* サイコロ層（keyの変更でアニメーションを確実に再発火させる） */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-4"
          key={animationKey}
        >
          {values.map((value, index) =>
            value === null ? (
              <UnrolledDie key={index} size={BOWL_DIE_SIZE} />
            ) : (
              <Die3D
                animating={animating}
                index={index}
                key={index}
                size={BOWL_DIE_SIZE}
                value={value}
              />
            ),
          )}
        </div>
        {canRoll && (
          <span className="absolute inset-x-0 bottom-5 flex justify-center">
            <span className="animate-pulse rounded-full bg-stone-950/80 px-3 py-1 text-center text-sm font-bold text-white shadow-sm">
              タップして振る！（あと{remaining}回）
            </span>
          </span>
        )}
      </button>
      <p className="text-sm text-stone-600">{label}</p>
    </div>
  );
}

function UnrolledDie({ size }: { size: number }) {
  return (
    <div
      className="grid place-items-center rounded-sm border border-stone-400/60 bg-[#fffaf0]/70 font-bold text-stone-300 shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      ?
    </div>
  );
}

function Die3D({
  value,
  index,
  animating,
  size,
}: {
  value: number;
  index: number;
  animating: boolean;
  size: number;
}) {
  const { rx, ry } = FACE_ROTATION[value] ?? FACE_ROTATION[1];
  const rest = RESTING[index] ?? RESTING[0];
  const delay = `${DELAYS_MS[index] ?? 0}ms`;

  return (
    // slot: 静止位置の微調整と傾き。perspectiveはここで与える
    <div
      style={{
        transform: `translateY(${rest.y}px) rotate(${rest.tilt}deg)`,
        perspective: size * 14,
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
            "--amp": 1.4,
          } as CSSProperties
        }
      >
        {/* cube: 乱回転→最終姿勢の自転アニメーション */}
        <div
          className={animating ? "bowl-cube-spin" : undefined}
          style={
            {
              width: size,
              height: size,
              transformStyle: "preserve-3d",
              transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
              animationDelay: delay,
              "--final-rx": `${rx}deg`,
              "--final-ry": `${ry}deg`,
              "--spin-dir": SPIN_DIRS[index] ?? 1,
            } as CSSProperties
          }
        >
          {cubeFaces(size / 2).map((face) => (
            <DieFace
              key={face.value}
              size={size}
              transform={face.transform}
              value={face.value}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DieFace({
  value,
  transform,
  size,
}: {
  value: number;
  transform: string;
  size: number;
}) {
  const pips = PIP_LAYOUT[value] ?? [];
  const pipSize = Math.max(4, Math.round(size / 8));

  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 rounded-sm border border-stone-400 bg-[#fffaf0]"
      style={{ transform, backfaceVisibility: "hidden", padding: size / 8 }}
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <span className="grid place-items-center" key={cell}>
          {pips.includes(cell) && (
            <span
              className={[
                "rounded-full",
                value === 1 ? "bg-red-600" : "bg-stone-900",
              ].join(" ")}
              style={{ width: pipSize, height: pipSize }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
