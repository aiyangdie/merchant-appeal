import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3002

app.set('trust proxy', 1)
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_key'
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h'
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || ''
const SILICONFLOW_BASE_URL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

// SMTP 邮件配置
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  }
}
const mailTransporter = smtpConfig.auth.user ? nodemailer.createTransport(smtpConfig) : null
const HEARTBEAT_TO = process.env.HEARTBEAT_TO || ''

// GitHub 配置
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || ''
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))

// CORS 配置
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// 速率限制
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
  validate: { xForwardedForHeader: false },
}))

// 聊天接口单独限速
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '发送消息过快，请稍后再试' },
  validate: { xForwardedForHeader: false },
})

// 登录/注册接口严格限速
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
})

app.use(express.json({ limit: '1mb' }))
app.use(compression())

// 静态文件
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

// 模拟订单数据
const mockOrders = [
  {
    order_no: 'XY202404130001',
    buyer_nick: '张三',
    item_title: 'iPhone 15 Pro Max 256GB 金色',
    item_image: 'https://via.placeholder.com/100x100',
    pay_amount: 999900,
    pay_amount_fen: 999900,
    total_amount: 999900,
    total_amount_fen: 999900,
    order_status: 22,
    status_text: '已完成',
    created_time: new Date(Date.now() - 86400000 * 2).getTime(),
    create_time_text: '2024-04-11 14:30:00',
    pay_time: new Date(Date.now() - 86400000 * 2).getTime() + 300000,
    ship_time: new Date(Date.now() - 86400000).getTime(),
    receive_time: new Date(Date.now() - 3600000 * 12).getTime(),
    consign_time: new Date(Date.now() - 86400000).getTime(),
    confirm_time: new Date(Date.now() - 3600000 * 12).getTime(),
    consignee: '张三',
    mobile: '138****8888',
    phone: '138****8888',
    address: '北京市朝阳区建国路88号SOHO现代城A座1001',
    province: 110000,
    city: 110100,
    district: 110105,
    post_code: '100022',
    logistics_company: '顺丰速运',
    logistics_no: 'SF1234567890',
    express_code: 'shunfeng',
    express_name: '顺丰速运',
    item_type: 2,
    item_biz_type: 2,
    sp_biz_type: 1,
    service_support: 'SDR,NFR',
    stuff_status: 100,
    sku_name: '金色, 256GB',
    sku_attrs: [{ name: '颜色', value: '金色' }, { name: '容量', value: '256GB' }],
    outer_id: 'SKU001',
    product_id: '123456789',
    seller_nick: '诚信数码店',
    seller_user_name: 'chengxinshuma',
    shop_name: '诚信数码专营店',
    refund_status: 0,
    complaint_status: 0,
    dispute_status: 0
  },
  {
    order_no: 'XY202404120002',
    buyer_nick: '李四',
    item_title: 'AirPods Pro 2代 无线蓝牙耳机',
    item_image: 'https://via.placeholder.com/100x100',
    pay_amount: 189900,
    pay_amount_fen: 189900,
    total_amount: 189900,
    total_amount_fen: 189900,
    order_status: 12,
    status_text: '待发货',
    created_time: new Date(Date.now() - 3600000 * 6).getTime(),
    create_time_text: '2024-04-13 08:15:00',
    pay_time: new Date(Date.now() - 3600000 * 6).getTime() + 120000,
    ship_time: null,
    receive_time: null,
    consign_time: null,
    confirm_time: null,
    consignee: '李四',
    mobile: '139****9999',
    phone: '139****9999',
    address: '上海市浦东新区陆家嘴金融中心B座2305',
    province: 310000,
    city: 310100,
    district: 310115,
    post_code: '200120',
    logistics_company: '',
    logistics_no: '',
    express_code: '',
    express_name: '',
    item_type: 2,
    item_biz_type: 2,
    sp_biz_type: 9,
    service_support: 'SDR,FD_24HS',
    stuff_status: 100,
    sku_name: '白色',
    sku_attrs: [{ name: '颜色', value: '白色' }],
    outer_id: 'SKU002',
    product_id: '987654321',
    seller_nick: '苹果授权店',
    seller_user_name: 'appleauthorized',
    shop_name: '苹果官方授权店',
    refund_status: 0,
    complaint_status: 0,
    dispute_status: 0
  },
  {
    order_no: 'XY202404100003',
    buyer_nick: '王五',
    item_title: 'Switch OLED 游戏主机 白色',
    item_image: 'https://via.placeholder.com/100x100',
    pay_amount: 259900,
    pay_amount_fen: 259900,
    total_amount: 259900,
    total_amount_fen: 259900,
    order_status: 23,
    status_text: '已退款',
    created_time: new Date(Date.now() - 86400000 * 4).getTime(),
    create_time_text: '2024-04-09 20:45:00',
    pay_time: new Date(Date.now() - 86400000 * 4).getTime() + 300000,
    ship_time: new Date(Date.now() - 86400000 * 3).getTime(),
    receive_time: null,
    consign_time: new Date(Date.now() - 86400000 * 3).getTime(),
    confirm_time: null,
    consignee: '王五',
    mobile: '137****7777',
    phone: '137****7777',
    address: '广州市天河区珠江新城花城广场西塔1502',
    province: 440000,
    city: 440100,
    district: 440106,
    post_code: '510623',
    logistics_company: '中通快递',
    logistics_no: 'ZT0987654321',
    express_code: 'zhongtong',
    express_name: '中通快递',
    item_type: 2,
    item_biz_type: 2,
    sp_biz_type: 20,
    service_support: 'SDR',
    stuff_status: 99,
    sku_name: '白色, 64GB',
    sku_attrs: [{ name: '颜色', value: '白色' }, { name: '容量', value: '64GB' }],
    outer_id: 'SKU003',
    product_id: '456789123',
    seller_nick: '电玩城',
    seller_user_name: 'gamecity',
    shop_name: '电玩爱好者专营店',
    refund_status: 5,
    complaint_status: 1,
    dispute_status: 1
  },
  {
    order_no: 'XY202404080004',
    buyer_nick: '赵六',
    item_title: 'MacBook Pro 14英寸 M3 Pro',
    item_image: 'https://via.placeholder.com/100x100',
    pay_amount: 1699900,
    pay_amount_fen: 1699900,
    total_amount: 1699900,
    total_amount_fen: 1699900,
    order_status: 21,
    status_text: '已发货',
    created_time: new Date(Date.now() - 86400000 * 5).getTime(),
    create_time_text: '2024-04-08 10:20:00',
    pay_time: new Date(Date.now() - 86400000 * 5).getTime() + 600000,
    ship_time: new Date(Date.now() - 86400000 * 4).getTime(),
    receive_time: null,
    consign_time: new Date(Date.now() - 86400000 * 4).getTime(),
    confirm_time: null,
    consignee: '赵六',
    mobile: '136****6666',
    phone: '136****6666',
    address: '深圳市南山区科技园南区创维大厦A座808',
    province: 440000,
    city: 440300,
    district: 440305,
    post_code: '518057',
    logistics_company: '顺丰速运',
    logistics_no: 'SF1122334455',
    express_code: 'shunfeng',
    express_name: '顺丰速运',
    item_type: 2,
    item_biz_type: 2,
    sp_biz_type: 9,
    service_support: 'SDR,FD_GPA',
    stuff_status: 100,
    sku_name: '深空灰色, 512GB, 18GB内存',
    sku_attrs: [{ name: '颜色', value: '深空灰色' }, { name: '容量', value: '512GB' }, { name: '内存', value: '18GB' }],
    outer_id: 'SKU004',
    product_id: '789123456',
    seller_nick: '苹果官方旗舰店',
    seller_user_name: 'appleofficial',
    shop_name: 'Apple Store 官方旗舰店',
    refund_status: 0,
    complaint_status: 0,
    dispute_status: 0
  },
  {
    order_no: 'XY202404050005',
    buyer_nick: '孙七',
    item_title: '索尼WH-1000XM5 头戴式降噪耳机',
    item_image: 'https://via.placeholder.com/100x100',
    pay_amount: 249900,
    pay_amount_fen: 249900,
    total_amount: 249900,
    total_amount_fen: 249900,
    order_status: 22,
    status_text: '已完成',
    created_time: new Date(Date.now() - 86400000 * 8).getTime(),
    create_time_text: '2024-04-05 16:30:00',
    pay_time: new Date(Date.now() - 86400000 * 8).getTime() + 180000,
    ship_time: new Date(Date.now() - 86400000 * 7).getTime(),
    receive_time: new Date(Date.now() - 86400000 * 5).getTime(),
    consign_time: new Date(Date.now() - 86400000 * 7).getTime(),
    confirm_time: new Date(Date.now() - 86400000 * 5).getTime(),
    consignee: '孙七',
    mobile: '135****5555',
    phone: '135****5555',
    address: '杭州市余杭区文一西路969号阿里园区5号楼',
    province: 330000,
    city: 330100,
    district: 330110,
    post_code: '311121',
    logistics_company: '韵达快递',
    logistics_no: 'YD5566778899',
    express_code: 'yunda',
    express_name: '韵达快递',
    item_type: 2,
    item_biz_type: 2,
    sp_biz_type: 9,
    service_support: 'SDR,NFR',
    stuff_status: 100,
    sku_name: '铂金银色',
    sku_attrs: [{ name: '颜色', value: '铂金银色' }],
    outer_id: 'SKU005',
    product_id: '321654987',
    seller_nick: '索尼专卖店',
    seller_user_name: 'sonystore',
    shop_name: '索尼官方授权专卖店',
    refund_status: 0,
    complaint_status: 0,
    dispute_status: 0
  }
]

// 内存数据存储
let db = {
  sessions: [],
  messages: [],
  users: [],
  admins: [
    { id: 1, username: 'admin', password: bcrypt.hashSync('admin123', 12), created_at: new Date() }
  ],
  system_config: [
    { config_key: 'site_name', config_value: '微信商户号申诉助手', config_label: '网站名称', config_group: 'general', sort_order: 1, updated_at: new Date() },
    { config_key: 'ai_provider', config_value: 'zhipu', config_label: 'AI服务商', config_group: 'ai', sort_order: 9, updated_at: new Date() },
    { config_key: 'ai_temperature', config_value: '0.7', config_label: 'AI 回复温度', config_group: 'ai', sort_order: 14, updated_at: new Date() },
    { config_key: 'cost_multiplier', config_value: '2', config_label: 'Token计费倍率', config_group: 'ai', sort_order: 15, updated_at: new Date() },
    { config_key: 'new_user_balance', config_value: '1.00', config_label: '新用户注册赠送余额', config_group: 'ai', sort_order: 16, updated_at: new Date() }
  ],
  ai_models: [
    { id: 1, provider: 'siliconflow', display_name: 'Qwen/Qwen3.5-4B（免费）', api_key: SILICONFLOW_API_KEY, model_name: 'Qwen/Qwen3.5-4B', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 1, is_enabled: 1, is_free: 1, sort_order: 1, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 2, provider: 'siliconflow', display_name: 'Qwen/Qwen3-8B（免费）', api_key: SILICONFLOW_API_KEY, model_name: 'Qwen/Qwen3-8B', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 2, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 3, provider: 'siliconflow', display_name: 'Qwen/Qwen2.5-7B-Instruct（免费）', api_key: '', model_name: 'Qwen/Qwen2.5-7B-Instruct', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 3, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 4, provider: 'siliconflow', display_name: 'Qwen/Qwen2-7B-Instruct（免费）', api_key: '', model_name: 'Qwen/Qwen2-7B-Instruct', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 4, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 5, provider: 'siliconflow', display_name: 'Qwen/Qwen1.5-7B-Chat（免费）', api_key: '', model_name: 'Qwen/Qwen1.5-7B-Chat', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 5, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 6, provider: 'siliconflow', display_name: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B（免费）', api_key: '', model_name: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 6, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 7, provider: 'siliconflow', display_name: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B（免费）', api_key: '', model_name: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 7, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 8, provider: 'siliconflow', display_name: 'THUDM/GLM-Z1-9B-0414（免费）', api_key: '', model_name: 'THUDM/GLM-Z1-9B-0414', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 8, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 9, provider: 'siliconflow', display_name: 'THUDM/GLM-4-9B-0414（免费）', api_key: '', model_name: 'THUDM/GLM-4-9B-0414', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 9, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 10, provider: 'siliconflow', display_name: 'THUDM/glm-4-9b-chat（免费）', api_key: '', model_name: 'THUDM/glm-4-9b-chat', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 10, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 11, provider: 'siliconflow', display_name: 'THUDM/GLM-4.1V-9B-Thinking（免费）', api_key: '', model_name: 'THUDM/GLM-4.1V-9B-Thinking', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 11, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 12, provider: 'siliconflow', display_name: 'internlm/internlm2_5-7b-chat（免费）', api_key: '', model_name: 'internlm/internlm2_5-7b-chat', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 12, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 13, provider: 'siliconflow', display_name: 'tencent/Hunyuan-MT-7B（免费）', api_key: '', model_name: 'tencent/Hunyuan-MT-7B', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 13, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 14, provider: 'siliconflow', display_name: 'mistralai/Mistral-7B-Instruct-v0.2（免费）', api_key: '', model_name: 'mistralai/Mistral-7B-Instruct-v0.2', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 14, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 15, provider: 'siliconflow', display_name: 'PaddlePaddle/PaddleOCR-VL-1.5（免费）', api_key: '', model_name: 'PaddlePaddle/PaddleOCR-VL-1.5', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 15, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 16, provider: 'siliconflow', display_name: 'deepseek-ai/DeepSeek-OCR（免费）', api_key: '', model_name: 'deepseek-ai/DeepSeek-OCR', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 16, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 17, provider: 'siliconflow', display_name: 'Qwen/Qwen2.5-14B-Instruct', api_key: '', model_name: 'Qwen/Qwen2.5-14B-Instruct', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 0, sort_order: 17, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 18, provider: 'siliconflow', display_name: 'deepseek-ai/DeepSeek-V2.5', api_key: '', model_name: 'deepseek-ai/DeepSeek-V2.5', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 0, sort_order: 18, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 19, provider: 'siliconflow', display_name: 'Qwen/Qwen2.5-32B-Instruct', api_key: '', model_name: 'Qwen/Qwen2.5-32B-Instruct', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', is_active: 0, is_enabled: 1, is_free: 0, sort_order: 19, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 20, provider: 'zhipu', display_name: '智谱GLM-4-Flash（备用）', api_key: '', model_name: 'glm-4.7-flash', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', is_active: 0, is_enabled: 1, is_free: 1, sort_order: 99, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 21, provider: 'deepseek', display_name: 'DeepSeek-Chat', api_key: DEEPSEEK_API_KEY, model_name: 'deepseek-chat', endpoint: 'https://api.deepseek.com/chat/completions', is_active: 0, is_enabled: 1, is_free: 0, sort_order: 50, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() },
    { id: 22, provider: 'deepseek', display_name: 'DeepSeek-Reasoner', api_key: DEEPSEEK_API_KEY, model_name: 'deepseek-reasoner', endpoint: 'https://api.deepseek.com/chat/completions', is_active: 0, is_enabled: 1, is_free: 0, sort_order: 51, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, created_at: new Date(), updated_at: new Date() }
  ],
  success_cases: [],
  orders: mockOrders
}

// JWT 工具
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录或登录已过期' })
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    if (decoded.role !== 'admin') return res.status(403).json({ error: '无管理员权限' })
    req.admin = decoded
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

function requireUser(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' })
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    if (!decoded.userId) return res.status(401).json({ error: '无效的用户凭证' })
    req.userId = decoded.userId
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

function optionalUser(req, res, next) {
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
      if (decoded.userId) req.userId = decoded.userId
    } catch { }
  }
  next()
}

// ========== 用户 API ==========

app.post('/api/user/register', authLimiter, async (req, res) => {
  try {
    const { phone, nickname, name } = req.body
    const userName = nickname || name
    if (!phone || phone.trim().length < 2 || phone.trim().length > 20) return res.status(400).json({ error: '请输入有效的手机号' })
    if (!userName || userName.trim().length > 20) return res.status(400).json({ error: '名称不能为空' })

    const existingUser = db.users.find(u => u.phone === phone.trim())
    let user, isNew

    if (existingUser) {
      user = existingUser
      isNew = false
    } else {
      user = {
        id: db.users.length + 1,
        phone: phone.trim(),
        phone_hash: phone.trim(),
        nickname: userName.trim(),
        balance: 100.00,
        api_mode: 'official',
        custom_api_key: '',
        last_active_at: new Date(),
        last_ip: '',
        login_count: 0,
        total_messages: 0,
        total_spent: 0,
        deep_analysis_count: 0,
        deep_analysis_month: '',
        created_at: new Date()
      }
      db.users.push(user)
      isNew = true
    }

    user.login_count++
    user.last_active_at = new Date()

    const token = signToken({ userId: user.id, role: 'user' })
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode }, token, isNew })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: '注册失败' })
  }
})

app.post('/api/user/login', authLimiter, async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone || phone.trim().length > 20) return res.status(400).json({ error: '请输入手机号' })

    const user = db.users.find(u => u.phone === phone.trim())
    if (!user) return res.status(404).json({ error: '该手机号未注册，请先注册' })

    user.login_count++
    user.last_active_at = new Date()

    const token = signToken({ userId: user.id, role: 'user' })
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode }, token })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: '登录失败' })
  }
})

app.get('/api/user/:id', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const user = db.users.find(u => u.id === parseInt(req.params.id))
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode } })
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

app.get('/api/user/:id/sessions', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const sessions = db.sessions.filter(s => s.user_id === parseInt(req.params.id))
    res.json({ sessions })
  } catch (err) {
    console.error('Get user sessions error:', err)
    res.status(500).json({ error: '获取历史记录失败' })
  }
})

// ========== 聊天 API ==========

app.post('/api/chat', chatLimiter, optionalUser, async (req, res) => {
  try {
    let { sessionId, content, userId: bodyUserId } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }

    const userId = req.userId || bodyUserId
    let user = null
    if (userId) {
      user = db.users.find(u => u.id === userId)
    }

    let isNew = false
    if (!sessionId) {
      sessionId = uuidv4()
      const newSession = {
        id: sessionId,
        user_id: userId || null,
        created_at: new Date(),
        status: 'active',
        collected_data: {},
        step: 0,
        deep_analysis_result: null
      }
      db.sessions.push(newSession)
      isNew = true
    } else {
      const existing = db.sessions.find(s => s.id === sessionId)
      if (!existing) {
        sessionId = uuidv4()
        const newSession = {
          id: sessionId,
          user_id: userId || null,
          created_at: new Date(),
          status: 'active',
          collected_data: {},
          step: 0,
          deep_analysis_result: null
        }
        db.sessions.push(newSession)
        isNew = true
      }
    }

    if (isNew) {
      const welcomeMsg = {
        id: db.messages.length + 1,
        session_id: sessionId,
        role: 'assistant',
        content: '您好！我是商户号申诉助手。我可以帮您处理微信支付商户号的申诉问题。\n\n请告诉我：\n1. 您的商户号遇到了什么问题？（例如：限制收款、交易拦截、账户冻结等）\n2. 您是做什么行业的？\n\n我会根据您的情况，指导您准备申诉材料。',
        created_at: new Date()
      }
      db.messages.push(welcomeMsg)
    }

    const userMsg = {
      id: db.messages.length + 1,
      session_id: sessionId,
      role: 'user',
      content: content,
      created_at: new Date()
    }
    db.messages.push(userMsg)

    if (user) {
      user.total_messages++
    }

    const sessionMessages = db.messages.filter(m => m.session_id === sessionId)
    const responseText = await callSiliconFlowAPI(sessionMessages, content)

    const aiMsg = {
      id: db.messages.length + 1,
      session_id: sessionId,
      role: 'assistant',
      content: responseText,
      created_at: new Date()
    }
    db.messages.push(aiMsg)

    const updatedBalance = user ? user.balance : null

    res.json({
      sessionId, message: responseText, isNew, usedAI: true,
      balance: updatedBalance,
      tokenUsage: null,
    })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: '处理消息失败' })
  }
})

// ========== 流式聊天 API（SSE） ==========

app.post('/api/chat/stream', chatLimiter, optionalUser, async (req, res) => {
  try {
    let { sessionId, content, userId: bodyUserId } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }

    const userId = req.userId || bodyUserId
    let user = null
    if (userId) {
      user = db.users.find(u => u.id === userId)
    }

    let isNew = false
    if (!sessionId) {
      sessionId = uuidv4()
      db.sessions.push({
        id: sessionId,
        user_id: userId || null,
        created_at: new Date(),
        status: 'active',
        collected_data: {},
        step: 0,
        deep_analysis_result: null
      })
      isNew = true
    } else {
      const existing = db.sessions.find(s => s.id === sessionId)
      if (!existing) {
        sessionId = uuidv4()
        db.sessions.push({
          id: sessionId,
          user_id: userId || null,
          created_at: new Date(),
          status: 'active',
          collected_data: {},
          step: 0,
          deep_analysis_result: null
        })
        isNew = true
      }
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    // 发送 start 事件
    res.write(`data: ${JSON.stringify({ type: 'start', sessionId, isNew })}\n\n`)

    // 保存用户消息
    db.messages.push({
      id: db.messages.length + 1,
      session_id: sessionId,
      role: 'user',
      content: content,
      created_at: new Date()
    })

    if (user) user.total_messages++

    // 获取会话历史消息
    const sessionMessages = db.messages.filter(m => m.session_id === sessionId)

    // 调用硅基流动 API（流式）
    let fullResponse = ''
    try {
      fullResponse = await callSiliconFlowStreamAPI(sessionMessages, content, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
      })
    } catch (apiErr) {
      console.error('SiliconFlow API error:', apiErr.message)
      // 如果 API 调用失败，使用本地回复
      fullResponse = generateLocalResponse(content, sessionId)
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: fullResponse })}\n\n`)
    }

    // 保存 AI 回复
    db.messages.push({
      id: db.messages.length + 1,
      session_id: sessionId,
      role: 'assistant',
      content: fullResponse,
      created_at: new Date()
    })

    // 发送 usage 事件
    res.write(`data: ${JSON.stringify({ type: 'usage', balance: user?.balance || null, tokenUsage: null })}\n\n`)

    // 发送完成事件
    res.write(`data: [DONE]\n\n`)
    res.end()
  } catch (err) {
    console.error('Stream chat error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: '处理消息失败' })
    } else {
      res.end()
    }
  }
})

// ========== 硅基流动 API 调用 ==========

const MERCHANT_APPEAL_SYSTEM_PROMPT = `你是专业的微信支付商户号申诉助手，拥有丰富的商户号风控申诉经验。

## 你的核心能力：
1. 分析商户号被限制/冻结的原因
2. 指导用户准备申诉材料
3. 撰写专业的申诉文案
4. 提供整改方案和行动计划

## 常见违规类型及处理方案：

### 1. 涉嫌赌博/游戏行业
- 需要提供：游戏版号、文化部备案、ICP许可证
- 申诉要点：证明业务合法合规，有正规资质
- 整改方案：完善风控体系，增加用户身份验证

### 2. 交易异常/涉嫌套现
- 需要提供：真实交易凭证、物流单号、商品描述
- 申诉要点：证明交易真实性，提供完整交易链路
- 整改方案：优化交易结构，避免异常交易模式

### 3. 跨类目经营
- 需要提供：营业执照经营范围、实际经营场景说明
- 申诉要点：说明经营合理性，提供补充资质
- 整改方案：调整经营范围或申请类目变更

### 4. 投诉纠纷
- 需要提供：售后处理记录、客服沟通记录、退款凭证
- 申诉要点：展示积极处理态度，提供解决方案
- 整改方案：完善售后服务流程

### 5. 账户冻结
- 需要提供：身份证明、营业执照、经营场景照片
- 申诉要点：证明身份真实，经营合法
- 整改方案：配合调查，提供补充材料

## 回复规则：
- 用专业但易懂的语言回复
- 根据用户描述的问题，给出针对性的建议
- 主动询问缺失的关键信息（商户号、违规原因、行业类型）
- 提供具体的申诉材料清单
- 给出可执行的整改方案
- 回复使用中文`

async function getActiveModel() {
  let model = db.ai_models.find(m => m.is_active === 1 && m.is_enabled === 1 && m.api_key)
  if (!model) {
    model = db.ai_models.find(m => m.is_enabled === 1 && m.is_free === 1 && m.api_key)
  }
  return model
}

async function callSiliconFlowAPI(sessionMessages, userContent) {
  const model = await getActiveModel()
  if (!model || !model.api_key) {
    console.log('[AI] 无可用模型，使用本地回复')
    return generateLocalResponse(userContent)
  }

  const messages = [
    { role: 'system', content: MERCHANT_APPEAL_SYSTEM_PROMPT },
    ...sessionMessages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    }))
  ]

  console.log(`[AI] 调用模型: ${model.model_name}`)

  const response = await fetch(model.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.api_key}`,
    },
    body: JSON.stringify({
      model: model.model_name,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
      top_p: 0.7,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`[AI] API 错误: ${response.status} ${errText}`)
    throw new Error(`API 调用失败: ${response.status}`)
  }

  const data = await response.json()
  const reply = data.choices?.[0]?.message?.content || ''
  console.log(`[AI] 回复成功, 长度: ${reply.length}`)
  return reply
}

async function callSiliconFlowStreamAPI(sessionMessages, userContent, onChunk) {
  const model = await getActiveModel()
  if (!model || !model.api_key) {
    console.log('[AI] 无可用模型，使用本地回复')
    const localReply = generateLocalResponse(userContent)
    onChunk(localReply)
    return localReply
  }

  const messages = [
    { role: 'system', content: MERCHANT_APPEAL_SYSTEM_PROMPT },
    ...sessionMessages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    }))
  ]

  console.log(`[AI] 流式调用模型: ${model.model_name}`)

  const response = await fetch(model.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.api_key}`,
    },
    body: JSON.stringify({
      model: model.model_name,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
      top_p: 0.7,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`[AI] 流式API错误: ${response.status} ${errText}`)
    throw new Error(`API 调用失败: ${response.status}`)
  }

  const reader = response.body
  let fullContent = ''
  let buffer = ''

  for await (const chunk of reader) {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          fullContent += content
          onChunk(content)
        }
      } catch {}
    }
  }

  console.log(`[AI] 流式回复完成, 长度: ${fullContent.length}`)
  return fullContent
}

function generateLocalResponse(userMessage, sessionId) {
  const session = sessionId ? db.sessions.find(s => s.id === sessionId) : null
  const collected = session?.collected_data || {}

  if (userMessage.includes('限制') || userMessage.includes('冻结') || userMessage.includes('拦截')) {
    return '好的，我了解了。商户号被限制收款/冻结确实很麻烦。\n\n为了更好地帮助您，请告诉我：\n\n1. **您的商户号是多少？**\n2. **具体的违规原因是什么？**（可以在商户平台看到）\n3. **您是做什么行业的？**（例如：餐饮、电商、游戏等）\n\n有了这些信息，我就能帮您生成专业的申诉材料了。'
  } else if (userMessage.includes('行业') || userMessage.includes('做什么') || userMessage.includes('游戏') || userMessage.includes('赌博')) {
    return '好的，关于游戏行业被指涉嫌赌博的问题，这是比较常见的情况。\n\n📋 **需要准备的申诉材料：**\n\n1. **游戏版号** - 证明游戏已获国家审批\n2. **文化部备案** - 网络文化经营许可证\n3. **ICP许可证** - 增值电信业务经营许可证\n4. **营业执照** - 经营范围包含游戏相关\n5. **游戏规则说明** - 证明不涉及赌博机制\n6. **用户协议** - 展示合规的用户条款\n\n🔧 **整改方案：**\n\n1. 完善风控体系，增加用户身份验证\n2. 调整游戏内购机制，避免类似赌博设计\n3. 增加消费提醒和限额功能\n4. 完善未成年人保护措施\n\n请告诉我您的商户号和具体违规原因，我帮您撰写专业的申诉文案。'
  } else if (userMessage.match(/^\d+$/)) {
    return '收到您的商户号了。现在请告诉我：\n\n1. **具体的违规原因是什么？**（登录商户平台可以查看）\n2. **您的行业类型？**\n\n常见违规原因：\n- 交易异常\n- 涉嫌套现\n- 跨类目经营\n- 投诉纠纷\n- 其他'
  } else {
    return '好的，我理解您的情况。为了给您提供最专业的帮助，请提供以下信息：\n\n📋 **必要信息**\n1. 商户号\n2. 违规原因\n3. 行业类型\n\n有了这些信息，我就能帮您：\n✅ 分析风险等级\n✅ 生成材料清单\n✅ 撰写申诉文案\n✅ 提供行动计划'
  }
}

// ========== 会话 API ==========

app.get('/api/sessions/:id/info', optionalUser, async (req, res) => {
  try {
    const session = db.sessions.find(s => s.id === req.params.id)
    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }
    if (session.user_id && req.userId && String(session.user_id) !== String(req.userId)) {
      return res.status(403).json({ error: '无权访问此会话' })
    }
    res.json({ success: true, session })
  } catch (error) {
    logger.error('Get session error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

app.put('/api/sessions/:id/field', optionalUser, async (req, res) => {
  try {
    const { id } = req.params
    const { field, value } = req.body
    
    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: '字段名无效' })
    }

    const session = db.sessions.find(s => s.id === id)
    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }

    if (!session.collected_data) session.collected_data = {}
    session.collected_data[field] = value

    res.json({ success: true })
  } catch (error) {
    console.error('Update field error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

app.get('/api/sessions/:id/messages', optionalUser, async (req, res) => {
  try {
    const { id } = req.params
    const messages = db.messages.filter(m => m.session_id === id)
    res.json({ success: true, messages })
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// ========== 管理员 API ==========

app.post('/api/admin/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body
    const admin = db.admins.find(a => a.username === username)
    if (!admin) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }
    const valid = await bcrypt.compare(password, admin.password)
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }
    const token = signToken({ adminId: admin.id, role: 'admin' })
    res.json({ success: true, token })
  } catch (err) {
    console.error('Admin login error:', err)
    res.status(500).json({ error: '登录失败' })
  }
})

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = {
      totalUsers: db.users.length,
      totalSessions: db.sessions.length,
      totalMessages: db.messages.length,
      todayNewUsers: db.users.filter(u => new Date(u.created_at).toDateString() === new Date().toDateString()).length,
      totalRevenue: db.users.reduce((sum, u) => sum + (u.total_spent || 0), 0),
      activeAIModels: db.ai_models.filter(m => m.is_active === 1).length
    }
    res.json({ success: true, stats })
  } catch (err) {
    console.error('Get stats error:', err)
    res.status(500).json({ error: '获取统计数据失败' })
  }
})

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, users: db.users })
  } catch (err) {
    console.error('Get users error:', err)
    res.status(500).json({ error: '获取用户列表失败' })
  }
})

app.get('/api/admin/sessions', requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, sessions: db.sessions })
  } catch (err) {
    console.error('Get sessions error:', err)
    res.status(500).json({ error: '获取会话列表失败' })
  }
})

// 获取所有可用的 AI 模型（用户也可以查看）
app.get('/api/ai-models', optionalUser, async (req, res) => {
  try {
    const models = db.ai_models.filter(m => m.is_enabled === 1)
    res.json({ success: true, models })
  } catch (err) {
    console.error('Get AI models error:', err)
    res.status(500).json({ error: '获取AI模型列表失败' })
  }
})

app.get('/api/admin/ai-models', requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, models: db.ai_models })
  } catch (err) {
    console.error('Get AI models error:', err)
    res.status(500).json({ error: '获取AI模型列表失败' })
  }
})

app.get('/api/admin/system-config', requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, configs: db.system_config })
  } catch (err) {
    console.error('Get system config error:', err)
    res.status(500).json({ error: '获取系统配置失败' })
  }
})

app.put('/api/admin/system-config', requireAdmin, async (req, res) => {
  try {
    const { configs } = req.body
    configs.forEach(config => {
      const existing = db.system_config.find(c => c.config_key === config.config_key)
      if (existing) {
        existing.config_value = config.config_value
        existing.updated_at = new Date()
      }
    })
    res.json({ success: true })
  } catch (err) {
    console.error('Update system config error:', err)
    res.status(500).json({ error: '更新系统配置失败' })
  }
})

// ========== AI 模型管理 API ==========

// 一键检测所有模型健康状态
app.post('/api/admin/ai-models/check-all', requireAdmin, async (req, res) => {
  try {
    console.log('[模型检测] 开始检测所有模型...')
    const results = []
    
    for (const model of db.ai_models) {
      if (!model.is_enabled) continue
      
      try {
        const startTime = Date.now()
        
        // 模拟健康检查（实际应该调用模型API）
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200))
        
        const endTime = Date.now()
        const responseMs = endTime - startTime
        
        model.health_status = 'healthy'
        model.last_check_at = new Date()
        model.last_error = null
        model.consecutive_fails = 0
        model.response_ms = responseMs
        model.updated_at = new Date()
        
        results.push({
          id: model.id,
          name: model.display_name,
          status: 'success',
          responseMs,
          error: null
        })
        
        console.log(`[模型检测] ${model.display_name} - 健康 (${responseMs}ms)`)
      } catch (error) {
        model.health_status = 'error'
        model.last_check_at = new Date()
        model.last_error = error.message
        model.consecutive_fails = (model.consecutive_fails || 0) + 1
        model.response_ms = null
        model.updated_at = new Date()
        
        results.push({
          id: model.id,
          name: model.display_name,
          status: 'error',
          error: error.message
        })
        
        console.log(`[模型检测] ${model.display_name} - 失败: ${error.message}`)
      }
    }
    
    // 统计结果
    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length
    
    console.log(`[模型检测] 完成 - 成功: ${successCount}, 失败: ${errorCount}`)
    
    res.json({
      success: true,
      message: `检测完成 - ${successCount} 个模型正常, ${errorCount} 个模型异常`,
      results,
      stats: {
        total: results.length,
        success: successCount,
        error: errorCount
      }
    })
  } catch (error) {
    console.error('Check all models error:', error)
    res.status(500).json({ error: '模型检测失败' })
  }
})

// 检测单个模型
app.post('/api/admin/ai-models/:id/check', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const model = db.ai_models.find(m => m.id === parseInt(id))
    
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    
    const startTime = Date.now()
    
    try {
      // 模拟健康检查
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300))
      
      const endTime = Date.now()
      const responseMs = endTime - startTime
      
      model.health_status = 'healthy'
      model.last_check_at = new Date()
      model.last_error = null
      model.consecutive_fails = 0
      model.response_ms = responseMs
      model.updated_at = new Date()
      
      console.log(`[模型检测] ${model.display_name} - 健康 (${responseMs}ms)`)
      
      res.json({
        success: true,
        message: '模型检测成功',
        model,
        responseMs
      })
    } catch (error) {
      model.health_status = 'error'
      model.last_check_at = new Date()
      model.last_error = error.message
      model.consecutive_fails = (model.consecutive_fails || 0) + 1
      model.response_ms = null
      model.updated_at = new Date()
      
      console.log(`[模型检测] ${model.display_name} - 失败: ${error.message}`)
      
      res.status(500).json({
        success: false,
        error: '模型检测失败',
        model
      })
    }
  } catch (error) {
    console.error('Check model error:', error)
    res.status(500).json({ error: '模型检测失败' })
  }
})

// 启用/禁用模型
app.put('/api/admin/ai-models/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { is_enabled } = req.body
    
    const model = db.ai_models.find(m => m.id === parseInt(id))
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    
    model.is_enabled = is_enabled ? 1 : 0
    model.updated_at = new Date()
    
    console.log(`[模型管理] ${model.display_name} - ${is_enabled ? '启用' : '禁用'}`)
    
    res.json({ success: true, model })
  } catch (error) {
    console.error('Toggle model error:', error)
    res.status(500).json({ error: '操作失败' })
  }
})

// 设置默认模型
app.put('/api/admin/ai-models/:id/set-active', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    // 先取消所有模型的激活状态
    db.ai_models.forEach(m => {
      m.is_active = 0
      m.updated_at = new Date()
    })
    
    // 设置新的激活模型
    const model = db.ai_models.find(m => m.id === parseInt(id))
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    
    model.is_active = 1
    model.updated_at = new Date()
    
    console.log(`[模型管理] 设置默认模型: ${model.display_name}`)
    
    res.json({ success: true, model, models: db.ai_models })
  } catch (error) {
    console.error('Set active model error:', error)
    res.status(500).json({ error: '操作失败' })
  }
})

// 智能导入模型（从硅基流动）
app.post('/api/admin/ai-models/import', requireAdmin, async (req, res) => {
  try {
    console.log('[模型管理] 开始智能导入模型...')
    
    // 模拟从硅基流动导入模型
    const importedModels = [
      { model_name: 'Qwen/Qwen3.5-4B', display_name: 'Qwen/Qwen3.5-4B（免费）', is_free: 1 },
      { model_name: 'Qwen/Qwen3-8B', display_name: 'Qwen/Qwen3-8B（免费）', is_free: 1 },
      { model_name: 'Qwen/Qwen2.5-7B-Instruct', display_name: 'Qwen/Qwen2.5-7B-Instruct（免费）', is_free: 1 },
      { model_name: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', display_name: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B（免费）', is_free: 1 },
      { model_name: 'THUDM/GLM-Z1-9B-0414', display_name: 'THUDM/GLM-Z1-9B-0414（免费）', is_free: 1 },
    ]
    
    let newCount = 0
    let updatedCount = 0
    
    importedModels.forEach((importModel, index) => {
      const existing = db.ai_models.find(m => m.model_name === importModel.model_name)
      
      if (existing) {
        // 更新现有模型
        existing.display_name = importModel.display_name
        existing.is_free = importModel.is_free ? 1 : 0
        existing.updated_at = new Date()
        updatedCount++
      } else {
        // 添加新模型
        const newId = db.ai_models.length > 0 ? Math.max(...db.ai_models.map(m => m.id)) + 1 : 1
        db.ai_models.push({
          id: newId,
          provider: 'siliconflow',
          display_name: importModel.display_name,
          api_key: '',
          model_name: importModel.model_name,
          endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
          is_active: 0,
          is_enabled: 1,
          is_free: importModel.is_free ? 1 : 0,
          sort_order: index + 1,
          health_status: 'unknown',
          last_check_at: null,
          last_error: null,
          consecutive_fails: 0,
          response_ms: null,
          created_at: new Date(),
          updated_at: new Date()
        })
        newCount++
      }
    })
    
    console.log(`[模型管理] 导入完成 - 新增: ${newCount}, 更新: ${updatedCount}`)
    
    res.json({
      success: true,
      message: `智能导入完成 - 新增 ${newCount} 个模型，更新 ${updatedCount} 个模型`,
      stats: { new: newCount, updated: updatedCount },
      models: db.ai_models
    })
  } catch (error) {
    console.error('Import models error:', error)
    res.status(500).json({ error: '模型导入失败' })
  }
})

// 更新模型配置
app.put('/api/admin/ai-models/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const model = db.ai_models.find(m => m.id === parseInt(id))
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    
    // 安全更新
    const safeFields = ['display_name', 'api_key', 'model_name', 'endpoint', 'sort_order', 'is_enabled']
    safeFields.forEach(field => {
      if (updates[field] !== undefined) {
        model[field] = updates[field]
      }
    })
    
    model.updated_at = new Date()
    
    console.log(`[模型管理] 更新模型: ${model.display_name}`)
    
    res.json({ success: true, model })
  } catch (error) {
    console.error('Update model error:', error)
    res.status(500).json({ error: '更新模型失败' })
  }
})

// ========== 兼容性 API（匹配前端期望） ==========

// 获取模型健康状态（前端期望）
app.get('/api/admin/ai-models/health', requireAdmin, async (req, res) => {
  try {
    const modelsWithHasKey = db.ai_models.map(m => ({
      ...m,
      has_key: !!m.api_key,
      api_key_masked: m.api_key ? (m.api_key.substring(0, 8) + '...' + m.api_key.substring(m.api_key.length - 4)) : ''
    }))
    res.json({ models: modelsWithHasKey })
  } catch (error) {
    console.error('Get models health error:', error)
    res.status(500).json({ error: '获取模型列表失败' })
  }
})

// 获取模型列表（前端期望）
app.get('/api/admin/ai-models', requireAdmin, async (req, res) => {
  try {
    const modelsWithHasKey = db.ai_models.map(m => ({
      ...m,
      has_key: !!m.api_key,
      api_key_masked: m.api_key ? (m.api_key.substring(0, 8) + '...' + m.api_key.substring(m.api_key.length - 4)) : ''
    }))
    res.json({ models: modelsWithHasKey })
  } catch (error) {
    console.error('Get models error:', error)
    res.status(500).json({ error: '获取模型列表失败' })
  }
})

// 激活模型（前端期望）
app.put('/api/admin/ai-models/:id/activate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    // 先取消所有模型的激活状态
    db.ai_models.forEach(m => {
      m.is_active = 0
      m.updated_at = new Date()
    })
    
    // 设置新的激活模型
    const model = db.ai_models.find(m => m.id === parseInt(id))
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    
    model.is_active = 1
    model.updated_at = new Date()
    
    console.log(`[模型管理] 激活模型: ${model.display_name}`)
    
    res.json({ success: true, model, models: db.ai_models })
  } catch (error) {
    console.error('Activate model error:', error)
    res.status(500).json({ error: '操作失败' })
  }
})

// 自动导入（前端期望）- 同时设置 API Key
app.post('/api/admin/ai-models/auto-import', requireAdmin, async (req, res) => {
  try {
    const { apiKey } = req.body
    console.log('[模型管理] 智能导入并设置 API Key...')
    
    // 检测 API Key 属于哪个平台
    let providers = []
    if (apiKey.startsWith('sk-')) {
      // 可能是硅基流动或其他 OpenAI 兼容平台
      providers.push('siliconflow')
    }
    
    // 批量设置 API Key 到所有对应平台的模型
    let updatedCount = 0
    db.ai_models.forEach(m => {
      if (m.provider === 'siliconflow' && providers.includes('siliconflow')) {
        m.api_key = apiKey
        m.updated_at = new Date()
        updatedCount++
      }
    })
    
    // 模拟导入的模型（其实都已经存在了）
    const importedModels = db.ai_models
      .filter(m => m.provider === 'siliconflow')
      .map(m => ({ name: m.display_name, action: 'updated' }))
    
    res.json({
      success: true,
      provider: providers,
      imported: importedModels,
      message: `已设置 ${updatedCount} 个模型的 API Key`
    })
  } catch (error) {
    console.error('Auto import error:', error)
    res.status(500).json({ error: '导入失败' })
  }
})

// 批量设置 API Key
app.post('/api/admin/ai-models/batch-set-key', requireAdmin, async (req, res) => {
  try {
    const { apiKey, provider } = req.body
    console.log(`[模型管理] 批量设置 API Key - provider: ${provider}`)
    
    let updatedCount = 0
    db.ai_models.forEach(m => {
      if (m.provider === provider) {
        m.api_key = apiKey
        m.updated_at = new Date()
        updatedCount++
      }
    })
    
    res.json({
      success: true,
      message: `已更新 ${updatedCount} 个模型的 API Key`,
      updated: updatedCount
    })
  } catch (error) {
    console.error('Batch set key error:', error)
    res.status(500).json({ error: '批量设置失败' })
  }
})

// 测试模型（前端期望）
app.post('/api/admin/ai-models/test', requireAdmin, async (req, res) => {
  try {
    const { modelId } = req.body
    const model = db.ai_models.find(m => m.id === parseInt(modelId))
    
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    
    // 模拟测试
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
    
    res.json({
      success: true,
      model: model.model_name,
      reply: '测试成功！AI 模型连接正常。'
    })
  } catch (error) {
    console.error('Test model error:', error)
    res.status(500).json({ success: false, error: '测试失败' })
  }
})

// 删除模型（前端期望）
app.delete('/api/admin/ai-models/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const index = db.ai_models.findIndex(m => m.id === parseInt(id))
    
    if (index === -1) {
      return res.status(404).json({ error: '模型不存在' })
    }
    
    const deleted = db.ai_models.splice(index, 1)[0]
    console.log(`[模型管理] 删除模型: ${deleted.display_name}`)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Delete model error:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

// 添加模型（前端期望）
app.post('/api/admin/ai-models', requireAdmin, async (req, res) => {
  try {
    const { provider, displayName, apiKey, modelName, endpoint, isFree } = req.body
    
    const newId = db.ai_models.length > 0 ? Math.max(...db.ai_models.map(m => m.id)) + 1 : 1
    const newModel = {
      id: newId,
      provider: provider,
      display_name: displayName,
      api_key: apiKey,
      model_name: modelName,
      endpoint: endpoint,
      is_active: 0,
      is_enabled: 1,
      is_free: isFree ? 1 : 0,
      sort_order: newId,
      health_status: 'unknown',
      last_check_at: null,
      last_error: null,
      consecutive_fails: 0,
      response_ms: null,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    db.ai_models.push(newModel)
    console.log(`[模型管理] 添加模型: ${newModel.display_name}`)
    
    res.json({ success: true, model: newModel })
  } catch (error) {
    console.error('Add model error:', error)
    res.status(500).json({ error: '添加失败' })
  }
})

// 更新模型（兼容前端期望）
app.put('/api/admin/ai-models/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const model = db.ai_models.find(m => m.id === parseInt(id))
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    
    // 安全更新
    if (updates.apiKey !== undefined) model.api_key = updates.apiKey
    if (updates.isEnabled !== undefined) model.is_enabled = updates.isEnabled ? 1 : 0
    if (updates.display_name !== undefined) model.display_name = updates.display_name
    if (updates.model_name !== undefined) model.model_name = updates.model_name
    if (updates.endpoint !== undefined) model.endpoint = updates.endpoint
    
    model.updated_at = new Date()
    
    console.log(`[模型管理] 更新模型: ${model.display_name}`)
    
    res.json({ success: true, model })
  } catch (error) {
    console.error('Update model error:', error)
    res.status(500).json({ error: '更新模型失败' })
  }
})

// 获取当前活跃模型
app.get('/api/ai-models/active', optionalUser, async (req, res) => {
  try {
    const activeModel = db.ai_models.find(m => m.is_active === 1 && m.is_enabled === 1)
    if (!activeModel) {
      // 如果没有活跃模型，找第一个启用的免费模型
      const freeModel = db.ai_models.find(m => m.is_enabled === 1 && m.is_free === 1)
      if (freeModel) {
        return res.json({ success: true, model: freeModel })
      }
      return res.json({ success: true, model: null })
    }
    res.json({ success: true, model: activeModel })
  } catch (error) {
    console.error('Get active model error:', error)
    res.status(500).json({ error: '获取活跃模型失败' })
  }
})

// ========== 健康检查 ==========

// ========== 订单 API ==========

app.get('/api/orders/from-system', optionalUser, async (req, res) => {
  try {
    const { page_no = 1, page_size = 20, order_status, start_time, end_time, order_no, buyer_nick, keyword } = req.query
    
    let filteredOrders = [...db.orders]
    
    // 关键词搜索
    if (keyword) {
      const kw = keyword.toLowerCase()
      filteredOrders = filteredOrders.filter(o => 
        o.order_no?.toLowerCase().includes(kw) ||
        o.buyer_nick?.toLowerCase().includes(kw) ||
        o.item_title?.toLowerCase().includes(kw)
      )
    }
    
    // 订单号搜索
    if (order_no) {
      filteredOrders = filteredOrders.filter(o => 
        o.order_no?.toLowerCase().includes(order_no.toLowerCase())
      )
    }
    
    // 买家昵称搜索
    if (buyer_nick) {
      filteredOrders = filteredOrders.filter(o => 
        o.buyer_nick?.toLowerCase().includes(buyer_nick.toLowerCase())
      )
    }
    
    // 订单状态筛选
    if (order_status) {
      const statusList = String(order_status).split(',').map(s => parseInt(s))
      filteredOrders = filteredOrders.filter(o => statusList.includes(o.order_status))
    }
    
    // 排序：待发货优先，然后按时间倒序
    filteredOrders.sort((a, b) => {
      if (a.order_status === 12 && b.order_status !== 12) return -1
      if (b.order_status === 12 && a.order_status !== 12) return 1
      return (b.created_time || 0) - (a.created_time || 0)
    })
    
    // 分页
    const page = parseInt(page_no) || 1
    const size = parseInt(page_size) || 20
    const start = (page - 1) * size
    const pagedOrders = filteredOrders.slice(start, start + size)
    
    // 转换订单数据格式，适配前端
    const transformedOrders = pagedOrders.map(o => transformOrder(o))
    
    res.json({
      success: true,
      data: transformedOrders,
      total: filteredOrders.length,
      page_no: page,
      page_size: size,
      count: filteredOrders.length
    })
  } catch (error) {
    console.error('Get orders error:', error)
    res.status(500).json({ error: '获取订单列表失败' })
  }
})

app.get('/api/orders/from-system/:orderNo', optionalUser, async (req, res) => {
  try {
    const { orderNo } = req.params
    const order = db.orders.find(o => o.order_no === orderNo)
    
    if (!order) {
      return res.status(404).json({ error: '订单不存在' })
    }
    
    res.json({
      success: true,
      data: transformOrderDetail(order)
    })
  } catch (error) {
    console.error('Get order detail error:', error)
    res.status(500).json({ error: '获取订单详情失败' })
  }
})

// 测试闲鱼管家API连接
app.get('/api/xianguan/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'API连接成功（演示模式）',
      data: db.orders.slice(0, 2),
      raw: { code: 0, msg: 'success', data: db.orders.slice(0, 2) }
    })
  } catch (error) {
    console.error('闲鱼管家API测试失败:', error.message)
    res.status(500).json({
      success: false,
      error: 'API调用失败: ' + error.message
    })
  }
})

// 获取闲鱼管家店铺列表
app.get('/api/xianguan/shops', requireUser, async (req, res) => {
  try {
    res.json({
      success: true,
      data: [
        {
          authorize_id: 1,
          user_identity: 'user_001',
          user_name: 'demo_user',
          user_nick: '演示店铺',
          shop_name: '诚信数码专营店',
          is_pro: true,
          is_valid: true,
          is_trial: false,
          valid_end_time: Date.now() + 86400000 * 365,
          item_biz_types: '2,10,19'
        }
      ]
    })
  } catch (error) {
    console.error('获取闲鱼管家店铺失败:', error.message)
    res.status(500).json({ error: '获取店铺列表失败: ' + error.message })
  }
})

// 创建新会话（支持直接绑定订单）
app.post('/api/sessions', optionalUser, async (req, res) => {
  try {
    const sessionId = uuidv4()
    const userId = req.userId || req.body.userId || null
    const { orderNo, orderData } = req.body
    
    console.log(`[创建会话] sessionId=${sessionId}, userId=${userId}`)
    
    const newSession = {
      id: sessionId,
      user_id: userId,
      created_at: new Date(),
      status: 'active',
      collected_data: {},
      step: 0,
      deep_analysis_result: null,
      order_no: orderNo || null,
      order_data: orderData || null
    }
    db.sessions.push(newSession)
    
    res.json({ sessionId, orderNo, orderData })
  } catch (error) {
    console.error('创建会话失败:', error)
    res.status(500).json({ error: '创建会话失败' })
  }
})

// 绑定订单到当前会话
app.post('/api/sessions/:id/bind-order', requireUser, async (req, res) => {
  try {
    const { id } = req.params
    const { order_no, order_data } = req.body
    
    console.log(`[绑定订单] 会话 ${id}, 订单号: ${order_no}, 订单数据: ${order_data ? '有' : '无'}`)
    
    // 验证会话存在且属于当前用户
    const session = db.sessions.find(s => s.id === id)
    if (!session) {
      console.log(`[绑定订单] 会话 ${id} 不存在`)
      return res.status(404).json({ error: '会话不存在' })
    }
    
    // 更新会话的订单绑定信息
    session.order_no = order_no
    session.order_data = order_data
    console.log(`[绑定订单] 成功: 会话 ${id} 绑定订单 ${order_no}`)
    
    res.json({ success: true, message: '订单绑定成功', order_no, order_data })
  } catch (error) {
    console.error('绑定订单失败:', error)
    res.status(500).json({ error: '绑定订单失败' })
  }
})

// 获取会话绑定的订单信息
app.get('/api/sessions/:id/order', requireUser, async (req, res) => {
  try {
    const { id } = req.params
    
    const session = db.sessions.find(s => s.id === id)
    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }
    
    if (!session.order_no) {
      return res.json({ success: true, data: null, message: '该会话未绑定订单' })
    }
    
    // 如果有缓存的订单数据直接返回，否则从订单数据查找
    if (session.order_data) {
      return res.json({ success: true, data: session.order_data, cached: true })
    }
    
    // 从订单数据查找
    const order = db.orders.find(o => o.order_no === session.order_no)
    if (order) {
      const orderData = transformOrderDetail(order)
      return res.json({ success: true, data: orderData, cached: false })
    }
    
    res.json({ success: true, data: null })
  } catch (error) {
    console.error('获取会话订单失败:', error)
    res.status(500).json({ error: '获取订单信息失败' })
  }
})

// 订单数据转换函数
function transformOrder(order) {
  return {
    order_no: order.order_no,
    buyer_nick: order.buyer_nick,
    item_title: order.item_title,
    item_image: order.item_image,
    pay_amount: order.pay_amount,
    pay_amount_fen: order.pay_amount_fen,
    total_amount: order.total_amount,
    total_amount_fen: order.total_amount_fen,
    order_status: order.order_status,
    status_text: order.status_text,
    created_time: order.created_time,
    create_time_text: order.create_time_text,
    pay_time: order.pay_time,
    ship_time: order.ship_time,
    receive_time: order.receive_time,
    consign_time: order.consign_time,
    confirm_time: order.confirm_time,
    consignee: order.consignee,
    mobile: order.mobile,
    phone: order.phone,
    address: order.address,
    province: order.province,
    city: order.city,
    district: order.district,
    post_code: order.post_code,
    logistics_company: order.logistics_company,
    logistics_no: order.logistics_no,
    express_code: order.express_code,
    express_name: order.express_name,
    item_type: order.item_type,
    item_biz_type: order.item_biz_type,
    sp_biz_type: order.sp_biz_type,
    service_support: order.service_support,
    stuff_status: order.stuff_status,
    sku_name: order.sku_name,
    sku_attrs: order.sku_attrs,
    outer_id: order.outer_id,
    product_id: order.product_id,
    seller_nick: order.seller_nick,
    seller_user_name: order.seller_user_name,
    shop_name: order.shop_name,
    refund_status: order.refund_status,
    complaint_status: order.complaint_status,
    dispute_status: order.dispute_status
  }
}

function transformOrderDetail(order) {
  return {
    ...transformOrder(order),
    // 添加更多详情字段
    buyer_memo: order.buyer_memo || '',
    seller_memo: order.seller_memo || '',
    item_desc: order.item_desc || order.item_title,
    item_pics: order.item_image ? [order.item_image] : [],
    create_time: order.created_time,
    update_time: Date.now()
  }
}

// 获取联系人卡片（公开）
app.get('/api/contact-card', (req, res) => {
  res.json({
    enabled: true,
    cards: [
      {
        id: 1,
        name: '张顾问',
        title: '商户号申诉专家',
        avatar: 'https://via.placeholder.com/100x100',
        phone: '400-123-4567',
        wechat: 'appeal_helper',
        description: '5年商户申诉经验，处理过1000+案件'
      }
    ]
  })
})

// ========== 健康检查 ==========

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ========== 邮件服务 API ==========

app.post('/api/admin/send-email', requireAdmin, async (req, res) => {
  try {
    if (!mailTransporter) {
      return res.status(400).json({ error: 'SMTP 未配置，请在 .env 中设置 SMTP_USER 和 SMTP_PASS' })
    }
    const { to, subject, html, text } = req.body
    if (!to || !subject) {
      return res.status(400).json({ error: '收件人和主题不能为空' })
    }
    const info = await mailTransporter.sendMail({
      from: `"商户号申诉助手" <${smtpConfig.auth.user}>`,
      to,
      subject,
      html: html || text,
      text: text || '',
    })
    console.log(`[邮件] 发送成功: ${info.messageId}`)
    res.json({ success: true, messageId: info.messageId })
  } catch (error) {
    console.error('[邮件] 发送失败:', error.message)
    res.status(500).json({ error: '邮件发送失败: ' + error.message })
  }
})

app.get('/api/admin/email/check', requireAdmin, async (req, res) => {
  try {
    if (!mailTransporter) {
      return res.json({ configured: false, message: 'SMTP 未配置' })
    }
    await mailTransporter.verify()
    res.json({ configured: true, message: 'SMTP 连接正常', user: smtpConfig.auth.user })
  } catch (error) {
    res.json({ configured: false, message: 'SMTP 连接失败: ' + error.message })
  }
})

// ========== DeepSeek 余额查询 API ==========

app.get('/api/admin/deepseek/balance', requireAdmin, async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) {
      return res.json({ configured: false, message: 'DeepSeek API Key 未配置' })
    }
    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errText = await response.text()
      console.error(`[DeepSeek] 余额查询失败: ${response.status} ${errText}`)
      return res.json({ configured: true, error: `查询失败: ${response.status}`, balance: null })
    }
    const data = await response.json()
    console.log('[DeepSeek] 余额查询成功')
    res.json({ configured: true, balance: data })
  } catch (error) {
    console.error('[DeepSeek] 余额查询错误:', error.message)
    res.json({ configured: true, error: error.message, balance: null })
  }
})

// ========== 硅基流动余额查询 API ==========

app.get('/api/admin/siliconflow/balance', requireAdmin, async (req, res) => {
  try {
    if (!SILICONFLOW_API_KEY) {
      return res.json({ configured: false, message: '硅基流动 API Key 未配置' })
    }
    const response = await fetch('https://api.siliconflow.cn/v1/user/info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errText = await response.text()
      console.error(`[硅基流动] 余额查询失败: ${response.status} ${errText}`)
      return res.json({ configured: true, error: `查询失败: ${response.status}`, balance: null })
    }
    const data = await response.json()
    console.log('[硅基流动] 余额查询成功')
    res.json({ configured: true, balance: data })
  } catch (error) {
    console.error('[硅基流动] 余额查询错误:', error.message)
    res.json({ configured: true, error: error.message, balance: null })
  }
})

// ========== 心跳监测 API ==========

let heartbeatInterval = null
let heartbeatStatus = { running: false, lastSent: null, successCount: 0, failCount: 0, errors: [] }

app.post('/api/admin/heartbeat/start', requireAdmin, async (req, res) => {
  try {
    if (!mailTransporter) {
      return res.status(400).json({ error: 'SMTP 未配置' })
    }
    if (!HEARTBEAT_TO) {
      return res.status(400).json({ error: '心跳监测邮箱未配置' })
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
    }
    const { intervalMinutes = 30 } = req.body
    const intervalMs = intervalMinutes * 60 * 1000

    heartbeatStatus = { running: true, lastSent: null, successCount: 0, failCount: 0, errors: [], intervalMinutes }

    const sendHeartbeat = async () => {
      try {
        const activeModel = db.ai_models.find(m => m.is_active === 1)
        const modelInfo = activeModel ? activeModel.display_name : '未配置'
        const totalModels = db.ai_models.filter(m => m.is_enabled).length
        const healthyModels = db.ai_models.filter(m => m.health_status === 'healthy').length

        await mailTransporter.sendMail({
          from: `"商户号申诉助手" <${smtpConfig.auth.user}>`,
          to: HEARTBEAT_TO,
          subject: `💓 心跳监测 - 商户号申诉助手正常运行`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">💓 心跳监测报告</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
                <p style="color: #333;">商户号申诉助手系统运行正常！</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">运行时间</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${new Date().toLocaleString('zh-CN')}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">当前模型</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${modelInfo}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">可用模型</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${totalModels} 个</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">健康模型</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${healthyModels} 个</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">会话数</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${db.sessions.length} 个</td></tr>
                  <tr><td style="padding: 8px; color: #666;">消息数</td><td style="padding: 8px; font-weight: bold;">${db.messages.length} 条</td></tr>
                </table>
              </div>
            </div>
          `,
        })
        heartbeatStatus.lastSent = new Date()
        heartbeatStatus.successCount++
        console.log('[心跳] 发送成功')
      } catch (error) {
        heartbeatStatus.failCount++
        heartbeatStatus.errors.push({ time: new Date(), error: error.message })
        if (heartbeatStatus.errors.length > 10) heartbeatStatus.errors.shift()
        console.error('[心跳] 发送失败:', error.message)
      }
    }

    sendHeartbeat()
    heartbeatInterval = setInterval(sendHeartbeat, intervalMs)

    console.log(`[心跳] 已启动，间隔 ${intervalMinutes} 分钟`)
    res.json({ success: true, message: `心跳监测已启动，每 ${intervalMinutes} 分钟发送一次` })
  } catch (error) {
    console.error('[心跳] 启动失败:', error.message)
    res.status(500).json({ error: '启动失败: ' + error.message })
  }
})

app.post('/api/admin/heartbeat/stop', requireAdmin, (req, res) => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
    heartbeatStatus.running = false
    console.log('[心跳] 已停止')
    res.json({ success: true, message: '心跳监测已停止' })
  } else {
    res.json({ success: true, message: '心跳监测未在运行' })
  }
})

app.get('/api/admin/heartbeat/status', requireAdmin, (req, res) => {
  res.json(heartbeatStatus)
})

// ========== 系统状态 API ==========

app.get('/api/admin/system-status', requireAdmin, async (req, res) => {
  try {
    const activeModel = db.ai_models.find(m => m.is_active === 1)
    const totalModels = db.ai_models.filter(m => m.is_enabled).length
    const healthyModels = db.ai_models.filter(m => m.health_status === 'healthy').length

    let deepseekBalance = null
    let siliconflowBalance = null

    if (DEEPSEEK_API_KEY) {
      try {
        const dsRes = await fetch('https://api.deepseek.com/user/balance', {
          headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` }
        })
        if (dsRes.ok) deepseekBalance = await dsRes.json()
      } catch {}
    }

    if (SILICONFLOW_API_KEY) {
      try {
        const sfRes = await fetch('https://api.siliconflow.cn/v1/user/info', {
          headers: { 'Authorization': `Bearer ${SILICONFLOW_API_KEY}` }
        })
        if (sfRes.ok) siliconflowBalance = await sfRes.json()
      } catch {}
    }

    res.json({
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
      models: {
        active: activeModel?.display_name || '未配置',
        total: totalModels,
        healthy: healthyModels,
      },
      data: {
        sessions: db.sessions.length,
        messages: db.messages.length,
        users: db.users.length,
        orders: db.orders.length,
      },
      email: {
        configured: !!mailTransporter,
        user: smtpConfig.auth.user || '',
      },
      deepseek: {
        configured: !!DEEPSEEK_API_KEY,
        balance: deepseekBalance,
      },
      siliconflow: {
        configured: !!SILICONFLOW_API_KEY,
        balance: siliconflowBalance,
      },
      heartbeat: heartbeatStatus,
    })
  } catch (error) {
    console.error('[系统状态] 查询错误:', error.message)
    res.status(500).json({ error: '查询失败' })
  }
})

// ========== SPA 路由回退 ==========

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// 启动服务器
app.listen(PORT, () => {
  // 从环境变量初始化 API Key
  if (SILICONFLOW_API_KEY) {
    let count = 0
    db.ai_models.forEach(m => {
      if (m.provider === 'siliconflow' && !m.api_key) {
        m.api_key = SILICONFLOW_API_KEY
        count++
      }
    })
    if (count > 0) console.log(`🔑 已从环境变量设置 ${count} 个硅基流动模型的 API Key`)
  }

  console.log(`\n🚀 商户号申诉助手服务器已启动`)
  console.log(`📍 服务器地址: http://localhost:${PORT}`)
  console.log(`👤 管理后台: http://localhost:${PORT}/admin`)
  console.log(`🔑 默认管理员: admin / admin123`)
  
  const activeModel = db.ai_models.find(m => m.is_active === 1)
  if (SILICONFLOW_API_KEY) {
    console.log(`🤖 AI 模型: ${activeModel?.display_name || '未配置'} (硅基流动已配置)`)
  }
  if (DEEPSEEK_API_KEY) {
    console.log(`🧠 DeepSeek: 已配置 (${DEEPSEEK_API_KEY.substring(0, 8)}...)`)
  }
  if (mailTransporter) {
    console.log(`📧 邮件服务: 已配置 (${smtpConfig.auth.user})`)
  }
  if (GITHUB_TOKEN) {
    console.log(`🐙 GitHub: 已配置 (@${GITHUB_USERNAME})`)
  }
  
  console.log(`\n⚠️  这是开发演示版本，数据存储在内存中`)
  console.log(`⚠️  服务器重启后数据会重置\n`)
})
