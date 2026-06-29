"use client";

import { useCallback, useEffect, useState } from "react";
import type PartySocket from "partysocket";
import type {
  ClientMessage,
  GameState,
  RollResult,
  ServerMessage,
} from "@/types/game";

export function useGameState(socket: PartySocket | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [lastRoll, setLastRoll] = useState<{
    playerId: string;
    result: RollResult;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleMessage = (event: MessageEvent<string>) => {
      const message = parseServerMessage(event.data);
      if (!message) {
        return;
      }

      if (message.type === "state_update") {
        setState(message.state);
      }
      if (message.type === "roll_result") {
        setLastRoll({ playerId: message.playerId, result: message.result });
      }
      if (message.type === "error") {
        setError(message.message);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket]);

  const send = useCallback(
    (message: ClientMessage) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setError("サーバーに接続していません");
        return false;
      }

      socket.send(JSON.stringify(message));
      return true;
    },
    [socket],
  );

  return { state, lastRoll, error, send };
}

function parseServerMessage(payload: string): ServerMessage | null {
  try {
    return JSON.parse(payload) as ServerMessage;
  } catch {
    return null;
  }
}
