"use client";

import { useState } from "react";
import { ABILITY_INFO } from "@/types/game";

const HAND_TABLE = [
  { hand: "ピンゾロ", dice: "1,1,1", multiplier: "5倍" },
  { hand: "ゾロ目", dice: "同じ目3つ（6>5>4>3>2）", multiplier: "3倍" },
  { hand: "シゴロ", dice: "4,5,6", multiplier: "2倍" },
  { hand: "目", dice: "ペア+1個（余りの目で勝負、6>…>1）", multiplier: "1倍" },
  { hand: "役なし", dice: "上記以外", multiplier: "振り直し" },
  { hand: "ヒフミ", dice: "1,2,3", multiplier: "負け・相手が2倍獲得" },
];

export function RulesModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="h-10 shrink-0 border border-stone-400 bg-white px-4 text-sm font-semibold"
        onClick={() => setOpen(true)}
        type="button"
      >
        ルール
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="grid max-h-[85vh] w-full max-w-2xl gap-5 overflow-y-auto bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">遊び方・ルール</h2>
              <button
                className="h-9 w-9 border border-stone-300 text-lg"
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <section>
              <h3 className="mb-2 font-bold">遊び方</h3>
              <p className="text-sm leading-6 text-stone-700">
                親と子がそれぞれ3個のサイコロを振り、役の強さで勝負します。役なしのときは最大3回まで振り直せます。子は振る前に賭け金1〜3ptを選べます。ラウンドごとに親が交代します。同じ強さの役は親の勝ちになります。
              </p>
            </section>

            <section>
              <h3 className="mb-2 font-bold">役の強さと倍率（強い順）</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-stone-300 text-left">
                      <th className="py-1 pr-3">役</th>
                      <th className="py-1 pr-3">出目</th>
                      <th className="py-1">倍率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HAND_TABLE.map((row) => (
                      <tr className="border-b border-stone-100" key={row.hand}>
                        <td className="py-1.5 pr-3 font-semibold">{row.hand}</td>
                        <td className="py-1.5 pr-3 text-stone-600">{row.dice}</td>
                        <td className="py-1.5">{row.multiplier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-600">
                倍率は乗算されます（例: ゾロ目勝ち×相手ヒフミ = 3×2 = 6倍。さらに賭け金・ギャンブラーも乗算）。同値の役は親の勝ちです。
              </p>
            </section>

            <section>
              <h3 className="mb-2 font-bold">能力一覧</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {ABILITY_INFO.map((ability) => (
                  <div className="border border-stone-200 p-2 text-xs" key={ability.id}>
                    <p className="font-semibold">{ability.name}</p>
                    <p className="text-stone-600">{ability.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
