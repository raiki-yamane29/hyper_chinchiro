"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");

  const goToRoom = (targetRoomId: string) => {
    const params = new URLSearchParams();
    if (nickname.trim()) {
      params.set("nickname", nickname.trim());
    }

    const query = params.toString();
    router.push(`/room/${targetRoomId}${query ? `?${query}` : ""}`);
  };

  return (
    <div className="min-h-screen bg-[#f7f2e8] text-stone-950">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-8 px-4 py-10 sm:px-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-normal text-red-800">
            Realtime Dice Battle
          </p>
          <h1 className="text-4xl font-bold tracking-normal sm:text-6xl">
            Hyper Chinchiro
          </h1>
          <p className="max-w-2xl text-base leading-7 text-stone-700">
            チンチロに特殊能力を加えたリアルタイム対戦ゲーム。
          </p>
        </header>

        <section className="grid gap-4 border border-stone-300 bg-white p-5 shadow-sm">
          <label className="grid gap-2 text-sm font-semibold">
            ニックネーム
            <input
              className="h-12 border border-stone-300 px-3 text-base outline-none focus:border-red-700"
              maxLength={24}
              placeholder="例: yamada"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              className="h-12 bg-red-800 px-5 font-semibold text-white disabled:bg-stone-400"
              disabled={!nickname.trim()}
              onClick={() => goToRoom(nanoid(8))}
              type="button"
            >
              新規ルーム作成
            </button>

            <form
              className="grid gap-3 sm:grid-cols-[180px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                if (roomId.trim()) {
                  goToRoom(roomId.trim());
                }
              }}
            >
              <input
                className="h-12 border border-stone-300 px-3 text-base outline-none focus:border-red-700"
                placeholder="roomId"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              />
              <button
                className="h-12 border border-stone-800 px-5 font-semibold disabled:border-stone-300 disabled:text-stone-400"
                disabled={!nickname.trim() || !roomId.trim()}
                type="submit"
              >
                参加
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
