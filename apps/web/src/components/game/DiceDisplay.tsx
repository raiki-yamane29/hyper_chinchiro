"use client";

interface DiceDisplayProps {
  dice: [number, number, number] | null;
  rolling?: boolean;
}

// 3x3グリッド（0〜8、左上から右下）のどのセルにドットを置くか
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DiceDisplay({ dice, rolling = false }: DiceDisplayProps) {
  const values = dice ?? [null, null, null];

  return (
    <div className="flex gap-2">
      {values.map((value, index) => (
        <Die key={index} rolling={rolling} delay={index * 70} value={value} />
      ))}
    </div>
  );
}

function Die({
  value,
  rolling,
  delay,
}: {
  value: number | null;
  rolling: boolean;
  delay: number;
}) {
  if (value === null) {
    return (
      <div className="grid size-14 place-items-center border border-stone-400 bg-[#fffaf0] text-xl font-bold text-stone-300 shadow-sm">
        ?
      </div>
    );
  }

  const pips = PIP_LAYOUT[value] ?? [];

  return (
    <div
      className={[
        "grid size-14 grid-cols-3 grid-rows-3 gap-0.5 border border-stone-400 bg-[#fffaf0] p-2 shadow-sm",
        rolling ? "animate-[dice-tumble_0.6s_ease-in-out]" : "",
      ].join(" ")}
      style={{ animationDelay: `${delay}ms` }}
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <span className="grid place-items-center" key={cell}>
          {pips.includes(cell) && (
            <span
              className={[
                "size-2 rounded-full",
                value === 1 ? "bg-red-600" : "bg-stone-900",
              ].join(" ")}
            />
          )}
        </span>
      ))}
    </div>
  );
}
