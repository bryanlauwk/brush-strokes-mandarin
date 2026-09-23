import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GameFeedback } from "../../src/components/game/GameFeedback";

test("feedback keeps an empty, persistent live region ready for the next update", () => {
  const html = renderToStaticMarkup(<GameFeedback event={null} />);

  expect(html).toContain('class="sr-only"');
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('aria-atomic="true"');
});

test("a correct answer renders the decorative stamp and one readable announcement", () => {
  const html = renderToStaticMarkup(
    <GameFeedback
      event={{
        id: 1,
        kind: "correct",
        title: "一语中的",
        subtitle: "阿强 猜中了！ +150 分",
      }}
    />,
  );

  expect(html).toContain("social-stamp-feedback");
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("一语中的。阿强 猜中了！ +150 分");
});
