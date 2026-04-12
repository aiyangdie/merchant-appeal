import axios from 'axios';
import crypto from 'crypto';

export const XIANGUAN_BASE_URL = process.env.XIANGUAN_BASE_URL || 'https://open.goofish.pro';
export const XIANGUAN_APPID = process.env.XIANGUAN_APPID || '';
export const XIANGUAN_APPSECRET = process.env.XIANGUAN_APPSECRET || '';

function generateSign(bodyJson, timestamp, appKey, appSecret) {
  const bodyMd5 = crypto.createHash('md5').update(bodyJson || '').digest('hex');
  const signStr = `${appKey},${bodyMd5},${timestamp},${appSecret}`;
  return crypto.createHash('md5').update(signStr).digest('hex');
}

function buildRequestUrl(method, params = {}, appId, appSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyJson = params && Object.keys(params).length > 0 ? JSON.stringify(params) : '';
  const sign = generateSign(bodyJson, timestamp, appId, appSecret);

  const queryParams = new URLSearchParams({
    appid: appId,
    timestamp: timestamp.toString(),
    sign: sign
  });

  return {
    url: `${XIANGUAN_BASE_URL}/api/open/${method}?${queryParams.toString()}`,
    body: params && Object.keys(params).length > 0 ? params : undefined
  };
}

export async function fetchXianGuanShops() {
  if (!XIANGUAN_APPID || !XIANGUAN_APPSECRET) {
    throw new Error('闲鱼管家API未配置，请设置 XIANGUAN_APPID 和 XIANGUAN_APPSECRET');
  }

  const { url, body } = buildRequestUrl('user/authorize/list', {}, XIANGUAN_APPID, XIANGUAN_APPSECRET);

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

export async function fetchXianGuanOrders(params = {}) {
  if (!XIANGUAN_APPID || !XIANGUAN_APPSECRET) {
    throw new Error('闲鱼管家API未配置，请设置 XIANGUAN_APPID 和 XIANGUAN_APPSECRET');
  }

  const requestParams = {
    page_size: params.page_size || 50,
    page_no: params.page_no || 1
  };

  if (params.order_status) {
    requestParams.order_status = params.order_status;
  }

  const { url, body } = buildRequestUrl('order/list', requestParams, XIANGUAN_APPID, XIANGUAN_APPSECRET);

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

export async function fetchXianGuanOrderDetail(orderNo) {
  if (!XIANGUAN_APPID || !XIANGUAN_APPSECRET) {
    throw new Error('闲鱼管家API未配置，请设置 XIANGUAN_APPID 和 XIANGUAN_APPSECRET');
  }

  if (!orderNo) {
    throw new Error('订单号不能为空');
  }

  const { url, body } = buildRequestUrl('order/detail', { order_no: orderNo }, XIANGUAN_APPID, XIANGUAN_APPSECRET);

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

export async function fetchXianGuanOrderKamList(orderNo) {
  if (!XIANGUAN_APPID || !XIANGUAN_APPSECRET) {
    throw new Error('闲鱼管家API未配置，请设置 XIANGUAN_APPID 和 XIANGUAN_APPSECRET');
  }

  if (!orderNo) {
    throw new Error('订单号不能为空');
  }

  const { url, body } = buildRequestUrl('order/kam/list', { order_no: orderNo }, XIANGUAN_APPID, XIANGUAN_APPSECRET);

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

export async function fetchExpressCompanies() {
  if (!XIANGUAN_APPID || !XIANGUAN_APPSECRET) {
    throw new Error('闲鱼管家API未配置，请设置 XIANGUAN_APPID 和 XIANGUAN_APPSECRET');
  }

  const { url, body } = buildRequestUrl('express/companies', {}, XIANGUAN_APPID, XIANGUAN_APPSECRET);

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

export async function shipOrder(params) {
  if (!XIANGUAN_APPID || !XIANGUAN_APPSECRET) {
    throw new Error('闲鱼管家API未配置，请设置 XIANGUAN_APPID 和 XIANGUAN_APPSECRET');
  }

  const { url, body } = buildRequestUrl('order/ship', {
    order_no: params.order_no,
    consign_type: params.consign_type || 1,
    express_company: params.express_company || '',
    express_no: params.express_no || ''
  }, XIANGUAN_APPID, XIANGUAN_APPSECRET);

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

export async function modifyOrderPrice(params) {
  if (!XIANGUAN_APPID || !XIANGUAN_APPSECRET) {
    throw new Error('闲鱼管家API未配置，请设置 XIANGUAN_APPID 和 XIANGUAN_APPSECRET');
  }

  const { url, body } = buildRequestUrl('order/modify/price', {
    order_no: params.order_no,
    express_fee: params.express_fee || 0,
    order_price: params.order_price
  }, XIANGUAN_APPID, XIANGUAN_APPSECRET);

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

export const ORDER_STATUS_MAP = {
  11: '待付款',
  12: '待发货',
  21: '已发货',
  22: '已完成',
  23: '已退款/已关闭',
  24: '已关闭'
};

export const REFUND_STATUS_MAP = {
  0: '未申请退款',
  1: '待商家处理',
  2: '待买家退货',
  3: '待商家收货',
  4: '退款关闭',
  5: '退款成功',
  6: '已拒绝退款',
  8: '待确认退货地址'
};

export const ORDER_TYPE_MAP = {
  1: '普通订单',
  2: '分销订单',
  3: '验货宝订单',
  4: '拍卖订单',
  7: '卡密订单',
  8: '直充订单',
  9: '严选订单',
  10: '特卖订单',
  11: '潮玩订单',
  12: '捡漏订单',
  14: '预售订单',
  15: '拼团订单',
  24: '跨境订单'
};

export const IDLE_BIZ_TYPE_MAP = {
  0: '普通商品',
  2: '普通商品',
  10: '验货宝',
  16: '品牌授权',
  19: '闲鱼严选',
  20: '普通商品',
  24: '闲鱼特卖',
  26: '品牌捡漏',
  35: '跨境商品'
};

export const PIN_GROUP_STATUS_MAP = {
  0: '非拼团',
  1: '拼团中',
  2: '拼团成功'
};

function convertTimestamp(timestamp) {
  if (!timestamp || timestamp === 0) return null;
  if (timestamp > 10000000000) {
    return new Date(timestamp);
  }
  return new Date(timestamp * 1000);
}

function formatDate(timestamp) {
  const date = convertTimestamp(timestamp);
  if (!date) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateOnly(timestamp) {
  const date = convertTimestamp(timestamp);
  if (!date) return '';
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function transformOrder(rawOrder) {
  if (!rawOrder) return null;

  let goodsItem = rawOrder.goods || {};
  let goodsImages = [];
  if (goodsItem.images && Array.isArray(goodsItem.images)) {
    goodsImages = goodsItem.images;
  }

  return {
    order_no: rawOrder.order_no,
    order_status: rawOrder.order_status,
    order_status_text: ORDER_STATUS_MAP[rawOrder.order_status] || '未知状态',
    order_type: rawOrder.order_type,
    order_type_text: ORDER_TYPE_MAP[rawOrder.order_type] || '未知类型',
    order_time: rawOrder.order_time,
    order_time_str: formatDate(rawOrder.order_time),
    order_time_date: formatDateOnly(rawOrder.order_time),
    confirm_time: rawOrder.confirm_time,
    confirm_time_str: formatDate(rawOrder.confirm_time),
    modify_time: rawOrder.modify_time,
    modify_time_str: formatDate(rawOrder.modify_time),
    pay_time: rawOrder.pay_time,
    pay_time_str: formatDate(rawOrder.pay_time),
    refund_time: rawOrder.refund_time,
    refund_time_str: formatDate(rawOrder.refund_time),
    consign_time: rawOrder.consign_time,
    consign_time_str: formatDate(rawOrder.consign_time),
    create_time: rawOrder.create_time,
    create_time_str: formatDate(rawOrder.create_time),
    update_time: rawOrder.update_time,
    update_time_str: formatDate(rawOrder.update_time),
    total_amount: rawOrder.total_amount,
    pay_amount: rawOrder.pay_amount,
    express_fee: rawOrder.express_fee,
    discount_amount: rawOrder.discount_amount,
    refund_amount: rawOrder.refund_amount,
    pay_no: rawOrder.pay_no,
    refund_status: rawOrder.refund_status,
    refund_status_text: REFUND_STATUS_MAP[rawOrder.refund_status] || '未知状态',
    receiver_name: rawOrder.receiver_name,
    receiver_mobile: rawOrder.receiver_mobile,
    receiver_phone: rawOrder.receiver_phone,
    receiver_state: rawOrder.prov_name,
    receiver_city: rawOrder.city_name,
    receiver_district: rawOrder.area_name,
    receiver_town: rawOrder.town_name,
    receiver_address: rawOrder.address,
    full_address: [rawOrder.prov_name, rawOrder.city_name, rawOrder.area_name, rawOrder.town_name, rawOrder.address].filter(Boolean).join(''),
    buyer_eid: rawOrder.buyer_eid,
    buyer_nick: rawOrder.buyer_nick,
    seller_eid: rawOrder.seller_eid,
    seller_name: rawOrder.seller_name,
    seller_remark: rawOrder.seller_remark,
    waybill_no: rawOrder.waybill_no,
    express_code: rawOrder.express_code,
    express_name: rawOrder.express_name,
    consign_type: rawOrder.consign_type,
    cancel_reason: rawOrder.cancel_reason,
    cancel_time: rawOrder.cancel_time,
    cancel_time_str: formatDate(rawOrder.cancel_time),
    idle_biz_type: rawOrder.idle_biz_type,
    idle_biz_type_text: IDLE_BIZ_TYPE_MAP[rawOrder.idle_biz_type] || '普通商品',
    pin_group_status: rawOrder.pin_group_status,
    pin_group_status_text: PIN_GROUP_STATUS_MAP[rawOrder.pin_group_status] || '',
    xyb_seller_amount: rawOrder.xyb_seller_amount,
    is_tax_included: rawOrder.is_tax_included,
    goods: {
      title: goodsItem.title || '',
      quantity: goodsItem.quantity || 1,
      price: goodsItem.price || 0,
      images: goodsImages,
      first_image: goodsImages.length > 0 ? goodsImages[0] : null,
      sku_id: goodsItem.sku_id,
      sku_text: goodsItem.sku_text,
      sku_outer_id: goodsItem.sku_outer_id,
      outer_id: goodsItem.outer_id,
      product_id: goodsItem.product_id,
      item_id: goodsItem.item_id,
      service_support: goodsItem.service_support
    }
  };
}

export function transformOrderDetail(rawDetail) {
  if (!rawDetail) return null;

  return {
    ...transformOrder(rawDetail),
    consign_type: rawDetail.consign_type,
    express_company: rawDetail.express_company,
    express_no: rawDetail.express_no,
    ship_time: rawDetail.ship_time,
    ship_time_str: formatDate(rawDetail.ship_time),
    buyer_message: rawDetail.buyer_message,
    seller_memo: rawDetail.seller_memo,
    item_id: rawDetail.item_id,
    alipay_no: rawDetail.alipay_no
  };
}

export async function testConnection() {
  try {
    const result = await fetchXianGuanShops();
    return {
      success: result.code === 0,
      message: result.msg || (result.code === 0 ? '连接成功' : '连接失败'),
      data: result.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      data: null
    };
  }
}

export function formatOrderAmount(order) {
  const amount = order.pay_amount || order.total_amount || 0;
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万';
  }
  return (amount / 100).toFixed(2);
}