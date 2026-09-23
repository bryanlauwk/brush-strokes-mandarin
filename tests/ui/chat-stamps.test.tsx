import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatPanel } from "../../src/components/game/ChatPanel";
import type { ChatMessage } from "../../src/lib/game-types";

const message: ChatMessage = {
  id: 2,
  round: 1,
  player_id: "friend",
  player_name: "阿明",
  text: "阿明 猜中了！ +120",
  kind: "correct",
  created_at: "2026-09-23T12:00:00Z",
};

test("correct-answer seals expose their meaning while preserving the message and score", () => {
  const html = renderToStaticMarkup(
    <ChatPanel
      messages={[message, { ...message, id: 3, text: "小美 猜中了！ +100" }]}
      disabled={false}
      placeholder="输入答案"
      onSend={() => {}}
    />,
  );
  expect(html).toContain('role="img" aria-label="命中印章"');
  expect(html).toContain('role="img" aria-label="妙答印章"');
  expect(html).toContain('<span aria-hidden="true">中</span>');
  expect(html).toContain('<span aria-hidden="true">妙</span>');
  expect(html).toContain("阿明 猜中了！ +120");
  expect(html).toContain("小美 猜中了！ +100");
});

test("ordinary and close guesses never receive a correct-answer seal", () => {
  const html = renderToStaticMarkup(
    <ChatPanel
      messages={[
        { ...message, kind: "guess", text: "拉茶" },
        { ...message, id: 3, kind: "close", text: "阿明 很靠近了！" },
      ]}
      disabled={false}
      placeholder="输入答案"
      onSend={() => {}}
    />,
  );
  expect(html).not.toContain("social-mini-stamp");
  expect(html).toContain("拉茶");
  expect(html).toContain("就差一点");
});
