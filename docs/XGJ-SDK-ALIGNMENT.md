# 闲管家（XGJ）官方 Python SDK 与 merchant-appeal 对齐说明

> 对照来源：`/root/xgj-sdk-python-20260424`（解压日期 2026-04-24）  
> 项目实现：`server/xianyu-api.js`  
> 网关：`https://open.goofish.pro`（SDK `XgjSdkClient.gateway_url` 与项目 `XIANYU_API_BASE_URL` 默认一致）

---

## 1. 官方 SDK 全部 `api_path`（`get_api_path()`）

| SDK 请求类 | 官方路径 |
|------------|----------|
| `ApiOpenExpressCompaniesRequest` | `/api/open/express/companies` |
| `ApiOpenOrderCancelRequest` | `/api/open/order/cancel` |
| `ApiOpenOrderDetailRequest` | `/api/open/order/detail` |
| `ApiOpenOrderListRequest` | `/api/open/order/list` |
| `ApiOpenOrderModifyPriceRequest` | `/api/open/order/modify/price` |
| `ApiOpenOrderShipRequest` | `/api/open/order/ship` |
| `ApiOpenProductBatchCreateRequest` | `/api/open/product/batchCreate` |
| `ApiOpenProductCategoryListRequest` | `/api/open/product/category/list` |
| `ApiOpenProductCreateRequest` | `/api/open/product/create` |
| `ApiOpenProductDeleteRequest` | `/api/open/product/delete` |
| `ApiOpenProductDetailRequest` | `/api/open/product/detail` |
| `ApiOpenProductDownShelfRequest` | `/api/open/product/downShelf` |
| `ApiOpenProductEditRequest` | `/api/open/product/edit` |
| `ApiOpenProductEditStockRequest` | `/api/open/product/edit/stock` |
| `ApiOpenProductListRequest` | `/api/open/product/list` |
| `ApiOpenProductPublishRequest` | `/api/open/product/publish` |
| `ApiOpenProductPvListRequest` | `/api/open/product/pv/list` |
| `ApiOpenProductSkuListRequest` | `/api/open/product/sku/list` |
| `ApiOpenUserAuthorizeListRequest` | `/api/open/user/authorize/list` |

共 **19** 个官方开放接口（SDK 包内 `xgj/request/api_*.py`）。

---

## 2. 签名算法（`xgj/client.py`）

### 2.1 Body 序列化

- `get_json_body(body)` → `json.dumps(body, ensure_ascii=False, separators=(',', ':'))`，空 body 为 `'{}'`。

### 2.2 Query 参数

- `appid` = `app_key`
- `timestamp` = Unix 秒
- 若 `seller_id > 0`：追加 `seller_id`
- `sign` = 见下

### 2.3 签名字符串

1. `body_md5 = md5(utf8(json_body)).hexdigest()`
2. 无 `seller_id`：`sign_string = "{app_key},{body_md5},{timestamp},{app_secret}"`
3. 有 `seller_id`：`sign_string = "{app_key},{body_md5},{timestamp},{seller_id},{app_secret}"`
4. `sign = md5(sign_string).hexdigest()`

### 2.4 与 `xianyu-api.js` 对比

| 项 | 官方 SDK | merchant-appeal |
|----|----------|-------------------|
| Body MD5 | 是 | 是 |
| 4 段签名 | `appKey,bodyMd5,timestamp,appSecret` | **相同**（`generateSign4Param`） |
| 5 段签名 | `appKey,bodyMd5,timestamp,seller_id,appSecret` | **已实现**（有 `shopId` 时） |
| 6 段签名 | 无 | `appId,appSecret,bodyMd5,timestamp,mchId,mchSecret`（Apifox 文档路径，**非 SDK**） |
| Query `seller_id` | 可选 | 未传 |
| JSON 紧凑格式 | `separators=(',', ':')` | `JSON.stringify(body)`（默认带空格，**可能影响 sign**） |

---

## 3. 路径对照：SDK vs `xianyu-api.js`

| 能力 | 官方 SDK 路径 | `xianyu-api.js` 路径 | 对齐状态 |
|------|---------------|----------------------|----------|
| 订单列表 | `/api/open/order/list` | `/api/open/order/list` | 路径一致 |
| 订单详情 | `/api/open/order/detail` | `/api/open/order/detail` | 路径一致 |
| 订单发货 | `/api/open/order/ship` | `/api/open/order/ship` | 路径一致 |
| 订单改价 | `/api/open/order/modify/price` | `/api/open/order/update_price` | **路径不一致** |
| 订单取消 | `/api/open/order/cancel` | （未封装） | 项目缺失 |
| 卡密/虚拟卡 | （SDK 无） | `/api/open/order/cards` | 仅项目有 |
| 下单 | （SDK 无） | `/api/open/order/place` | 仅项目有 |
| 商品列表 | `/api/open/product/list` | `/api/open/product/list` | 路径一致 |
| 商品详情 | `/api/open/product/detail` | `/api/open/product/detail` | 路径一致 |
| SKU 列表 | `/api/open/product/sku/list` | `/api/open/product/skus` | **路径不一致** |
| 创建商品 | `/api/open/product/create` | `/api/open/product/create` | 路径一致 |
| 批量创建 | `/api/open/product/batchCreate` | `/api/open/product/create_batch` | **路径不一致** |
| 上架 | `/api/open/product/publish` | `/api/open/product/publish` | 路径一致 |
| 下架 | `/api/open/product/downShelf` | `/api/open/product/downShelf` | 路径一致 |
| 编辑商品 | `/api/open/product/edit` | `/api/open/product/update` | **路径不一致** |
| 改库存 | `/api/open/product/edit/stock` | `/api/open/product/update_stock` | **路径不一致** |
| 删除商品 | `/api/open/product/delete` | `/api/open/product/delete` | 路径一致 |
| 类目列表 | `/api/open/product/category/list` | `/api/open/product/categories` | **路径不一致** |
| 类目 PV | `/api/open/product/pv/list` | `/api/open/product/attributes` | **路径不一致** |
| 授权店铺列表 | `/api/open/user/authorize/list` | `/api/open/user/authorize/list` | 路径一致 |
| 快递公司 | `/api/open/express/companies` | `/api/open/logistics/companies` | **路径不一致** |
| 商户余额 | （SDK 无） | `/api/open/mch/balance` | 仅项目有 |

---

## 4. 请求体字段对照（按接口）

说明：**SDK 列**为 `get_body_params()` 写入 JSON 的键；**项目列**为 `xianyu-api.js` 实际发送键。测试示例见 `test/test_order.py`、`test/test_product.py`。

### 4.1 订单

| 接口 | SDK 字段 | 项目字段 | 差异说明 |
|------|----------|----------|----------|
| list | `order_status`, `create_time[]`, `page_no`, `page_size` | `pageNum`, `pageSize`, `shopId`, `status` / `orderStatus`, `startTime`/`endTime`, `refundStatus` | 分页：**page_no/page_size** vs **pageNum/pageSize**；状态：**order_status** vs **status/orderStatus**；时间：**create_time** 数组 vs **startTime/endTime** |
| detail | `order_no` | `order_no`, `shopId` | 订单号一致；项目多 `shopId` |
| ship | `order_no`, `waybill_no`, `express_code`, `express_name`, `ship_name`, `ship_mobile`, `ship_district_id`, `ship_prov_name`, `ship_city_name`, `ship_area_name`, `ship_address` | `order_id`, `express_no`, `express_company`, `shopId` | **order_no vs order_id**；**waybill_no vs express_no**；**express_code/name vs express_company**；SDK 含完整发货地址字段，项目未传 |
| modify price | `order_no`, `order_price`, `express_fee` | `order_id`, `price` | 路径不同；**order_no vs order_id**；**order_price+express_fee** vs 单一 **price** |
| cancel | `order_no`, `cancel_reason` | — | 项目未实现 |

**测试示例（订单）**

- list：`page_no=1`, `page_size=50`
- detail：`order_no='2701764156047004591'`
- ship：`order_no`, `waybill_no`, `express_code`, `express_name`, `ship_name`, `ship_mobile`, `ship_district_id`, `ship_address`
- cancel：`order_no`, `cancel_reason`
- modify price：`order_no`, `order_price=99900`, `express_fee=1000`（单位：分）

### 4.2 商品

| 接口 | SDK 字段 | 项目字段 | 差异说明 |
|------|----------|----------|----------|
| list | `online_time`, `offline_time`, `sold_time`, `update_time`, `create_time`, `product_status`, `sale_status`, `page_no`, `page_size` | `pageNum`, `pageSize`, `shopId`, `productStatus`, `saleStatus`, `keyword` | 分页命名不同；项目多 **keyword**；SDK 用时间范围数组 |
| detail | `product_id` | `product_id`, `shopId` | 一致（项目多 shopId） |
| sku list | `product_id`（**数组**） | `product_id`（单值） | 路径 **sku/list** vs **skus**；SDK 支持批量 ID |
| create | `item_biz_type`, `sp_biz_type`, `channel_cat_id`, `channel_pv`, `price`, `original_price`, `express_fee`, `stock`, `outer_id`, `stuff_status`, `publish_shop`, `sku_items`, 及扩展 `book_data` 等 | 透传 `productData`（含 `title`, `images`, `price` 等） | 项目偏简化 DTO，与 SDK 完整商品模型不一致 |
| batch create | `product_data[]`（`ProductData`） | `products[]` | 键名 **product_data** vs **products**；路径 **batchCreate** vs **create_batch** |
| publish | `product_id`, `user_name[]`, `specify_publish_time`, `notify_url` | `product_id`, `user_name[]`, `shopId` | SDK 多 **notify_url**、**specify_publish_time** |
| down shelf | `product_id` | `product_id`, `user_name[]`, `shopId` | SDK 测试仅 `product_id` |
| edit | `product_id` + 与 create 类似字段 + `notify_url` | `product_id` + spread `data` | 路径 **edit** vs **update** |
| edit stock | `product_id`, `price`, `original_price`, `stock`, `sku_items` | `product_id`, `stock`, `sku_id` | 路径不同；SDK 用 **sku_items** 列表 |
| delete | `product_id` | `product_id` | 一致 |
| category list | `item_biz_type`, `sp_biz_type`, `flash_sale_type` | `{}` 或项目未传 | 路径 **category/list** vs **categories** |
| pv list | `item_biz_type`, `sp_biz_type`, `channel_cat_id`, `sub_property_id` | `category_id`（attributes 接口） | 完全不同路径与参数模型 |

**测试示例（商品）**

- category list：`item_biz_type=2`, `sp_biz_type=1`
- pv list：`item_biz_type`, `sp_biz_type`, `channel_cat_id`
- list：`update_time=[t0,t1]`, `product_status=22`, `sale_status=3`, `page_no`, `page_size`
- publish：`product_id`, `user_name=['tb924343042']`, `notify_url`
- create：`channel_cat_id`, `channel_pv[]`, `publish_shop[]`, `price`, `stock`, `outer_id`, `stuff_status`, `express_fee`
- batch：`product_data=[{item_key, item_biz_type, sp_biz_type, price, stock, channel_cat_id, outer_id, ...}]`

### 4.3 其他

| 接口 | SDK 字段 | 项目字段 |
|------|----------|----------|
| user authorize list | （空 body） | `pageNum`, `pageSize` |
| express companies | （空 body） | （空 body），路径为 logistics/companies |

---

## 5. 响应字段映射（项目侧）

`xianyu-api.js` 在 `mapOrderFields` / `mapProductFields` 中读取官方返回的 **snake_case**（如 `order_no`, `order_status`, `product_id`），与 SDK 请求字段命名一致；问题主要集中在 **请求路径** 与 **请求体键名**。

---

## 6. 对齐状态（2026-05-19 已落地）

`server/xianyu-api.js` 已按本 SDK 调整：

| 项 | 状态 |
|----|------|
| 签名紧凑 JSON + 4/5 段签名 | 已对齐；`XIANYU_USE_MCH_SIGN=1` 时仍可用 6 段 |
| 订单 `page_no` / `order_status` / `create_time` | 已对齐 |
| 发货 `order_no` + `waybill_no` + `express_code/name` | 已对齐 |
| 改价 `/order/modify/price` + `order_price`/`express_fee` | 已对齐 |
| 取消订单 `/order/cancel` | 已新增 |
| 商品路径 `edit`、`edit/stock`、`sku/list`、`batchCreate` | 已对齐 |
| 类目 `category/list`、PV `pv/list`、快递 `express/companies` | 已对齐 |
| 前端 `fmtTime` 秒级时间戳 | 已修复 |
| 扩展接口 `cards` / `place` / `mch/balance` | 保留，卡密失败时回退 `order_id` |

部署后请在管理后台配置闲管家 AppKey/AppSecret，并确认服务器 IP 在闲管家白名单内。

---

## 7. 管理后台入口与看板 API（2026-05-19）

| 功能 | 入口 | 后端 |
|------|------|------|
| 闲鱼数据看板 | 侧栏 **闲鱼运营** → **数据看板** | `GET /api/admin/xianyu-dashboard` |
| 闲鱼订单 | 闲鱼运营 → **闲鱼订单** | `GET /api/admin/xianyu-orders` |
| 闲鱼商品 | 闲鱼运营 → **闲鱼商品** | `GET /api/xianyu/products` 等 |
| AI 申诉订单 | 侧栏 **订单管理** | 本系统订单 API |

看板聚合逻辑：`server/xianyu-dashboard.js`（默认最多 10 页 × 100 条订单样本，可用 `XIANYU_DASHBOARD_MAX_PAGES` 调整）。AI 运营日报优先调用 `chatWithAI`，失败时回退规则模板。

部署前端：`npm run build` 后 `pm2 restart merchant-appeal`，浏览器硬刷新。

---

## 8. 参考文件

- SDK：`xgj/client.py`，`xgj/request/api_*.py`  
- 测试：`test/test_order.py`，`test/test_product.py`，`test/test_other.py`  
- 项目：`server/xianyu-api.js`，`server/xianyu-dashboard.js`  

