"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GameBoard } from "@/components/game/GameBoard";
import { PlayerList } from "@/components/game/PlayerList";
import { RoundHistory } from "@/components/game/RoundHistory";
import { RulesModal } from "@/components/ui/RulesModal";
import { useGameState } from "@/hooks/useGameState";
import { usePartySocket } from "@/hooks/usePartySocket";

interface RoomClientProps {
  roomId: string;
}

const WRONG_PASSWORD_MESSAGE = "パスワードが違います";

export function RoomClient({ roomId }: RoomClientProps) {
  const searchParams = useSearchParams();
  const initialNickname = searchParams.get("nickname") ?? "";
  const [nickname, setNickname] = useState(initialNickname);
  const [password, setPassword] = useState("");
  const [selectedRoundsPerPlayer, setSelectedRoundsPerPlayer] = useState(1);
  const { socket, status } = usePartySocket({ roomId });
  const { state, lastRoll, error, send } = useGameState(socket);
  const isLobbyPhase = !state || state.phase === "lobby";
  const isSettingsPhase = isLobbyPhase || state?.phase === "ability_select";

  useEffect(() => {
    const stored = sessionStorage.getItem(`room-password-${roomId}`);
    if (stored) {
      setPassword(stored);
    }
  }, [roomId]);

  // サーバー側のroundsPerPlayerが変わったとき（他プレイヤーの変更確定など）だけ
  // ローカルの選択値に反映する。他の理由でのstate_update（isReady変化等）では
  // 発火しないため、編集中の選択がブロードキャストで勝手に戻ることはない
  useEffect(() => {
    if (state?.roundsPerPlayer !== undefined) {
      setSelectedRoundsPerPlayer(state.roundsPerPlayer);
    }
  }, [state?.roundsPerPlayer]);

  // 誤ったパスワード（または直接URLで来た未知のパスワード付きルーム）で参加が
  // 拒否されたら、再入力を促す
  useEffect(() => {
    if (error !== WRONG_PASSWORD_MESSAGE) {
      return;
    }

    const retry = window.prompt(
      "パスワードが違います。もう一度入力してください。",
    );
    if (retry) {
      setPassword(retry);
      sessionStorage.setItem(`room-password-${roomId}`, retry);
    }
  }, [error, roomId]);

  const me = useMemo(() => {
    if (!state || !socket) {
      return null;
    }

    return state.players.find((player) => player.id === socket.id) ?? null;
  }, [socket, state]);

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-stone-950">
      {/* pb-32: 画面下部固定のアクションバーと重ならないための余白 */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-32 sm:px-6">
        <header className="flex items-center gap-3 border-b border-stone-300 pb-5">
          <h1 className="text-3xl font-bold tracking-normal">Hyper Chinchiro</h1>
          <RulesModal />
          <p className="ml-auto text-sm text-stone-600">接続: {status}</p>
        </header>

        {(!me || isSettingsPhase) && (
          <form
            className="grid gap-4 border border-stone-300 bg-white p-5 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              send({
                type: "join",
                nickname,
                abilityId: "trickster",
                abilityMode: "random_turn",
                roundsPerPlayer: selectedRoundsPerPlayer,
                password,
              });
            }}
          >
            <div>
              <h2 className="text-lg font-bold">ニックネームを入力して参加しよう</h2>
              <p className="mt-1 text-sm text-stone-600">
                手番ごとにランダムな特殊能力が付与されます。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-2 text-sm font-medium">
                ニックネーム
                <input
                  autoFocus
                  className="h-12 border border-stone-300 px-3 text-base outline-none focus:border-red-700"
                  maxLength={24}
                  placeholder="例: yamada"
                  required
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                />
              </label>
              <button
                className="h-12 shrink-0 bg-red-800 px-8 text-base font-semibold text-white disabled:bg-stone-400"
                disabled={status !== "open" || !nickname.trim()}
                type="submit"
              >
                参加
              </button>
            </div>
            <label className="grid content-start gap-2 text-sm font-medium">
              ラウンド数
              <select
                className={[
                  "h-11 w-fit border border-stone-300 bg-white px-3 text-base outline-none focus:border-red-700",
                  isSettingsPhase ? "" : "cursor-not-allowed opacity-70",
                ].join(" ")}
                disabled={!isSettingsPhase}
                onChange={(event) =>
                  setSelectedRoundsPerPlayer(Number(event.target.value))
                }
                value={selectedRoundsPerPlayer}
              >
                <option value={1}>人数×1（全員が親を1回）</option>
                <option value={2}>人数×2</option>
                <option value={3}>人数×3</option>
              </select>
            </label>
          </form>
        )}

        {error && <p className="text-sm font-medium text-red-800">{error}</p>}

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <GameBoard
            lastRoll={lastRoll}
            onNextRound={() => send({ type: "next_round" })}
            onReady={() => send({ type: "ready" })}
            onReturnToLobby={() => send({ type: "return_to_lobby" })}
            onRoll={() => send({ type: "roll" })}
            onSetBet={(amount) => send({ type: "set_bet", amount })}
            onSetMaxBet={(amount) => send({ type: "set_max_bet", amount })}
            onUseGodhand={(pinnedValue) =>
              send({ type: "use_active_ability", payload: { pinnedValue } })
            }
            self={me}
            state={state}
          />
          <div className="grid gap-4 content-start">
            <PlayerList selfId={socket?.id} state={state} />
            {state && <RoundHistory state={state} />}
          </div>
        </section>
      </div>
    </main>
  );
}
