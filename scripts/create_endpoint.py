#!/usr/bin/env python3
"""
火山方舟 Endpoint ID 创建辅助脚本

使用方法：
1. 安装依赖: pip install volcengine-python-sdk
2. 设置环境变量:
   export VOLC_ACCESS_KEY=你的AccessKey
   export VOLC_SECRET_KEY=你的SecretKey
3. 运行脚本: python3 create_endpoint.py

AccessKey/SecretKey 获取方式：
  登录 https://console.volcengine.com/ → 右上角头像 → 密钥管理 → 新建密钥

创建完成后，将 Endpoint ID 填入项目 .env 文件的 ARK_ENDPOINT_ID 字段
"""

import os
import sys
import json
import time

try:
    from volcengine.maas import MaasService
except ImportError:
    print("请先安装 volcengine SDK: pip install volcengine-python-sdk")
    sys.exit(1)

ARK_API_KEY = "691071f7-41be-49ba-ac86-ed5085f6dad2"
MODEL_ID = "deepseek-v3-2-251201"


def create_endpoint_via_api():
    access_key = os.environ.get("VOLC_ACCESS_KEY", "")
    secret_key = os.environ.get("VOLC_SECRET_KEY", "")

    if not access_key or not secret_key:
        print("=" * 60)
        print("需要火山引擎 AccessKey/SecretKey 才能创建 Endpoint ID")
        print("=" * 60)
        print()
        print("获取方式：")
        print("  1. 登录 https://console.volcengine.com/")
        print("  2. 右上角头像 → 密钥管理 → 新建密钥")
        print("  3. 复制 AccessKey ID 和 Secret Access Key")
        print()
        print("然后设置环境变量：")
        print("  export VOLC_ACCESS_KEY=你的AccessKey")
        print("  export VOLC_SECRET_KEY=你的SecretKey")
        print()
        print("或者，手动在控制台创建：")
        print("  1. 访问 https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint")
        print("  2. 点击「创建推理接入点」")
        print(f"  3. 选择模型: {MODEL_ID}")
        print("  4. 填写名称: merchant-appeal-endpoint")
        print("  5. 创建后复制 Endpoint ID (ep-开头)")
        print("  6. 填入项目 .env 文件的 ARK_ENDPOINT_ID 字段")
        print()
        return None

    maas = MaasService("ark", "cn-beijing")
    maas.set_ak(access_key)
    maas.set_sk(secret_key)

    print(f"正在创建 Endpoint ID (模型: {MODEL_ID})...")

    try:
        result = maas.post(
            "CreateEndpoint",
            {
                "ModelName": MODEL_ID,
                "EndpointName": f"merchant-appeal-{int(time.time())}",
                "Description": "商户申诉文案生成专用推理接入点",
                "Type": "exclusive",
                "Config": {
                    "Compute": {
                        "Replica": 1,
                        "Unit": "gpu",
                    }
                },
            },
        )
        endpoint_id = result.get("EndpointId", "")
        print(f"创建成功! Endpoint ID: {endpoint_id}")
        print()
        print(f"请将以下内容添加到 .env 文件:")
        print(f"ARK_ENDPOINT_ID={endpoint_id}")
        return endpoint_id
    except Exception as e:
        print(f"创建失败: {e}")
        print()
        print("请手动在控制台创建:")
        print(f"  https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint")
        return None


def test_endpoint(endpoint_id):
    if not endpoint_id:
        return

    print(f"\n测试 Endpoint ID: {endpoint_id}")

    import urllib.request

    url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    data = json.dumps({
        "model": endpoint_id,
        "messages": [
            {"role": "user", "content": "你好，请用一句话介绍你自己。"}
        ],
        "max_tokens": 50,
        "temperature": 0.3,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {ARK_API_KEY}")

    try:
        start = time.time()
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            elapsed = time.time() - start
            usage = result.get("usage", {})
            cached = usage.get("prompt_tokens_details", {}).get("cached_tokens", 0)
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"响应时间: {elapsed:.2f}s")
            print(f"Prompt tokens: {usage.get('prompt_tokens', 0)}")
            print(f"Cached tokens: {cached}")
            print(f"回复: {content[:100]}")
            print()
            if cached > 0:
                print("✅ 前缀缓存已生效!")
            else:
                print("⚠️ 前缀缓存未命中（首次请求正常，第二次应命中）")
    except Exception as e:
        print(f"测试失败: {e}")


def test_prefix_cache():
    print("\n测试前缀缓存效果...")

    import urllib.request

    system_prompt = "你是商户号申诉文案专家。" * 100

    for i in range(2):
        url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
        data = json.dumps({
            "model": MODEL_ID,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"测试请求 #{i+1}，请简短回复。"}
            ],
            "max_tokens": 20,
            "temperature": 0.3,
        }).encode("utf-8")

        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", f"Bearer {ARK_API_KEY}")

        try:
            start = time.time()
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                elapsed = time.time() - start
                usage = result.get("usage", {})
                cached = usage.get("prompt_tokens_details", {}).get("cached_tokens", 0)
                print(f"  请求 #{i+1}: {elapsed:.2f}s, prompt={usage.get('prompt_tokens', 0)}, cached={cached}")
        except Exception as e:
            print(f"  请求 #{i+1} 失败: {e}")

        if i == 0:
            time.sleep(2)


if __name__ == "__main__":
    print("火山方舟 Endpoint ID 创建工具")
    print("=" * 60)
    print()

    endpoint_id = create_endpoint_via_api()

    if endpoint_id:
        test_endpoint(endpoint_id)
    else:
        print("\n也可以先测试当前 API 性能:")
        test_prefix_cache()
