import type * as Party from "partykit/server";
import {
  applyMessage,
  createInitialState,
  removePlayer,
} from "./gameLogic/stateMachine";
import type { ClientMessage, GameState, RollResult, ServerMessage } from "./types/game";

export default class ChinchiroServer implements Party.Server {
  private state: GameState;

  constructor(readonly room: Party.Room) {
    this.state = createInitialState(room.id);
  }

  onConnect(conn: Party.Connection) {
    this.send(conn, { type: "state_update", state: this.state });
  }

  onMessage(message: string, sender: Party.Connection) {
    const parsed = this.parseClientMessage(message);
    if (!parsed) {
      this.send(sender, { type: "error", message: "不正なメッセージです" });
      return;
    }

    const previousRoll = this.getLatestRoll(sender.id);
    this.state = applyMessage(this.state, parsed, sender.id);
    const nextRoll = this.getLatestRoll(sender.id);

    if (nextRoll && nextRoll !== previousRoll) {
      this.broadcast({ type: "roll_result", playerId: sender.id, result: nextRoll });
    }

    this.broadcast({ type: "state_update", state: this.state });
  }

  onClose(conn: Party.Connection) {
    this.state = removePlayer(this.state, conn.id);
    this.broadcast({ type: "state_update", state: this.state });
  }

  private parseClientMessage(message: string): ClientMessage | null {
    try {
      const parsed = JSON.parse(message) as Partial<ClientMessage>;
      if (!parsed || typeof parsed.type !== "string") {
        return null;
      }

      return parsed as ClientMessage;
    } catch {
      return null;
    }
  }

  private getLatestRoll(playerId: string): RollResult | null {
    const banker = this.state.players[this.state.bankerIndex];
    if (banker?.id === playerId) {
      return this.state.bankerRoll;
    }

    return this.state.playerRolls[playerId] ?? null;
  }

  private send(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage) {
    this.room.broadcast(JSON.stringify(message));
  }
}

export const onFetch = async (_req: Request) => {
  return new Response("hyper-chinchiro party server", { status: 200 });
};
