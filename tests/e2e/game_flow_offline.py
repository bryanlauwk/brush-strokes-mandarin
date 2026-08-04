"""断网重连端到端验证：选题瞬间 / 回合切换瞬间断网。

覆盖：
  1. 三人建房、5 秒窗口内加入
  2. 画家「正在选题」瞬间，一名猜题者整段断网 → 恢复 → 不白屏、题目一致
  3. 画家自己在选完题的瞬间断网 → 恢复 → 题目不变、四人一致
  4. 回合切换（本回合结束进入下一回合）瞬间断网 → 恢复 → 不白屏、题目一致

用法: python3 tests/e2e/game_flow_offline.py [base_url]
"""

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots-offline"
SHOTS.mkdir(parents=True, exist_ok=True)
NAMES = ["阿明", "小美", "阿强"]


# ---------- 基础工具 ----------

async def set_name(page, name, timeout_ms=40000):
    waited = 0
    while waited < timeout_ms:
        for ph in ("画画人", "例如：Bryan"):
            box = page.get_by_placeholder(ph)
            if await box.count():
                await box.first.fill(name)
                return
        await page.wait_for_timeout(500)
        waited += 500
    raise AssertionError(f"找不到名字输入框 ({name})")


async def in_room(page):
    return await page.get_by_placeholder("例如：Bryan").count() == 0


async def join_room(page, code, name, attempts=4):
    await page.goto(f"{BASE}/room/{code}", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    for _ in range(attempts):
        if await in_room(page):
            return
        await set_name(page, name)
        try:
            await page.get_by_role("button", name="加入这一局").click(timeout=15000)
        except Exception:
            await page.wait_for_timeout(800)
            continue
        waited = 0
        while waited < 10000:
            if await in_room(page):
                return
            await page.wait_for_timeout(500)
            waited += 500
    raise AssertionError(f"{name} 无法加入房间")


async def word_view(page):
    return await page.evaluate(
        """() => {
          const nodes = [...document.querySelectorAll('p')];
          const hint = nodes.find(n => /正在画/.test(n.textContent || ''));
          if (!hint) return null;
          const word = hint.nextElementSibling;
          return [hint.textContent.trim(), (word?.textContent || '').trim()];
        }"""
    )


async def find_picker(pages, timeout_ms=25000):
    waited = 0
    while waited < timeout_ms:
        for page in pages:
            if await page.locator("[data-testid='word-choice']").count():
                return page
        await pages[0].wait_for_timeout(400)
        waited += 400
    return None


async def wait_converged(pages, timeout_ms=45000):
    waited = 0
    views = []
    while waited < timeout_ms:
        views = [await word_view(p) for p in pages]
        if all(views) and not any("? 个字" in v[0] for v in views):
            masks = {v[1] for v in views if "你正在画" not in v[0]}
            lens = {v[0].split("·")[-1].strip() for v in views if "你正在画" not in v[0]}
            drawer_view = next((v for v in views if "你正在画" in v[0]), None)
            drawer_ready = drawer_view is not None and "_" not in drawer_view[1]
            drawer_len = len(drawer_view[1].split()) if drawer_view else 0
            mask_len = len(next(iter(masks)).split()) if len(masks) == 1 else -1
            if len(masks) == 1 and len(lens) == 1 and drawer_ready and drawer_len == mask_len:
                return True, views, waited
        await pages[0].wait_for_timeout(500)
        waited += 500
    return False, views, waited


# ---------- 白屏检测 ----------

async def screen_state(page):
    """返回 (可见文本长度, 文本片段)。白屏 = 文本几乎为空或只剩崩溃提示。"""
    return await page.evaluate(
        """() => {
          const t = (document.body.innerText || '').trim();
          return [t.length, t.slice(0, 160)];
        }"""
    )


async def assert_not_blank(page, name, label, timeout_ms=30000):
    """恢复网络后页面必须重新渲染出内容，且不能停留在错误页。"""
    waited = 0
    length, text = 0, ""
    while waited < timeout_ms:
        length, text = await screen_state(page)
        crashed = any(k in text for k in ("身份验证失败", "你已经不在这局了", "Unexpected Application Error"))
        if length > 30 and not crashed:
            return text
        await page.wait_for_timeout(500)
        waited += 500
    await page.screenshot(path=str(SHOTS / f"blank_{label}_{name}.png"))
    raise AssertionError(f"[{label}] {name} 出现白屏/崩溃：len={length} text={text!r}")


async def blackout(page, name, label, seconds=6.0):
    """整段断网 seconds 秒后恢复，再确认没白屏。"""
    ctx = page.context
    print(f"  ⛔ [{label}] {name} 断网 {seconds}s")
    await ctx.set_offline(True)
    await page.wait_for_timeout(int(seconds * 1000))
    await page.screenshot(path=str(SHOTS / f"{label}_{name}_offline.png"))
    await ctx.set_offline(False)
    text = await assert_not_blank(page, name, label)
    await page.screenshot(path=str(SHOTS / f"{label}_{name}_online.png"))
    print(f"  ✅ [{label}] {name} 恢复正常，页面文本: {text[:60]!r}")


# ---------- 主流程 ----------

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        pages = []
        for _ in NAMES:
            ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
            pages.append(await ctx.new_page())
        host = pages[0]

        # 用例 1: 建房 + 三人到齐
        await host.goto(BASE, wait_until="domcontentloaded")
        await host.wait_for_timeout(2500)
        await set_name(host, NAMES[0])
        await host.get_by_role("button", name="创建房间").click()
        await host.wait_for_url("**/room/**", timeout=40000)
        code = host.url.rsplit("/", 1)[-1]
        print("room code:", code)

        await asyncio.gather(*(join_room(p, code, n) for p, n in zip(pages[1:], NAMES[1:])))
        online = None
        for _ in range(25):
            await host.wait_for_timeout(1000)
            online = await host.evaluate(
                "() => (document.body.innerText.match(/(\\d+) 人在线/) || [])[1]"
            )
            if online == "3":
                break
        assert online == "3", f"三人应全部在线，实际 {online}"
        print("✅ 三人到齐")

        # 用例 2: 选题瞬间，猜题者断网
        start = host.get_by_role("button", name="开始这一局")
        await start.wait_for(state="visible", timeout=30000)
        await start.click()

        picker = await find_picker(pages)
        assert picker is not None, "选题按钮没有出现"
        drawer_name = NAMES[pages.index(picker)]
        print("画家:", drawer_name)

        guessers = [p for p in pages if p is not picker]
        victim = guessers[0]
        victim_name = NAMES[pages.index(victim)]

        # 断网与画家点题同时发生
        async def pick_now():
            await asyncio.sleep(0.3)
            await picker.locator("[data-testid='word-choice']").first.click(timeout=15000)

        await asyncio.gather(
            blackout(victim, victim_name, "pick", seconds=6.0),
            pick_now(),
        )

        ok, views, took = await wait_converged(pages)
        for n, v in zip(NAMES, views):
            print(f"  选题断网后 {n}: {v}")
        assert ok, "猜题者在选题瞬间断网重连后，题目不一致"
        print(f"✅ 选题瞬间断网：无白屏且三人题目一致（~{took}ms）")

        # 用例 3: 画家在刚锁题后断网
        word_before = (await word_view(picker))[1]
        await blackout(picker, drawer_name, "drawer", seconds=6.0)
        ok2, views2, took2 = await wait_converged(pages)
        word_after = (await word_view(picker))[1]
        for n, v in zip(NAMES, views2):
            print(f"  画家断网后 {n}: {v}")
        assert ok2, "画家断网重连后题目不一致"
        assert word_before == word_after, f"画家断网后题目变了: {word_before} -> {word_after}"
        print(f"✅ 画家断网重连：题目不变、三人一致（~{took2}ms）")

        # 用例 4: 回合切换瞬间断网
        #   猜题者在断网期间跨过回合边界（等待本回合自然结束），恢复后应看到新回合且不白屏。
        round_before = await host.evaluate(
            "() => (document.body.innerText.match(/第\\s*(\\d+)\\s*回合/) || [])[1]"
        )
        print("当前回合:", round_before)

        victim2 = guessers[1]
        victim2_name = NAMES[pages.index(victim2)]
        ctx2 = victim2.context
        await ctx2.set_offline(True)
        print(f"  ⛔ [turn] {victim2_name} 在回合切换窗口断网")

        # 让其余玩家把这一回合走完：猜中即结束
        answer = word_after
        for p in [q for q in pages if q not in (picker, victim2)]:
            box = p.get_by_placeholder("输入你的答案…")
            if await box.count():
                await box.first.fill(answer)
                await box.first.press("Enter")
        await host.wait_for_timeout(12000)  # 跨过回合边界

        await ctx2.set_offline(False)
        text = await assert_not_blank(victim2, victim2_name, "turn")
        await victim2.screenshot(path=str(SHOTS / "turn_recovered.png"))
        print(f"  ✅ [turn] {victim2_name} 恢复正常: {text[:60]!r}")

        # 若已进入下一回合选题，等待所有人再次收敛
        next_picker = await find_picker(pages, timeout_ms=20000)
        if next_picker is not None:
            await next_picker.locator("[data-testid='word-choice']").first.click(timeout=15000)
            ok3, views3, took3 = await wait_converged(pages)
            for n, v in zip(NAMES, views3):
                print(f"  下一回合 {n}: {v}")
            assert ok3, "回合切换断网重连后，题目不一致"
            print(f"✅ 回合切换瞬间断网：无白屏且三人题目一致（~{took3}ms）")
        else:
            print("ℹ️ 未进入下一回合选题（可能已结算），仅验证无白屏")

        for n, p in zip(NAMES, pages):
            await p.screenshot(path=str(SHOTS / f"final_{n}.png"))
        await browser.close()
        print("🎉 断网重连端到端测试全部通过")


asyncio.run(main())
