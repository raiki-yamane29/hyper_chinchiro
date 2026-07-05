"use client";

export const abilities = [
  {
    id: "lucky_one",
    name: "ラッキーワン",
    description: "1の出目が出やすい",
  },
  {
    id: "trickster",
    name: "ラッキーツー",
    description: "2の出目が出やすい",
  },
  {
    id: "lucky_three",
    name: "ラッキースリー",
    description: "3の出目が出やすい",
  },
  {
    id: "lucky_four",
    name: "ラッキーフォー",
    description: "4の出目が出やすい",
  },
  {
    id: "lucky_five",
    name: "ラッキーファイブ",
    description: "5の出目が出やすい",
  },
  {
    id: "lucky_six",
    name: "ラッキーシックス",
    description: "6の出目が出やすい",
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
    id: "shigoro",
    name: "シゴロ賽",
    description: "4・5・6の目しか出ない",
  },
  {
    id: "hifumi123",
    name: "ヒフミ賽",
    description: "1・2・3の目しか出ない",
  },
  {
    id: "gambler",
    name: "ギャンブラー",
    description: "自分が絡むポイントの受け渡しが倍",
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
