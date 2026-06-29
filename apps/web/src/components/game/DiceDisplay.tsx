"use client";

interface DiceDisplayProps {
  dice: [number, number, number] | null;
  rolling?: boolean;
}

export function DiceDisplay({ dice, rolling = false }: DiceDisplayProps) {
  const values = dice ?? ["-", "-", "-"];

  return (
    <div className="flex gap-2">
      {values.map((value, index) => (
        <span
          className={[
            "grid size-14 place-items-center border border-stone-400 bg-[#fffaf0] text-xl font-bold shadow-sm",
            rolling ? "animate-[dice-wobble_0.45s_ease-in-out]" : "",
          ].join(" ")}
          key={`${value}-${index}`}
          style={{ animationDelay: `${index * 70}ms` }}
        >
          {value}
        </span>
      ))}
    </div>
  );
}
