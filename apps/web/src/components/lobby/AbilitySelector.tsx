"use client";

import { ABILITY_INFO } from "@/types/game";

export const abilities = ABILITY_INFO;

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
