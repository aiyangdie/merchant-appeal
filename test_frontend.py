#!/usr/bin/env python3
"""
测试商户号申诉助手前端页面
检查页面加载、控制台错误和基本功能
"""
from playwright.sync_api import sync_playwright
import sys

def test_merchant_appeal():
    errors = []
    warnings = []

    with sync_playwright() as p:
        print("🚀 启动浏览器...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 捕获控制台消息
        def handle_console(msg):
            if msg.type == 'error':
                errors.append(f"[Console Error] {msg.text}")
            elif msg.type == 'warning':
                warnings.append(f"[Console Warning] {msg.text}")

        page.on('console', handle_console)

        # 捕获页面错误
        def handle_page_error(err):
            errors.append(f"[Page Error] {err}")

        page.on('pageerror', handle_page_error)

        try:
            # 测试主页
            print("\n📍 测试主页...")
            page.goto('http://localhost:3001', timeout=10000)
            page.wait_for_load_state('networkidle', timeout=10000)
            page.screenshot(path='/tmp/merchant-appeal-home.png', full_page=True)
            print("✅ 主页截图已保存: /tmp/merchant-appeal-home.png")

            # 检查页面标题
            title = page.title()
            print(f"📄 页面标题: {title}")

            # 检查主要元素
            print("\n🔍 检查页面元素...")

            # 检查是否有聊天输入框
            chat_input = page.locator('input[type="text"], textarea').first
            if chat_input.is_visible():
                print("✅ 找到聊天输入框")
            else:
                errors.append("❌ 未找到聊天输入框")

            # 检查是否有按钮
            buttons = page.locator('button').all()
            print(f"📍 找到 {len(buttons)} 个按钮")

            # 测试管理后台
            print("\n📍 测试管理后台...")
            page.goto('http://localhost:3001/admin', timeout=10000)
            page.wait_for_load_state('networkidle', timeout=10000)
            page.screenshot(path='/tmp/merchant-appeal-admin.png', full_page=True)
            print("✅ 管理后台截图已保存: /tmp/merchant-appeal-admin.png")

            # 检查管理后台登录表单
            login_form = page.locator('input[type="text"], input[type="password"]').all()
            print(f"📍 找到 {len(login_form)} 个输入框")

        except Exception as e:
            errors.append(f"[Test Error] {str(e)}")
            print(f"❌ 测试出错: {e}")

        finally:
            browser.close()

    # 输出测试结果
    print("\n" + "="*60)
    print("📊 测试结果汇总")
    print("="*60)

    if errors:
        print(f"\n❌ 发现 {len(errors)} 个错误:")
        for err in errors:
            print(f"  - {err}")

    if warnings:
        print(f"\n⚠️  发现 {len(warnings)} 个警告:")
        for warn in warnings[:5]:  # 只显示前5个警告
            print(f"  - {warn}")

    if not errors:
        print("\n✅ 所有测试通过！")
        return 0
    else:
        print("\n❌ 测试未通过，需要修复错误")
        return 1

if __name__ == '__main__':
    sys.exit(test_merchant_appeal())
