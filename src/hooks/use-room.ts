import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getRoomSnapshot, roomExists } from "@/lib/game.functions";
import type { ChatMessage, Player, Room, Stroke } from "@/lib/game-types";

export type LiveStroke = { id: string; color: string; size: number; points: [number, number][] };

export type RoomIdentity = { playerId: string; token: string } | null;

const POLL_MS = 1000;

export function useRoom(code: string, identity: RoomIdentity) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [live, setLive] = useState<Record<string, LiveStroke>>({});
  const [missing, setMissing] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const turnRef = useRef<number>(-1);

  const playerId = identity?.playerId ?? null;
  const token = identity?.token ?? null;

  // Without an identity we can only check that the room code exists.
  useEffect(() => {
    if (identity) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await roomExists({ data: { code: code.toUpperCase() } });
        if (!cancelled) setMissing(!res.exists);
      } catch {
        /* keep current state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, identity]);

  useEffect(() => {
    if (!playerId || !token) return;
    let cancelled = false;
    const upper = code.toUpperCase();

    setMissing(false);
    turnRef.current = -1;

    const applySnapshot = (snap: {
      room: Room;
      players: Player[];
      messages: ChatMessage[];
      strokes: Stroke[];
    }) => {
      if (cancelled) return;
      setRoom(snap.room);
      setPlayers(snap.players);
      setMessages(snap.messages);
      if (snap.room.turn_index !== turnRef.current) {
        turnRef.current = snap.room.turn_index;
        setLive({});
      }
      setStrokes((prev) => {
        const seen = new Set(snap.strokes.map((s) => s.id));
        const localOnly = prev.filter((s) => !seen.has(s.id));
        return snap.strokes.length || !localOnly.length ? snap.strokes : prev;
      });
      setLive((prev) => {
        if (!snap.strokes.length) return prev;
        const next = { ...prev };
        for (const s of snap.strokes) delete next[s.id];
        return next;
      });
    };

    const refresh = async () => {
      try {
        const snap = await getRoomSnapshot({
          data: { code: upper, playerId, token },
        });
        applySnapshot(snap as unknown as {
          room: Room;
          players: Player[];
          messages: ChatMessage[];
          strokes: Stroke[];
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message.includes("找不到这个号码")) setMissing(true);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);

    const channel = supabase
      .channel(`room-${upper}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "live" }, ({ payload }) => {
        const s = payload as LiveStroke;
        setLive((prev) => ({ ...prev, [s.id]: s }));
      })
      .on("broadcast", { event: "live-end" }, ({ payload }) => {
        const { id } = payload as { id: string };
        setLive((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        void refresh();
      })
      .on("broadcast", { event: "sync" }, () => {
        void refresh();
      });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [code, playerId, token]);

  const broadcastLive = useCallback((stroke: LiveStroke) => {
    void channelRef.current?.send({ type: "broadcast", event: "live", payload: stroke });
  }, []);

  const broadcastLiveEnd = useCallback((id: string) => {
    void channelRef.current?.send({ type: "broadcast", event: "live-end", payload: { id } });
  }, []);

  const appendLocalStroke = useCallback((stroke: Stroke) => {
    setStrokes((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]));
    void channelRef.current?.send({ type: "broadcast", event: "sync", payload: {} });
  }, []);

  const me = players.find((p) => p.id === playerId) ?? null;

  return {
    room,
    players,
    messages,
    strokes,
    live,
    missing,
    me,
    broadcastLive,
    broadcastLiveEnd,
    appendLocalStroke,
  };
}
