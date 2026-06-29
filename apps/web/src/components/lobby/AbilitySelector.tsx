"use client";

export const abilities = [
  {
    id: "trickster",
    name: "イカサマ師",
    description: "2の出目が出やすい",
  },
  {
    id: "lucky_six",
    name: "ラッキーシックス",
    description: "6の出目が出やすい",
  },
  {
    id: "all_high",
    name: "オールフォア",
    description: "4・5・6が出やすい",
  },
  {
    id: "no_one",
    name: "ピンゾロ封じ",
    description: "1の出目を抑える",
  },
  {
    id: "chaos",
    name: "カオスダイス",
    description: "毎回ウェイトが変わる",
  },
  {
    id: "mirror",
    name: "ミラーロール",
    description: "直前の出目に寄せる",
  },
  {
    id: "godhand",
    name: "神の一手",
    description: "1ラウンド1回だけ1個固定",
  },
  {
    id: "double_chance",
    name: "ダブルチャンス",
    description: "役なしの振り直しが1回増える",
  },
] as const;

interface AbilitySelectorProps {
  value: string;
  onChange: (abilityId: string) => void;
}

export function AbilitySelector({ value, onChange }: AbilitySelectorProps) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-semibold">能力</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {abilities.map((ability) => {
          const selected = value === ability.id;
          return (
            <label
              className={[
                "grid min-h-24 cursor-pointer content-start gap-1 border p-3 transition",
                selected
                  ? "border-red-800 bg-red-50"
                  : "border-stone-300 bg-white hover:border-stone-500",
              ].join(" ")}
              key={ability.id}
            >
              <input
                checked={selected}
                className="sr-only"
                name="ability"
                onChange={() => onChange(ability.id)}
                type="radio"
                value={ability.id}
              />
              <span className="font-semibold">{ability.name}</span>
              <span className="text-sm leading-6 text-stone-600">
                {ability.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
