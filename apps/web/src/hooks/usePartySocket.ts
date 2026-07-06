"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import PartySocket from "partysocket";

interface UsePartySocketOptions {
  roomId: string;
}

function getPersistedConnectionId(roomId: string): string {
  const storageKey = `hyper-chinchiro-pk:${roomId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const id = nanoid();
  sessionStorage.setItem(storageKey, id);
  return id;
}

export function usePartySocket({ roomId }: UsePartySocketOptions) {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
  const [socket, setSocket] = useState<PartySocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );

  useEffect(() => {
    if (!roomId) {
      setSocket(null);
      return;
    }

    const nextSocket = new PartySocket({
      host,
      // partyserver 側の Durable Object バインディング名（ChinchiroServer）の kebab-case
      party: "chinchiro-server",
      room: roomId,
      id: getPersistedConnectionId(roomId),
    });

    const handleOpen = () => setStatus("open");
    const handleClose = () => setStatus("closed");

    nextSocket.addEventListener("open", handleOpen);
    nextSocket.addEventListener("close", handleClose);
    setSocket(nextSocket);
    setStatus(
      nextSocket.readyState === WebSocket.OPEN ? "open" : "connecting",
    );

    return () => {
      nextSocket.removeEventListener("open", handleOpen);
      nextSocket.removeEventListener("close", handleClose);
      nextSocket.close();
      setSocket(null);
    };
  }, [host, roomId]);

  return { socket, status };
}
