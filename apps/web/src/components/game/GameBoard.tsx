"use client";

import { useEffect, useState } from "react";
import { DiceDisplay } from "./DiceDisplay";
import { GameResult } from "./GameResult";
import { HandResult } from "./HandResult";
import {
  ABILITY_INFO,
  type GameState,
  type Player,
  type RollResult,
  type RoundSettlement,
} from "@/types/game";

const abilityNames: Record<string, string> = Object.fromEntries(
  ABILITY_INFO.map((ability) => [ability.id, ability.name]),
);

const abilityDescriptions: Record<string, string> = Object.fromEntries(
  ABILITY_INFO.map((ability) => [ability.id, ability.description]),
);

const DEFAULT_MAX_ROLLS = 3;

function getMaxRolls(abilityId: string | null): number {
  return abilityId === "double_chance"
    ? DEFAULT_MAX_ROLLS + 1
    : DEFAULT_MAX_ROLLS;
}

interface GameBoardProps {
  state: GameState | null;
  self: Player | null;
  lastRollPlayerId?: string;
  onReady: () => void;
  onRoll: () => void;
  onSetBet: (amount: number) => void;
  onUseGodhand: (pinnedValue: number) => void;
  onNextRound: () => void;
  onReturnToLobby: () => void;
}

export function GameBoard({
  state,
  self,
  lastRollPlayerId,
  onReady,
  onRoll,
  onSetBet,
  onUseGodhand,
  onNextRound,
  onReturnToLobby,
}: GameBoardProps) {
  const [pinnedValue, setPinnedValue] = useState(6);
  const banker = state?.players[state.bankerIndex] ?? null;
  const activePlayer = state?.players[state.currentPlayerIndex] ?? null;
  const isMyTurn = Boolean(self && activePlayer?.id === self.id);
  const activeAbilityId = self ? getEffectiveAbilityId(state, self) : null;
  const activeTurnAbilityId = activePlayer
    ? getEffectiveAbilityId(state, activePlayer)
    : null;
  const canRoll =
    Boolean(self) &&
    isMyTurn &&
    (state?.phase === "banker_turn" || state?.phase === "player_turn");
  const canUseGodhand =
    canRoll && activeAbilityId === "godhand" && !self?.abilityUsedThisRound;
  const isGameOver = state?.phase === "game_over";
  const bankerRoundDelta = banker
    ? Object.values(state?.roundSettlements ?? {}).reduce(
        (total, settlement) => total + settlement.bankerDelta,
        0,
      )
    : 0;
  const canBet =
    Boolean(self) &&
    isMyTurn &&
    state?.phase === "player_turn" &&
    (state.rollCountMap[self!.id] ?? 0) === 0;
  const currentBet = self ? (state?.bets[self.id] ?? 1) : 1;

  const announcement = useAbilityAnnouncement(state, self, activePlayer, activeTurnAbilityId);

  return (
    <div
      className={[
        "min-h-80 border bg-white p-5",
        isMyTurn
          ? "border-2 border-red-800 shadow-[0_0_0_4px_rgba(153,27,27,0.12)]"
          : "border-stone-300",
      ].join(" ")}
    >
      {announcement && (
        <div className="fixed inset-x-0 top-16 z-50 mx-auto w-fit animate-[fade-in-out_2.5s_ease-in-out] border-2 border-red-800 bg-white px-5 py-3 text-center shadow-lg">
          <p className="text-sm font-bold text-red-800">
            {announcement.nickname}の能力: {announcement.abilityName}
          </p>
          <p className="text-xs text-stone-600">{announcement.abilityDescription}</p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-stone-600">
        <span>Phase: {state?.phase ?? "loading"}</span>
        <span>Round: {state ? `${state.round}/${state.maxRounds}` : "-"}</span>
        <span>親: {banker?.nickname ?? "-"}</span>
        <span>
          手番: {activePlayer?.nickname ?? "-"}
          {activePlayer && activePlayer.connected === false ? "（切断中）" : ""}
        </span>
        {state?.abilityMode === "random_turn" && activeTurnAbilityId && (
          <span>
            今の能力: {abilityNames[activeTurnAbilityId] ?? activeTurnAbilityId}
          </span>
        )}
      </div>

      {isGameOver && state && <GameResult state={state} />}

      {self && (
        <div className="mb-5 border-b border-stone-200 pb-5">
          <AbilityCard
            abilityId={activeAbilityId}
            randomMode={state?.abilityMode === "random_turn"}
          />
        </div>
      )}

      {canUseGodhand && (
        <div className="mb-5 grid gap-3 border border-red-200 bg-red-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-2 text-sm font-semibold">
            神の一手
            <select
              className="h-10 border border-red-200 bg-white px-3 text-base outline-none focus:border-red-700"
              onChange={(event) => setPinnedValue(Number(event.target.value))}
              value={pinnedValue}
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            className="h-10 bg-red-800 px-4 text-sm font-semibold text-white"
            onClick={() => onUseGodhand(pinnedValue)}
            type="button"
          >
            固定して振る
          </button>
        </div>
      )}

      <div className="grid gap-4">
        <RollPanel
          isActive={activePlayer?.id === banker?.id}
          isBanker
          player={banker}
          roll={state?.bankerRoll ?? null}
          rolling={lastRollPlayerId === banker?.id}
          rollCount={banker ? (state?.rollCountMap[banker.id] ?? 0) : 0}
          settlementSummary={
            state?.phase === "round_result" || state?.phase === "game_over"
              ? {
                  label: "ラウンド合計",
                  delta: bankerRoundDelta,
                }
              : null
          }
          state={state}
        />
        {state?.players
          .filter((player) => player.id !== banker?.id)
          .map((player) => (
            <RollPanel
              bet={state.bets[player.id]}
              isActive={activePlayer?.id === player.id}
              isBanker={false}
              key={player.id}
              player={player}
              roll={state.playerRolls[player.id] ?? null}
              rolling={lastRollPlayerId === player.id}
              rollCount={state.rollCountMap[player.id] ?? 0}
              settlement={state.roundSettlements[player.id] ?? null}
              state={state}
            />
          ))}
      </div>

      {self && (
        <ActionBar
          activePlayer={activePlayer}
          canBet={canBet}
          canRoll={canRoll}
          currentBet={currentBet}
          isGameOver={isGameOver}
          isMyTurn={isMyTurn}
          maxRolls={getMaxRolls(activeAbilityId)}
          onNextRound={onNextRound}
          onReady={onReady}
          onReturnToLobby={onReturnToLobby}
          onRoll={onRoll}
          onSetBet={onSetBet}
          phase={state?.phase ?? null}
          rollCount={self ? (state?.rollCountMap[self.id] ?? 0) : 0}
          self={self}
        />
      )}
    </div>
  );
}

function useAbilityAnnouncement(
  state: GameState | null,
  self: Player | null,
  activePlayer: Player | null,
  activeTurnAbilityId: string | null,
) {
  const [announcement, setAnnouncement] = useState<{
    nickname: string;
    abilityName: string;
    abilityDescription: string;
  } | null>(null);

  useEffect(() => {
    if (
      state?.abilityMode !== "random_turn" ||
      !activePlayer ||
      !activeTurnAbilityId
    ) {
      return;
    }

    const nickname =
      self && activePlayer.id === self.id ? "あなた" : activePlayer.nickname;
    setAnnouncement({
      nickname,
      abilityName: abilityNames[activeTurnAbilityId] ?? activeTurnAbilityId,
      abilityDescription: abilityDescriptions[activeTurnAbilityId] ?? "",
    });

    const timeout = window.setTimeout(() => setAnnouncement(null), 2500);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlayer?.id, activeTurnAbilityId, state?.abilityMode]);

  return announcement;
}

function ActionBar({
  activePlayer,
  canBet,
  canRoll,
  currentBet,
  isGameOver,
  isMyTurn,
  maxRolls,
  onNextRound,
  onReady,
  onReturnToLobby,
  onRoll,
  onSetBet,
  phase,
  rollCount,
  self,
}: {
  activePlayer: Player | null;
  canBet: boolean;
  canRoll: boolean;
  currentBet: number;
  isGameOver: boolean;
  isMyTurn: boolean;
  maxRolls: number;
  onNextRound: () => void;
  onReady: () => void;
  onReturnToLobby: () => void;
  onRoll: () => void;
  onSetBet: (amount: number) => void;
  phase: GameState["phase"] | null;
  rollCount: number;
  self: Player;
}) {
  let statusText = "";
  let action: { label: string; onClick: () => void; disabled: boolean } | null =
    null;

  const remaining = maxRolls - rollCount;

  if (phase === "lobby" || phase === "ability_select") {
    statusText = "全員がReadyになると開始します";
    action = {
      label: self.isReady ? "Ready済み" : "Ready",
      onClick: onReady,
      disabled: self.isReady,
    };
  } else if (phase === "banker_turn" || phase === "player_turn") {
    if (isMyTurn) {
      statusText =
        activePlayer?.connected === false
          ? `${activePlayer.nickname}（切断中）の復帰を待っています…`
          : "あなたの番です！";
      const rollLabel =
        remaining <= 1 ? "振る（ラスト）" : `振る（あと${remaining}回）`;
      action = { label: rollLabel, onClick: onRoll, disabled: !canRoll };
    } else {
      statusText =
        activePlayer?.connected === false
          ? `${activePlayer.nickname}（切断中）の復帰を待っています…`
          : `${activePlayer?.nickname ?? "-"} の番です`;
    }
  } else if (phase === "round_result") {
    statusText = "結果を確認したら次へ";
    action = { label: "次ラウンド", onClick: onNextRound, disabled: false };
  } else if (isGameOver) {
    statusText = "ゲーム終了！全員Readyで再戦";
    action = {
      label: self.isReady ? "Ready済み" : "再戦 Ready",
      onClick: onReady,
      disabled: self.isReady,
    };
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-red-800 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <span
          className={[
            "text-sm",
            isMyTurn ? "font-bold text-red-800" : "text-stone-600",
          ].join(" ")}
        >
          {statusText}
        </span>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canBet && (
            <div className="flex items-center gap-1 border border-stone-300 bg-white p-1">
              {[1, 2, 3].map((amount) => (
                <button
                  className={[
                    "h-10 w-14 text-sm font-semibold transition",
                    currentBet === amount
                      ? "bg-red-800 text-white"
                      : "bg-white text-stone-700 hover:bg-stone-100",
                  ].join(" ")}
                  key={amount}
                  onClick={() => onSetBet(amount)}
                  type="button"
                >
                  {amount}pt
                </button>
              ))}
            </div>
          )}
          {isGameOver && (
            <button
              className="h-14 border border-stone-400 px-4 text-sm font-semibold text-stone-700 transition-transform active:scale-95"
              onClick={onReturnToLobby}
              type="button"
            >
              能力モードに戻る
            </button>
          )}
          {action && (
            <button
              className="h-14 min-w-40 bg-red-800 px-8 text-lg font-bold text-white transition-transform active:scale-95 disabled:bg-stone-400 sm:min-w-56"
              disabled={action.disabled}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RollPanel({
  bet,
  isActive,
  isBanker,
  player,
  roll,
  rolling,
  rollCount,
  settlement,
  settlementSummary,
  state,
}: {
  bet?: number;
  isActive: boolean;
  isBanker: boolean;
  player: Player | null;
  roll: RollResult | null;
  rolling: boolean;
  rollCount: number;
  settlement?: RoundSettlement | null;
  settlementSummary?: { label: string; delta: number } | null;
  state: GameState | null;
}) {
  const title = player
    ? `${player.nickname}${isBanker ? "(親)" : ""} の出目`
    : "出目";
  const abilityId = player ? getEffectiveAbilityId(state, player) : null;
  const maxRolls = getMaxRolls(abilityId);
  const remaining = maxRolls - rollCount;

  return (
    <section
      className={[
        "border p-4",
        isActive ? "border-red-800 bg-red-50" : "border-stone-200",
      ].join(" ")}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-700">
          {title}
          {player?.connected === false && (
            <span className="ml-2 border border-amber-500 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              切断中
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          {!isBanker && bet && bet > 1 && (
            <span className="border border-red-300 bg-red-50 px-2 py-0.5 font-semibold text-red-800">
              賭け {bet}pt
            </span>
          )}
          {abilityId && <span>ability {abilityNames[abilityId] ?? abilityId}</span>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <DiceDisplay dice={roll?.dice ?? null} rolling={rolling} />
          <HandResult remaining={remaining} roll={roll} />
        </div>
        <SettlementDisplay
          playerId={player?.id ?? null}
          settlement={settlement}
          summary={settlementSummary}
        />
      </div>
    </section>
  );
}

function SettlementDisplay({
  playerId,
  settlement,
  summary,
}: {
  playerId: string | null;
  settlement?: RoundSettlement | null;
  summary?: { label: string; delta: number } | null;
}) {
  if (summary) {
    return (
      <PointDeltaCard
        delta={summary.delta}
        label={summary.label}
        reason={summary.delta === 0 ? "移動なし" : ""}
      />
    );
  }

  if (!settlement || !playerId) {
    return null;
  }

  const delta =
    playerId === settlement.bankerId
      ? settlement.bankerDelta
      : settlement.playerDelta;

  return (
    <PointDeltaCard
      delta={delta}
      label={delta >= 0 ? "獲得" : "支払い"}
      reason={settlement.reason}
    />
  );
}

function PointDeltaCard({
  delta,
  label,
  reason,
}: {
  delta: number;
  label: string;
  reason: string;
}) {
  const positive = delta > 0;
  const neutral = delta === 0;

  return (
    <div
      className={[
        "grid min-w-32 gap-1 border p-3 text-right text-sm",
        positive
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : neutral
            ? "border-stone-200 bg-stone-50 text-stone-600"
            : "border-red-300 bg-red-50 text-red-800",
      ].join(" ")}
    >
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-2xl font-bold">
        {delta > 0 ? "+" : ""}
        {delta}pt
      </span>
      {reason && <span className="text-xs">{reason}</span>}
    </div>
  );
}

function AbilityCard({
  abilityId,
  randomMode,
}: {
  abilityId: string | null;
  randomMode: boolean;
}) {
  if (!abilityId) {
    return (
      <section className="grid gap-1 border border-stone-200 bg-stone-50 p-4 text-sm">
        <span className="text-xs font-semibold uppercase tracking-normal text-stone-500">
          Ability
        </span>
        <h2 className="text-base font-bold text-stone-800">
          {randomMode ? "手番で決定" : "未選択"}
        </h2>
        <p className="leading-6 text-stone-600">
          {randomMode
            ? "毎ターンランダムモードでは、自分の手番になると能力が表示されます。"
            : "能力を選択して参加してください。"}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-1 border-2 border-red-800 bg-red-50 p-4 text-sm">
      <span className="text-xs font-semibold uppercase tracking-normal text-red-800">
        Ability
      </span>
      <h2 className="text-base font-bold text-stone-950">
        {abilityNames[abilityId] ?? abilityId}
      </h2>
      <p className="leading-6 text-stone-700">
        {abilityDescriptions[abilityId] ?? ""}
      </p>
    </section>
  );
}

function getEffectiveAbilityId(
  state: GameState | null,
  player: Player,
): string | null {
  if (state?.abilityMode === "random_turn") {
    return state.currentTurnAbilityMap[player.id] ?? null;
  }

  return player.abilityId;
}
