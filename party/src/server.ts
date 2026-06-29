import type * as Party from "partykit/server";

export default class ChinchiroServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "connected", roomId: this.room.id }));
  }

  onMessage(message: string, sender: Party.Connection) {
    // TODO: implement game logic
    this.room.broadcast(message, [sender.id]);
  }

  onClose(conn: Party.Connection) {
    console.log(`Connection closed: ${conn.id}`);
  }
}

export const onFetch: Party.WorkerFetch = async (req) => {
  return new Response("hyper-chinchiro party server", { status: 200 });
};
