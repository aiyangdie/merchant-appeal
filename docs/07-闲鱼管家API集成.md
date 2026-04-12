# 闲鱼管家API集成文档

## 概述

本项目集成闲鱼管家开放平台API，实现订单查询、订单详情等功能，用于"绑定闲鱼订单"功能。

**官方文档地址**: https://open.goofish.pro

## API凭证

```env
XIANGUAN_BASE_URL=https://open.goofish.pro
XIANGUAN_APPID=1500256339739973
XIANGUAN_APPSECRET=ggEj73NV7fJfpwPQxDtFiyGIPkyHuxFH
```

## 签名规则

### 签名公式

```
signMd5 = md5("应用KEY,Body报文Md5值,时间戳,应用密钥")
```

### 签名生成步骤

```
1. bodyMd5 = md5(Json格式的Body报文)
   示例：md5({"product_id":"219530767978565"})
   输出：2608f2139cca8755cabf25209251e549

2. signMd5 = md5("应用KEY,Body报文Md5值,时间戳,应用密钥")
   示例：md5("203413189371893,2608f2139cca8755cabf25209251e549,1636087298,o9wl81dncmvby3ijpq7eur456zhgtaxs")
   输出：c26c8a48809141f3dd80bd9b9ddb41ea
```

### 重要注意事项

- 所有参数都是强校验，需严格按照文档的字段类型传参
- body原样参与签名，不需要排序
- body必须使用压缩后的json，示例：`{"keyword":"","goods_type":2,"page_no":1,"page_size":50}`
- body有中文、链接也原样传参，不要编码
- 无body参数时签名字符串为 `md5("{}")` 或 `md5("")`

## API接口

### 1. 查询闲鱼店铺

**接口路径**: `/api/open/user/authorize/list`

**请求参数**: 无body参数

**响应字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| authorize_id | int64 | 授权ID |
| user_identity | string | 闲鱼会员ID（唯一标识） |
| user_name | string | 闲鱼会员名 |
| user_nick | string | 闲鱼号昵称 |
| shop_name | string | 店铺名称 |
| is_pro | boolean | 是否开通鱼小铺 |
| is_valid | boolean | 是否有效订购中 |
| is_trial | boolean | 是否免费试用版本 |
| valid_end_time | int32 | 订购有效结束时间 |
| item_biz_types | string | 准入业务类型 |

### 2. 查询订单列表

**接口路径**: `/api/open/order/list`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page_size | integer | 否 | 每页数量，默认50 |
| page_no | integer | 否 | 页码，默认1 |
| order_status | string | 否 | 订单状态筛选 |
| start_time | string | 否 | 开始时间 |
| end_time | string | 否 | 结束时间 |
| order_no | string | 否 | 订单号搜索 |
| buyer_nick | string | 否 | 买家昵称搜索 |

### 3. 查询订单详情

**接口路径**: `/api/open/order/detail`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| order_no | string | 是 | 闲鱼订单号 |

### 4. 订单卡密列表

**接口路径**: `/api/open/order/kam/list`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| order_no | string | 是 | 闲鱼订单号 |

### 5. 查询快递公司

**接口路径**: `/api/open/express/companies`

**请求参数**: 无

**热门快递公司代码**:

| code | 名称 |
|------|------|
| shunfeng | 顺丰速运 |
| yuantong | 圆通速递 |
| zhongtong | 中通快递 |
| yunda | 韵达快递 |
| shentong | 申通快递 |
| ems | EMS |
| jd | 京东物流 |
| other | 其他 |

## 代码示例

### JavaScript

```javascript
import axios from 'axios';
import crypto from 'crypto';

const appKey = '1500256339739973';
const appSecret = 'ggEj73NV7fJfpwPQxDtFiyGIPkyHuxFH';
const baseUrl = 'https://open.goofish.pro';

function generateSign(bodyJson, timestamp) {
  const bodyMd5 = crypto.createHash('md5').update(bodyJson || '').digest('hex');
  const signStr = `${appKey},${bodyMd5},${timestamp},${appSecret}`;
  return crypto.createHash('md5').update(signStr).digest('hex');
}

function buildRequestBody(method, params) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyJson = JSON.stringify(params);
  const sign = generateSign(bodyJson, timestamp);

  return {
    appid: appKey,
    timestamp,
    sign,
    method,
    body: params
  };
}

async function fetchOrders() {
  const requestBody = buildRequestBody('open.order.list', {
    page_size: 50,
    page_no: 1
  });

  const response = await axios.post(`${baseUrl}/api/open/order/list`, requestBody, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}
```

### Python

```python
import hashlib
import http.client
import json
import time

appKey = '1500256339739973'
appSecret = 'ggEj73NV7fJfpwPQxDtFiyGIPkyHuxFH'
domain = 'https://open.goofish.pro'

def request(url: str, data: dict):
    body = json.dumps(data, separators=(",", ":"))
    timestamp = int(time.time())
    sign = genSign(body, timestamp)
    url = f"{domain}{url}?appid={appKey}&timestamp={timestamp}&sign={sign}"
    headers = {"Content-Type": "application/json"}
    conn = http.client.HTTPSConnection("api.goofish.pro")
    conn.request("POST", url, body, headers)
    res = conn.getresponse()
    return res.read().decode("utf-8")

def genSign(bodyJson: str, timestamp: int):
    m = hashlib.md5()
    m.update(bodyJson.encode("utf8"))
    bodyMd5 = m.hexdigest()
    s = f"{appKey},{bodyMd5},{timestamp},{appSecret}"
    m = hashlib.md5()
    m.update(s.encode("utf8"))
    return m.hexdigest()

resp = request("/api/open/order/list", {"page_size": 50, "page_no": 1})
print(resp)
```

## 服务封装

项目中使用 `xianGuanService.js` 封装所有API调用：

```javascript
import {
  fetchXianGuanShops,
  fetchXianGuanOrders,
  fetchXianGuanOrderDetail,
  transformOrder,
  transformOrderDetail
} from './services/xianGuanService.js';
```

## API路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/xianguan/shops` | GET | 获取闲鱼管家店铺列表 |
| `/api/orders/from-system` | GET | 获取订单列表 |
| `/api/orders/from-system/:orderNo` | GET | 获取订单详情 |

## 订单状态枚举

| 值 | 说明 |
|----|------|
| 11 | 待付款 |
| 12 | 待发货 |
| 21 | 已发货 |
| 22 | 已完成 |
| 23 | 已退款 |
| 24 | 已关闭 |

## 退款状态枚举

| 值 | 说明 |
|----|------|
| 0 | 未申请退款 |
| 1 | 待商家处理 |
| 2 | 待买家退货 |
| 3 | 待商家收货 |
| 4 | 退款关闭 |
| 5 | 退款成功 |
| 6 | 已拒绝退款 |
| 8 | 待确认退货地址 |

## 订单类型枚举

| 值 | 说明 |
|----|------|
| 1 | 普通订单 |
| 2 | 分销订单 |
| 3 | 验货宝订单 |
| 4 | 拍卖订单 |
| 7 | 卡密订单 |
| 8 | 直充订单 |
| 9 | 严选订单 |
| 10 | 特卖订单 |
| 11 | 潮玩订单 |
| 12 | 捡漏订单 |
| 14 | 预售订单 |
| 15 | 拼团订单 |
| 24 | 跨境订单 |

---

*完整API文档请查看：`.trae/skills/商户号申诉-闲鱼管家API完整知识库/`*
