"""两名玩家端到端流程验证：选题锁定 / 回合开始 / 5 秒内加入与重连。

用法: python3 tests/e2e/game_flow.py [base_url]
"""

import asyncio
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)


async def set_name(page, name):
    """首页用「画画人」占位符，房间加入页用「例如：Bryan」。"""
    for ph in ("画画人", "例如：Bryan"):
        box = page.get_by_placeholder(ph)
        if await box.count():
            await box.first.fill(name)
            return
    raise AssertionError("找不到名字输入框")


async def room_state(page):
    return await page.evaluate("() => document.body.innerText.slice(0, 400)")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx_a = await browser.new_context(viewport={"width": 1280, "height": 1800})
        ctx_b = await browser.new_context(viewport={"width": 1280, "height": 1800})
        a, b = await ctx_a.new_page(), await ctx_b.new_page()

        # 用例 1: 建房
        await a.goto(BASE, wait_until="domcontentloaded")
        await a.wait_for_timeout(2500)  # 等待 hydration
        await set_name(a, "阿明")
        await a.get_by_role("button", name="创建房间").click()
        await a.wait_for_url("**/room/**", timeout=30000)
        code = a.url.rsplit("/", 1)[-1]
        print("room code:", code)

        # 用例 1/7: B 在 5 秒内加入
        await b.goto(f"{BASE}/room/{code}", wait_until="domcontentloaded")
        await b.wait_for_timeout(2500)
        await set_name(b, "小美")
        await b.get_by_role("button", name="加入这一局").click()
        await b.wait_for_timeout(5000)
        await a.screenshot(path=str(SHOTS / "1_lobby_a.png"))

        # 用例 2: 开始游戏 -> 选题
        start = a.get_by_role("button", name="开始这一局")
        await start.wait_for(state="visible", timeout=20000)
        await start.click()
        await a.wait_for_timeout(4000)
        await a.screenshot(path=str(SHOTS / "2_choosing_a.png"))
        await b.screenshot(path=str(SHOTS / "2_choosing_b.png"))

        # 用例 3: 画家选题锁定（等选项出现，最多 12 秒）
        drawer = None
        for _ in range(24):
            for page in (a, b):
                if await page.locator("[data-testid='word-choice']").count():
                    drawer = page
                    break
            if drawer:
                break
            await a.wait_for_timeout(500)
        assert drawer is not None, "选题按钮没有出现"
        await drawer.locator("[data-testid='word-choice']").first.click()
        await a.wait_for_timeout(3000)
        print("A:", (await room_state(a))[:200])
        print("B:", (await room_state(b))[:200])
        await a.screenshot(path=str(SHOTS / "3_drawing_a.png"))
        await b.screenshot(path=str(SHOTS / "3_drawing_b.png"))

        # 用例 6/7: 快速切页 + 5 秒内重连
        await b.reload(wait_until="domcontentloaded")
        await b.wait_for_timeout(5000)
        await b.screenshot(path=str(SHOTS / "4_reconnect_b.png"))
        print("B after reconnect:", (await room_state(b))[:200])

        await browser.close()


asyncio.run(main())
