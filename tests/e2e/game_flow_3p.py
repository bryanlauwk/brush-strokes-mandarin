"""三名玩家端到端验证：5 秒内同时加入 / 并发选题 / 重连，最终题目完全一致。

用法: python3 tests/e2e/game_flow_3p.py [base_url]
"""

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots-3p"
SHOTS.mkdir(parents=True, exist_ok=True)


async def set_name(page, name):
    """首页用「画画人」占位符，房间加入页用「例如：Bryan」。"""
    for ph in ("画画人", "例如：Bryan"):
        box = page.get_by_placeholder(ph)
        if await box.count():
            await box.first.fill(name)
            return
    raise AssertionError("找不到名字输入框")


async def join_room(page, code, name):
    await page.goto(f"{BASE}/room/{code}", wait_until="domcontentloaded")
    await page.wait_for_timeout(2500)  # hydration
    await set_name(page, name)
    await page.get_by_role("button", name="加入这一局").click()


async def word_view(page):
    """返回 (提示行, 题目行)，例如 ("阿明 正在画 · 3 个字", "_ _ _")。"""
    return await page.evaluate(
        """() => {
          const nodes = [...document.querySelectorAll('p')];
          const hint = nodes.find(n => /正在画/.test(n.textContent || ''));
          if (!hint) return null;
          const word = hint.nextElementSibling;
          return [hint.textContent.trim(), (word?.textContent || '').trim()];
        }"""
    )


async def find_picker(pages, timeout_ms=15000):
    waited = 0
    while waited < timeout_ms:
        for page in pages:
            if await page.locator("[data-testid='word-choice']").count():
                return page
        await pages[0].wait_for_timeout(400)
        waited += 400
    return None


async def wait_converged(pages, timeout_ms=25000):
    """等所有玩家的题目视图收敛，返回 (是否一致, 各自视图)。"""
    waited = 0
    views = []
    while waited < timeout_ms:
        views = [await word_view(p) for p in pages]
        if all(views) and not any("? 个字" in v[0] for v in views):
            masks = {v[1] for v in views if "你正在画" not in v[0]}
            lens = {v[0].split("·")[-1].strip() for v in views if "你正在画" not in v[0]}
            if len(masks) == 1 and len(lens) == 1:
                return True, views
        await pages[0].wait_for_timeout(500)
        waited += 500
    return False, views


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        pages = []
        for _ in range(3):
            ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
            pages.append(await ctx.new_page())
        a, b, c = pages

        # 用例 1: 建房
        await a.goto(BASE, wait_until="domcontentloaded")
        await a.wait_for_timeout(2500)
        await set_name(a, "阿明")
        await a.get_by_role("button", name="创建房间").click()
        await a.wait_for_url("**/room/**", timeout=30000)
        code = a.url.rsplit("/", 1)[-1]
        print("room code:", code)

        # 用例 2: 小美 + 阿强 在 5 秒窗口内「同时」加入
        await asyncio.gather(join_room(b, code, "小美"), join_room(c, code, "阿强"))
        await a.wait_for_timeout(5000)
        online = await a.evaluate("() => (document.body.innerText.match(/(\\d+) 人在线/) || [])[1]")
        print("在线人数:", online)
        assert online == "3", f"三人应全部在线，实际 {online}"
        await a.screenshot(path=str(SHOTS / "1_lobby.png"))

        # 用例 3: 开局
        start = a.get_by_role("button", name="开始这一局")
        await start.wait_for(state="visible", timeout=20000)
        await start.click()

        # 用例 4: 并发选题 —— 三个页面同时抢点第一个选项，只有画家那份生效
        picker = await find_picker(pages)
        assert picker is not None, "选题按钮没有出现"
        print("画家页面 index:", pages.index(picker))

        async def try_pick(page):
            choice = page.locator("[data-testid='word-choice']").first
            try:
                if await choice.count():
                    await choice.click(timeout=3000)
            except Exception:
                pass  # 非画家点不到，属预期

        await asyncio.gather(*(try_pick(p) for p in pages))
        await a.wait_for_timeout(2000)
        for i, p in enumerate(pages):
            await p.screenshot(path=str(SHOTS / f"2_after_pick_{i}.png"))

        # 用例 5: 题目一致性（并发选题后）
        ok, views = await wait_converged(pages)
        for i, v in enumerate(views):
            print(f"玩家{i}: {v}")
        assert ok, "并发选题后各玩家看到的题目不一致"
        print("✅ 并发选题后三人题目一致")

        # 用例 6: 5 秒内重连（非画家 + 画家各一次）
        guessers = [p for p in pages if p is not picker]
        await guessers[0].reload(wait_until="domcontentloaded")
        await guessers[0].wait_for_timeout(5000)
        ok2, views2 = await wait_converged(pages)
        for i, v in enumerate(views2):
            print(f"重连后 玩家{i}: {v}")
        assert ok2, "重连后题目不一致"
        await guessers[0].screenshot(path=str(SHOTS / "3_reconnect_guesser.png"))
        print("✅ 猜题玩家 5 秒内重连后题目仍一致")

        drawer_word_before = (await word_view(picker))[1]
        await picker.reload(wait_until="domcontentloaded")
        await picker.wait_for_timeout(5000)
        ok3, views3 = await wait_converged(pages)
        drawer_word_after = (await word_view(picker))[1]
        for i, v in enumerate(views3):
            print(f"画家重连后 玩家{i}: {v}")
        assert ok3, "画家重连后题目不一致"
        assert drawer_word_before == drawer_word_after, (
            f"画家重连后题目变了: {drawer_word_before} -> {drawer_word_after}"
        )
        await picker.screenshot(path=str(SHOTS / "4_reconnect_drawer.png"))
        print("✅ 画家 5 秒内重连后题目不变，三人视图一致")

        await browser.close()


asyncio.run(main())
