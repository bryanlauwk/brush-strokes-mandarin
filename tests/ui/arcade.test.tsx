import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CharacterPicker } from "../../src/components/game/CharacterPicker";
import { ChatPanel } from "../../src/components/game/ChatPanel";
import { InlineSvgAvatar, svgToDataUrl } from "../../src/components/game/PlayerAvatar";
import { Scoreboard } from "../../src/components/game/Scoreboard";
import { CHARACTER_AVATARS, createDefaultAvatar } from "../../src/lib/character-avatars";
import type { Player } from "../../src/lib/game-types";

describe("arcade profile compatibility", () => {
  test("every new mascot fits the existing server avatar contract", () => {
    expect(new Set(CHARACTER_AVATARS.map((avatar) => avatar.id)).size).toBe(8);
    for (const avatar of CHARACTER_AVATARS) {
      expect(avatar.svg.startsWith("<svg ")).toBe(true);
      expect(avatar.svg.endsWith("</svg>")).toBe(true);
      expect(avatar.svg.length).toBeLessThanOrEqual(5000);
      expect(avatar.svg).not.toMatch(
        /<script|foreignobject|javascript:|data:|https?:|\son[a-z]+\s*=/i,
      );
      const display = decodeURIComponent(svgToDataUrl(avatar.svg).split(",")[1]);
      expect(display).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(avatar.svg).not.toContain("xmlns");
    }
  });

  test("compact selection keeps a saved character visible and selected", () => {
    const last = CHARACTER_AVATARS[7];
    const html = renderToStaticMarkup(
      <CharacterPicker value={last.svg} onChange={() => {}} compact />,
    );
    expect(html).toContain(last.name);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((html.match(/<img /g) ?? []).length).toBe(4);
    expect(createDefaultAvatar("阿明")).toBe(createDefaultAvatar("阿明"));
  });

  test("stored avatar markup stays inside an image resource", () => {
    const html = renderToStaticMarkup(
      <InlineSvgAvatar
        svg={'<svg onload="alert(1)"><script>alert(1)</script></svg>'}
        label="测试角色"
      />,
    );
    expect(html).toContain("<img ");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<svg ");
    expect(html).toContain('alt="测试角色"');
  });
});

describe("game role presentation", () => {
  test("the drawing player's guess field is disabled but keeps its accessible name", () => {
    const html = renderToStaticMarkup(
      <ChatPanel messages={[]} disabled placeholder="画手不能剧透哦" onSend={() => {}} />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="');
    expect(html).toContain('role="log"');
    expect(html).toContain('tabindex="0"');
  });

  test("the phone roster exposes drawing, correct and disconnected states in text", () => {
    const base: Player = {
      id: "a",
      room_id: "room",
      name: "画手",
      score: 80,
      round_score: 20,
      has_guessed: false,
      is_host: true,
      avatar: 0,
      last_seen: "",
      joined_at: "",
    };
    const html = renderToStaticMarkup(
      <Scoreboard
        players={[
          base,
          { ...base, id: "b", name: "朋友", has_guessed: true, is_host: false },
          { ...base, id: "c", name: "断线朋友", connection_status: "disconnected", is_host: false },
        ]}
        drawerId="a"
        meId="b"
        variant="strip"
      />,
    );
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("画手");
    expect(html).toContain("猜中");
    expect(html).toContain("断线");
  });
});
