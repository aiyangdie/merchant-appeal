# 商户号申诉智能服务系统 - 前端开发文档

**文档版本**: V1.0
**编写日期**: 2026-04-13
**面向角色**: 前端开发者
**产品经理**: AI产品经理
**配合UI文档**: UI_UX_DESIGN.md

---

## 1. 技术栈概述

### 1.1 核心技术选型

| 技术 | 选择 | 版本 | 说明 |
|-----|------|------|------|
| 核心框架 | React | 18.x | 核心UI框架 |
| 开发语言 | TypeScript | 5.x | 类型安全 |
| UI组件库 | Ant Design | 5.x | 企业级UI组件 |
| 移动端组件 | Ant Design Mobile | 5.x | 移动端H5 |
| 状态管理 | Zustand | 4.x | 轻量级状态管理 |
| 路由管理 | React Router | 6.x | SPA路由 |
| HTTP客户端 | Axios | 1.x | API请求 |
| 构建工具 | Vite | 5.x | 快速构建 |
| CSS方案 | Tailwind CSS + CSS Modules | - | 原子CSS + 模块化 |
| 图表库 | @ant-design/charts | 1.x | 图表组件 |
| 表单 | React Hook Form + Zod | - | 高性能表单 |
| 代码规范 | ESLint + Prettier | - | 代码格式化 |

### 1.2 技术架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         前端技术架构                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           UI Layer                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │ Ant Design│  │  Custom   │  │  Charts   │  │  Icons    │      │
│  │  组件库    │  │  业务组件  │  │  图表库   │  │  图标库   │      │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                         Business Layer                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │  Hooks    │  │  Utils    │  │  Services │  │  Stores   │      │
│  │  业务逻辑  │  │  工具函数  │  │  API服务  │  │  状态管理  │      │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                         Network Layer                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │
│  │  Axios    │  │  WebSocket│  │  Mock     │                     │
│  │  HTTP请求  │  │  实时通信  │  │  数据模拟  │                     │
│  └────────────┘  └────────────┘  └────────────┘                     │
├─────────────────────────────────────────────────────────────────────┤
│                         Build & Dev                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │
│  │   Vite    │  │   Git     │  │   Docker   │                     │
│  │  构建工具  │  │  版本控制  │  │  容器化    │                     │
│  └────────────┘  └────────────┘  └────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 项目结构

### 2.1 目录结构

```
merchant-appeal-frontend/
├── public/                          # 静态资源
│   ├── favicon.ico
│   └── index.html
│
├── src/
│   ├── assets/                      # 资源文件
│   │   ├── images/                  # 图片资源
│   │   ├── styles/                  # 全局样式
│   │   │   ├── variables.css       # CSS变量
│   │   │   ├── reset.css           # 样式重置
│   │   │   └── global.css          # 全局样式
│   │   └── fonts/                  # 字体文件
│   │
│   ├── components/                  # 组件目录
│   │   ├── common/                  # 通用组件
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Card/
│   │   │   ├── Modal/
│   │   │   ├── Table/
│   │   │   ├── Form/
│   │   │   ├── Upload/
│   │   │   ├── StatusTag/
│   │   │   └── Loading/
│   │   │
│   │   ├── layout/                  # 布局组件
│   │   │   ├── BasicLayout/        # 基础布局
│   │   │   ├── BlankLayout/        # 空白布局（登录页）
│   │   │   ├── Header/
│   │   │   ├── Sidebar/
│   │   │   └── Footer/
│   │   │
│   │   └── business/                # 业务组件
│   │       ├── CustomerCard/
│   │       ├── OrderCard/
│   │       ├── ChatBubble/
│   │       ├── DocumentPreview/
│   │       ├── StatsCard/
│   │       └── Timeline/
│   │
│   ├── pages/                       # 页面目录
│   │   ├── Dashboard/               # 仪表盘
│   │   │   ├── index.tsx
│   │   │   ├── components/
│   │   │   │   ├── StatsOverview/
│   │   │   │   ├── CustomerTrend/
│   │   │   │   ├── OrderDistribution/
│   │   │   │   └── RecentOrders/
│   │   │   └── hooks/
│   │   │       └── useDashboard.ts
│   │   │
│   │   ├── customers/               # 客户管理
│   │   │   ├── List/
│   │   │   ├── Detail/
│   │   │   └── Create/
│   │   │
│   │   ├── orders/                 # 订单管理
│   │   │   ├── List/
│   │   │   ├── Detail/
│   │   │   └── Refund/
│   │   │
│   │   ├── chat/                   # AI对话
│   │   │   ├── ChatLayout/
│   │   │   ├── ChatWindow/
│   │   │   ├── CustomerList/
│   │   │   └── MessageInput/
│   │   │
│   │   ├── documents/              # 材料中心
│   │   │   ├── List/
│   │   │   ├── Generate/
│   │   │   ├── Preview/
│   │   │   └── Templates/
│   │   │
│   │   ├── products/               # 商品管理
│   │   │   ├── List/
│   │   │   └── Create/
│   │   │
│   │   ├── stats/                  # 统计报表
│   │   │   ├── Overview/
│   │   │   ├── Customers/
│   │   │   ├── Orders/
│   │   │   └── Revenue/
│   │   │
│   │   ├── settings/               # 系统设置
│   │   │   ├── Account/
│   │   │   ├── Roles/
│   │   │   ├── Payment/
│   │   │   └── Xianyu/
│   │   │
│   │   └── login/                   # 登录页
│   │       └── index.tsx
│   │
│   ├── services/                    # API服务层
│   │   ├── api/                    # API定义
│   │   │   ├── customer.ts
│   │   │   ├── order.ts
│   │   │   ├── chat.ts
│   │   │   ├── document.ts
│   │   │   ├── product.ts
│   │   │   ├── stats.ts
│   │   │   ├── auth.ts
│   │   │   └── types.ts           # API类型定义
│   │   │
│   │   ├── http/                    # HTTP配置
│   │   │   ├── axios.ts           # Axios实例
│   │   │   ├── request.ts         # 请求封装
│   │   │   ├── response.ts        # 响应处理
│   │   │   └── errorHandler.ts    # 错误处理
│   │   │
│   │   └── websocket/              # WebSocket服务
│   │       ├── socket.ts
│   │       └── useChatSocket.ts
│   │
│   ├── stores/                      # 状态管理
│   │   ├── userStore.ts           # 用户状态
│   │   ├── customerStore.ts       # 客户状态
│   │   ├── orderStore.ts         # 订单状态
│   │   ├── chatStore.ts          # 对话状态
│   │   └── appStore.ts           # 应用状态
│   │
│   ├── hooks/                      # 自定义Hooks
│   │   ├── useRequest.ts          # 请求Hook
│   │   ├── usePagination.ts       # 分页Hook
│   │   ├── useModal.ts            # 弹窗Hook
│   │   ├── useDict.ts             # 数据字典
│   │   └── usePermission.ts       # 权限Hook
│   │
│   ├── utils/                      # 工具函数
│   │   ├── format.ts              # 格式化工具
│   │   ├── validate.ts            # 校验工具
│   │   ├── storage.ts             # 本地存储
│   │   ├── clipboard.ts           # 剪贴板
│   │   └── download.ts            # 下载工具
│   │
│   ├── constants/                  # 常量定义
│   │   ├── index.ts               # 全局常量
│   │   ├── enums.ts               # 枚举值
│   │   └── routes.ts              # 路由常量
│   │
│   ├── types/                      # TypeScript类型
│   │   ├── global.d.ts            # 全局类型声明
│   │   ├── customer.ts
│   │   ├── order.ts
│   │   ├── chat.ts
│   │   └── document.ts
│   │
│   ├── router/                     # 路由配置
│   │   ├── index.tsx              # 路由入口
│   │   ├── routes.ts              # 路由定义
│   │   ├── guards.ts              # 路由守卫
│   │   └──懒加载.tsx              # 懒加载配置
│   │
│   ├── App.tsx                     # 根组件
│   └── main.tsx                    # 入口文件
│
├── .env                            # 环境变量
├── .env.development                # 开发环境变量
├── .env.production                 # 生产环境变量
├── .eslintrc.js                    # ESLint配置
├── .prettierrc                     # Prettier配置
├── tsconfig.json                   # TypeScript配置
├── vite.config.ts                  # Vite配置
├── tailwind.config.js              # Tailwind配置
├── postcss.config.js               # PostCSS配置
├── package.json
└── README.md
```

### 2.2 项目初始化命令

```bash
# 创建项目
npm create vite@latest merchant-appeal-frontend -- --template react-ts

# 进入目录
cd merchant-appeal-frontend

# 安装依赖
npm install

# 安装业务依赖
npm install antd @ant-design/icons @ant-design/charts
npm install react-router-dom
npm install zustand
npm install axios
npm install react-hook-form @hookform/resolvers zod
npm install dayjs
npm install lodash
npm install clsx tailwind-merge

# 开发依赖
npm install -D tailwindcss postcss autoprefixer
npm install -D eslint @typescript-eslint/eslint-plugin
npm install -D prettier
npm install -D @types/lodash
```

---

## 3. 核心配置

### 3.1 环境变量配置

```typescript
// .env.development
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_APP_TITLE=商户号申诉系统
VITE_APP_ENV=development
VITE_ENABLE_MOCK=false

// .env.production
VITE_API_BASE_URL=https://api.merchant-appeal.com/api/v1
VITE_APP_TITLE=商户号申诉系统
VITE_APP_ENV=production
VITE_ENABLE_MOCK=false
```

### 3.2 Vite配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { viteConfig } from './vite.config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'antd': ['antd', '@ant-design/icons'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
```

### 3.3 TypeScript配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@pages/*": ["./src/pages/*"],
      "@services/*": ["./src/services/*"],
      "@stores/*": ["./src/stores/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@utils/*": ["./src/utils/*"],
      "@constants/*": ["./src/constants/*"],
      "@types/*": ["./src/types/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3.4 Tailwind配置

```javascript
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          dark: '#1D4ED8',
          light: '#3B82F6',
        },
        success: {
          DEFAULT: '#059669',
          light: '#10B981',
        },
        warning: {
          DEFAULT: '#D97706',
          light: '#F59E0B',
        },
        error: {
          DEFAULT: '#DC2626',
          light: '#EF4444',
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
    },
  },
  plugins: [],
}
```

---

## 4. 核心组件开发规范

### 4.1 通用组件模板

```typescript
// components/common/Button/index.tsx
import React from 'react'
import { Button as AntButton, ButtonProps } from 'antd'
import classNames from 'classnames'
import styles from './index.module.css'

interface CustomButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'text'
  size?: 'sm' | 'md' | 'lg'
}

export const Button: React.FC<CustomButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  return (
    <AntButton
      className={classNames(
        styles.button,
        styles[variant],
        styles[size],
        className
      )}
      {...props}
    >
      {children}
    </AntButton>
  )
}

export default Button
```

```css
/* components/common/Button/index.module.css */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border-radius: 6px;
  transition: all 0.2s ease-out;
}

.button:active {
  transform: scale(0.98);
}

.primary {
  background-color: #2563EB;
  border-color: #2563EB;
  color: white;
}

.primary:hover {
  background-color: #1D4ED8;
  border-color: #1D4ED8;
}

.secondary {
  background-color: transparent;
  border-color: #D1D5DB;
  color: #374151;
}

.secondary:hover {
  border-color: #2563EB;
  color: #2563EB;
}

.danger {
  background-color: #DC2626;
  border-color: #DC2626;
  color: white;
}

.danger:hover {
  background-color: #B91C1C;
  border-color: #B91C1C;
}

.text {
  background-color: transparent;
  border-color: transparent;
  color: #2563EB;
}

.text:hover {
  background-color: rgba(37, 99, 235, 0.1);
}

.sm {
  height: 28px;
  padding: 0 12px;
  font-size: 13px;
}

.md {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
}

.lg {
  height: 44px;
  padding: 0 24px;
  font-size: 16px;
}
```

### 4.2 业务组件示例 - StatsCard

```typescript
// components/business/StatsCard/index.tsx
import React from 'react'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import classNames from 'classnames'
import styles from './index.module.css'

interface StatsCardProps {
  title: string
  value: string | number
  prefix?: React.ReactNode
  suffix?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  loading?: boolean
  onClick?: () => void
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  prefix,
  suffix,
  trend,
  loading = false,
  onClick,
}) => {
  return (
    <div
      className={classNames(styles.card, onClick && styles.clickable)}
      onClick={onClick}
    >
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {trend && (
          <span
            className={classNames(
              styles.trend,
              trend.isPositive ? styles.positive : styles.negative
            )}
          >
            {trend.isPositive ? (
              <ArrowUpOutlined />
            ) : (
              <ArrowDownOutlined />
            )}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className={styles.content}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <span className={styles.value}>{value}</span>
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </div>
  )
}
```

```css
/* components/business/StatsCard/index.module.css */
.card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease-out;
}

.card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  transform: translateY(-2px);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title {
  color: #6B7280;
  font-size: 14px;
}

.trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
}

.positive {
  color: #059669;
}

.negative {
  color: #DC2626;
}

.content {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.prefix {
  color: #374151;
  font-size: 14px;
}

.value {
  color: #111827;
  font-size: 28px;
  font-weight: 700;
}

.suffix {
  color: #6B7280;
  font-size: 14px;
}
```

### 4.3 聊天消息组件

```typescript
// components/business/ChatBubble/index.tsx
import React from 'react'
import { Avatar } from 'antd'
import classNames from 'classnames'
import styles from './index.module.css'

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  avatar?: string
  timestamp?: string
  feedback?: 'like' | 'dislike' | null
  onFeedback?: (type: 'like' | 'dislike') => void
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role,
  content,
  avatar,
  timestamp,
  feedback,
  onFeedback,
}) => {
  const isUser = role === 'user'
  const isAssistant = role === 'assistant'

  return (
    <div
      className={classNames(
        styles.bubbleContainer,
        isUser ? styles.userBubble : styles.assistantBubble
      )}
    >
      {!isUser && (
        <Avatar
          src={avatar || '/static/avatar-assistant.png'}
          className={styles.avatar}
        />
      )}

      <div className={styles.bubbleWrapper}>
        <div
          className={classNames(
            styles.bubble,
            isUser ? styles.userBubbleContent : styles.assistantBubbleContent
          )}
        >
          {content}
        </div>

        {isAssistant && (
          <div className={styles.actions}>
            {timestamp && (
              <span className={styles.timestamp}>{timestamp}</span>
            )}
            {feedback && (
              <div className={styles.feedback}>
                <span
                  className={classNames(
                    styles.feedbackItem,
                    feedback === 'like' && styles.active
                  )}
                  onClick={() => onFeedback?.('like')}
                >
                  👍
                </span>
                <span
                  className={classNames(
                    styles.feedbackItem,
                    feedback === 'dislike' && styles.active
                  )}
                  onClick={() => onFeedback?.('dislike')}
                >
                  👎
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <Avatar
          src={avatar || '/static/avatar-user.png'}
          className={styles.avatar}
        />
      )}
    </div>
  )
}
```

```css
/* components/business/ChatBubble/index.module.css */
.bubbleContainer {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  max-width: 80%;
}

.userBubble {
  margin-left: auto;
  flex-direction: row-reverse;
}

.assistantBubble {
  margin-right: auto;
}

.avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
}

.bubbleWrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.userBubble .bubbleWrapper {
  align-items: flex-end;
}

.bubble {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.userBubbleContent {
  background-color: #2563EB;
  color: white;
  border-bottom-right-radius: 4px;
}

.assistantBubbleContent {
  background-color: #F3F4F6;
  color: #111827;
  border-bottom-left-radius: 4px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.timestamp {
  font-size: 12px;
  color: #9CA3AF;
}

.feedback {
  display: flex;
  gap: 4px;
}

.feedbackItem {
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.feedbackItem:hover,
.feedbackItem.active {
  opacity: 1;
}
```

---

## 5. API服务层开发

### 5.1 HTTP请求封装

```typescript
// services/http/axios.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { message } from 'antd'

const baseURL = import.meta.env.VITE_API_BASE_URL

export const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    const { code, data, message: msg } = response.data

    if (code === 200) {
      return data
    }

    if (code === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(new Error('未授权'))
    }

    message.error(msg || '请求失败')
    return Promise.reject(new Error(msg || '请求失败'))
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 400:
          message.error(data.message || '参数错误')
          break
        case 401:
          localStorage.removeItem('token')
          window.location.href = '/login'
          message.error('登录已过期')
          break
        case 403:
          message.error('没有权限')
          break
        case 404:
          message.error('请求资源不存在')
          break
        case 500:
          message.error('服务器错误')
          break
        default:
          message.error(data.message || '网络错误')
      }
    } else {
      message.error('网络连接失败')
    }

    return Promise.reject(error)
  }
)
```

### 5.2 API服务定义

```typescript
// services/api/types.ts

// 通用响应类型
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp: string
  request_id: string
}

// 分页请求参数
export interface PaginationParams {
  page: number
  pageSize: number
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 客户类型
export interface Customer {
  id: number
  xianyu_nick: string
  xianyu_user_id?: string
  wechat_openid?: string
  merchant_id?: string
  merchant_id_type: 'wechat' | 'alipay' | 'both'
  merchant_type: '普通商户' | '特约商户' | '服务商' | '二级商户'
  subject_type: '企业' | '个体工商户' | '党政机关' | '事业单位' | '其他组织'
  company_name?: string
  legal_person?: string
  phone?: string
  risk_type?: string
  risk_level?: 'warning' | 'limited' | 'closed'
  info_status: 'pending' | 'collecting' | 'completed' | 'insufficient'
  customer_status: 'potential' | 'consulting' | 'intentional' | 'purchased' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

// 订单类型
export interface Order {
  id: number
  order_no: string
  customer_id: number
  customer?: Customer
  product_id?: number
  product?: Product
  order_type: 'product' | 'custom' | 'package'
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded'
  total_amount: number
  pay_amount: number
  pay_status: 'unpaid' | 'paid' | 'refunding' | 'refunded'
  pay_method?: 'wechat' | 'alipay' | 'xianyu' | 'bank'
  pay_time?: string
  created_at: string
  updated_at: string
}

// 商品类型
export interface Product {
  id: number
  product_no: string
  name: string
  subtitle?: string
  description?: string
  product_type: 'basic' | 'standard' | 'premium' | 'custom'
  price: number
  risk_types?: string[]
  includes?: string[]
  delivery_type: 'auto' | 'manual' | 'mixed'
  stock: number
  sales_count: number
  rating: number
  is_active: boolean
}

// 对话消息类型
export interface ChatMessage {
  id: number
  customer_id: number
  session_id: string
  platform: 'xianyu' | 'wechat' | 'web' | 'admin'
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type: 'text' | 'image' | 'file' | 'template'
  intent?: string
  entities?: Record<string, any>
  message_type: 'chat' | 'info_request' | 'info_response' | 'recommendation' | 'closing'
  is_ai_generated: boolean
  model_used?: string
  feedback?: 'like' | 'dislike' | null
  created_at: string
}

// 文档类型
export interface Document {
  id: number
  customer_id: number
  order_id?: number
  doc_type: 'appeal_statement' | 'rectification_report' | 'commitment_letter' | 'situation_explanation' | 'material_list' | 'supplementary_note'
  doc_name?: string
  file_url?: string
  doc_status: 'generating' | 'generated' | 'reviewed' | 'approved' | 'rejected'
  generation_type: 'template' | 'ai' | 'mixed'
  version: number
  is_final: boolean
  created_at: string
  updated_at: string
}
```

```typescript
// services/api/customer.ts
import { axiosInstance } from '../http/axios'
import type { Customer, PaginationParams, PaginatedResponse } from './types'

export interface CustomerListParams extends PaginationParams {
  keyword?: string
  customer_status?: string
  risk_level?: string
  start_date?: string
  end_date?: string
}

export interface CreateCustomerData {
  xianyu_nick: string
  merchant_id?: string
  merchant_type?: string
  subject_type?: string
  phone?: string
  [key: string]: any
}

export const customerApi = {
  // 获取客户列表
  list: (params: CustomerListParams) => {
    return axiosInstance.get<PaginatedResponse<Customer[]>>('/customers', { params })
  },

  // 获取客户详情
  getById: (id: number) => {
    return axiosInstance.get<Customer>(`/customers/${id}`)
  },

  // 创建客户
  create: (data: CreateCustomerData) => {
    return axiosInstance.post<Customer>('/customers', data)
  },

  // 更新客户
  update: (id: number, data: Partial<Customer>) => {
    return axiosInstance.put<Customer>(`/customers/${id}`, data)
  },

  // 删除客户
  delete: (id: number) => {
    return axiosInstance.delete(`/customers/${id}`)
  },

  // 更新信息收集状态
  updateInfoStatus: (id: number, info_status: string) => {
    return axiosInstance.put(`/customers/${id}/info-status`, { info_status })
  },

  // 获取客户对话历史
  getConversations: (id: number) => {
    return axiosInstance.get(`/customers/${id}/conversations`)
  },

  // 获取客户文档列表
  getDocuments: (id: number) => {
    return axiosInstance.get(`/customers/${id}/documents`)
  },

  // 添加客户备注
  addNote: (id: number, note: string) => {
    return axiosInstance.post(`/customers/${id}/notes`, { note })
  },
}
```

```typescript
// services/api/order.ts
import { axiosInstance } from '../http/axios'
import type { Order, PaginationParams, PaginatedResponse } from './types'

export interface OrderListParams extends PaginationParams {
  status?: string
  pay_status?: string
  customer_id?: number
  start_date?: string
  end_date?: string
}

export interface CreateOrderData {
  customer_id: number
  product_id?: number
  order_type?: 'product' | 'custom' | 'package'
  customer_note?: string
}

export const orderApi = {
  // 获取订单列表
  list: (params: OrderListParams) => {
    return axiosInstance.get<PaginatedResponse<Order[]>>('/orders', { params })
  },

  // 获取订单详情
  getById: (id: number) => {
    return axiosInstance.get<Order>(`/orders/${id}`)
  },

  // 创建订单
  create: (data: CreateOrderData) => {
    return axiosInstance.post<Order>('/orders', data)
  },

  // 确认订单
  confirm: (id: number) => {
    return axiosInstance.post(`/orders/${id}/confirm`)
  },

  // 取消订单
  cancel: (id: number, reason?: string) => {
    return axiosInstance.post(`/orders/${id}/cancel`, { reason })
  },

  // 发起支付
  pay: (id: number, pay_method: 'wechat' | 'alipay') => {
    return axiosInstance.post<{ pay_url: string }>(`/orders/${id}/pay`, { pay_method })
  },

  // 交付订单
  deliver: (id: number) => {
    return axiosInstance.post(`/orders/${id}/deliver`)
  },

  // 申请退款
  refund: (id: number, reason: string) => {
    return axiosInstance.post<{ refund_id: string }>(`/orders/${id}/refund`, { reason })
  },

  // 获取订单文档
  getDocuments: (id: number) => {
    return axiosInstance.get(`/orders/${id}/documents`)
  },
}
```

```typescript
// services/api/chat.ts
import { axiosInstance } from '../http/axios'
import type { ChatMessage } from './types'

export interface SendMessageData {
  customer_id: number
  content: string
  session_id?: string
}

export interface ChatResponse {
  message: ChatMessage
  session_id: string
  suggestions?: string[]
}

export const chatApi = {
  // 发送消息
  send: (data: SendMessageData) => {
    return axiosInstance.post<ChatResponse>('/chat', data)
  },

  // 获取对话历史
  getHistory: (customerId: number, sessionId?: string) => {
    return axiosInstance.get<ChatMessage[]>(`/chat/history/${customerId}`, {
      params: { session_id: sessionId },
    })
  },

  // 提交对话反馈
  submitFeedback: (messageId: number, feedback: 'like' | 'dislike') => {
    return axiosInstance.post('/chat/feedback', { message_id: messageId, feedback })
  },

  // 意图识别
  recognizeIntent: (content: string) => {
    return axiosInstance.post<{ intent: string; entities: Record<string, any> }>('/chat/intent', { content })
  },

  // 获取会话列表
  getSessions: (customerId: number) => {
    return axiosInstance.get<{ session_id: string; last_message: string; updated_at: string }[]>(
      `/chat/sessions/${customerId}`
    )
  },
}
```

```typescript
// services/api/document.ts
import { axiosInstance } from '../http/axios'
import type { Document } from './types'
import axios from 'axios'

export interface GenerateDocumentData {
  customer_id: number
  order_id?: number
  doc_type: string
  requirements?: string
}

export interface DocumentListParams {
  customer_id?: number
  order_id?: number
  doc_type?: string
  doc_status?: string
  page?: number
  pageSize?: number
}

export const documentApi = {
  // 获取文档列表
  list: (params: DocumentListParams) => {
    return axiosInstance.get<{ list: Document[]; total: number }>('/documents', { params })
  },

  // 获取文档详情
  getById: (id: number) => {
    return axiosInstance.get<Document>(`/documents/${id}`)
  },

  // 生成文档
  generate: (data: GenerateDocumentData) => {
    return axiosInstance.post<Document>('/documents/generate', data)
  },

  // 更新文档
  update: (id: number, data: Partial<Document>) => {
    return axiosInstance.put<Document>(`/documents/${id}`, data)
  },

  // 审核文档
  review: (id: number, status: 'approved' | 'rejected', note?: string) => {
    return axiosInstance.post(`/documents/${id}/review`, { status, note })
  },

  // 重新生成
  regenerate: (id: number, requirements?: string) => {
    return axiosInstance.post<Document>(`/documents/${id}/regenerate`, { requirements })
  },

  // 下载文档
  download: async (id: number) => {
    const response = await axiosInstance.get<{ download_url: string }>(`/documents/${id}/download`)
    window.open(response.download_url, '_blank')
  },

  // 获取模板列表
  getTemplates: () => {
    return axiosInstance.get<{ id: number; name: string; type: string }[]>('/documents/templates')
  },
}
```

---

## 6. 状态管理

### 6.1 用户状态

```typescript
// stores/userStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar?: string
  role: 'admin' | 'staff' | 'owner'
  permissions: string[]
}

interface UserState {
  token: string | null
  userInfo: UserInfo | null
  isAuthenticated: boolean

  setToken: (token: string) => void
  setUserInfo: (userInfo: UserInfo) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      token: null,
      userInfo: null,
      isAuthenticated: false,

      setToken: (token) => set({ token, isAuthenticated: true }),

      setUserInfo: (userInfo) => set({ userInfo, isAuthenticated: true }),

      logout: () =>
        set({
          token: null,
          userInfo: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        token: state.token,
        userInfo: state.userInfo,
      }),
    }
  )
)
```

### 6.2 客户状态

```typescript
// stores/customerStore.ts
import { create } from 'zustand'
import type { Customer } from '@/services/api/types'

interface CustomerState {
  customers: Customer[]
  currentCustomer: Customer | null
  loading: boolean
  pagination: {
    page: number
    pageSize: number
    total: number
  }

  setCustomers: (customers: Customer[]) => void
  setCurrentCustomer: (customer: Customer | null) => void
  setLoading: (loading: boolean) => void
  setPagination: (pagination: Partial<CustomerState['pagination']>) => void
  updateCustomer: (id: number, data: Partial<Customer>) => void
  addCustomer: (customer: Customer) => void
  removeCustomer: (id: number) => void
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  currentCustomer: null,
  loading: false,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
  },

  setCustomers: (customers) => set({ customers }),

  setCurrentCustomer: (currentCustomer) => set({ currentCustomer }),

  setLoading: (loading) => set({ loading }),

  setPagination: (pagination) =>
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    })),

  updateCustomer: (id, data) =>
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
      currentCustomer:
        state.currentCustomer?.id === id
          ? { ...state.currentCustomer, ...data }
          : state.currentCustomer,
    })),

  addCustomer: (customer) =>
    set((state) => ({
      customers: [customer, ...state.customers],
    })),

  removeCustomer: (id) =>
    set((state) => ({
      customers: state.customers.filter((c) => c.id !== id),
    })),
}))
```

### 6.3 对话状态

```typescript
// stores/chatStore.ts
import { create } from 'zustand'
import type { ChatMessage } from '@/services/api/types'

interface ChatState {
  messages: ChatMessage[]
  currentSessionId: string | null
  currentCustomerId: number | null
  loading: boolean
  sending: boolean

  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: number, data: Partial<ChatMessage>) => void
  setCurrentSession: (sessionId: string | null, customerId: number | null) => void
  setLoading: (loading: boolean) => void
  setSending: (sending: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  currentSessionId: null,
  currentCustomerId: null,
  loading: false,
  sending: false,

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id, data) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...data } : m
      ),
    })),

  setCurrentSession: (sessionId, customerId) =>
    set({ currentSessionId: sessionId, currentCustomerId: customerId }),

  setLoading: (loading) => set({ loading }),

  setSending: (sending) => set({ sending }),

  clearMessages: () => set({ messages: [] }),
}))
```

---

## 7. 路由配置

### 7.1 路由定义

```typescript
// router/routes.ts
import type { RouteObject } from 'react-router-dom'

export interface RouteConfig extends RouteObject {
  title?: string
  icon?: React.ReactNode
  permission?: string[]
  isMenu?: boolean
  children?: RouteConfig[]
}

export const routes: RouteConfig[] = [
  {
    path: '/login',
    title: '登录',
    isMenu: false,
  },
  {
    path: '/',
    title: '首页',
    isMenu: true,
    children: [
      {
        path: '/dashboard',
        title: '仪表盘',
        isMenu: true,
      },
      {
        path: '/customers',
        title: '客户管理',
        isMenu: true,
        children: [
          {
            path: '/customers/list',
            title: '客户列表',
            isMenu: true,
          },
          {
            path: '/customers/create',
            title: '新建客户',
            isMenu: false,
          },
          {
            path: '/customers/:id',
            title: '客户详情',
            isMenu: false,
          },
        ],
      },
      {
        path: '/orders',
        title: '订单管理',
        isMenu: true,
        children: [
          {
            path: '/orders/list',
            title: '订单列表',
            isMenu: true,
          },
          {
            path: '/orders/:id',
            title: '订单详情',
            isMenu: false,
          },
        ],
      },
      {
        path: '/chat',
        title: 'AI对话',
        isMenu: true,
      },
      {
        path: '/documents',
        title: '材料中心',
        isMenu: true,
        children: [
          {
            path: '/documents/list',
            title: '材料列表',
            isMenu: true,
          },
          {
            path: '/documents/generate',
            title: '生成材料',
            isMenu: true,
          },
          {
            path: '/documents/templates',
            title: '模板管理',
            isMenu: true,
          },
        ],
      },
      {
        path: '/products',
        title: '商品管理',
        isMenu: true,
      },
      {
        path: '/stats',
        title: '统计报表',
        isMenu: true,
        children: [
          {
            path: '/stats/overview',
            title: '数据概览',
            isMenu: true,
          },
          {
            path: '/stats/customers',
            title: '客户分析',
            isMenu: true,
          },
          {
            path: '/stats/orders',
            title: '订单分析',
            isMenu: true,
          },
          {
            path: '/stats/revenue',
            title: '营收分析',
            isMenu: true,
          },
        ],
      },
      {
        path: '/settings',
        title: '系统设置',
        isMenu: true,
        children: [
          {
            path: '/settings/account',
            title: '账号管理',
            isMenu: true,
          },
          {
            path: '/settings/roles',
            title: '角色权限',
            isMenu: true,
          },
          {
            path: '/settings/payment',
            title: '支付配置',
            isMenu: true,
          },
          {
            path: '/settings/xianyu',
            title: '闲鱼配置',
            isMenu: true,
          },
        ],
      },
    ],
  },
]
```

### 7.2 路由守卫

```typescript
// router/guards.ts
import { Navigate, useLocation } from 'react-router-dom'
import { useUserStore } from '@/stores/userStore'

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useUserStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export const GuestGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useUserStore()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
```

### 7.3 路由入口

```typescript
// router/index.tsx
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { routes } from './routes'
import { AuthGuard } from './guards'
import { BasicLayout } from '@/components/layout/BasicLayout'

const generateRouteElement = (route: any) => {
  const element = route.element ? (
    route.element
  ) : route.isMenu ? (
    <BasicLayout>{route.children?.map(generateRouteElement)}</BasicLayout>
  ) : null

  if (route.permission) {
    return <AuthGuard>{element}</AuthGuard>
  }

  return element
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: routeElement(routes.find(r => r.path === '/login')),
  },
  ...routes
    .find(r => r.path === '/')
    ?.children?.map((route: any) => ({
      ...route,
      element: <BasicLayout>{route.children?.map(generateRouteElement)}</BasicLayout>,
    })) || [],
])

export const Router: React.FC = () => {
  return <RouterProvider router={router} />
}
```

---

## 8. 页面开发示例

### 8.1 仪表盘页面

```typescript
// pages/Dashboard/index.tsx
import React, { useEffect } from 'react'
import { Row, Col, Card, Spin } from 'antd'
import {
  UserOutlined,
  DollarOutlined,
  RiseOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { StatsCard } from '@/components/business/StatsCard'
import { RecentOrders } from './components/RecentOrders'
import { CustomerTrend } from './components/CustomerTrend'
import { OrderDistribution } from './components/OrderDistribution'
import { useDashboard } from './hooks/useDashboard'
import styles from './index.module.css'

export const Dashboard: React.FC = () => {
  const { stats, loading, fetchStats } = useDashboard()

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>仪表盘</h1>
        <span className={styles.date}>
          {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[24, 24]} className={styles.statsRow}>
          <Col xs={24} sm={12} lg={6}>
            <StatsCard
              title="总客户数"
              value={stats?.total_customers || 0}
              prefix={<UserOutlined />}
              trend={{ value: 12, isPositive: true }}
              onClick={() => window.location.href = '/customers/list'}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatsCard
              title="本月收入"
              value={stats?.monthly_revenue || 0}
              prefix="¥"
              trend={{ value: 8.3, isPositive: true }}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatsCard
              title="转化率"
              value={stats?.conversion_rate || 0}
              suffix="%"
              trend={{ value: 3.2, isPositive: true }}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatsCard
              title="申诉成功率"
              value={stats?.appeal_success_rate || 0}
              suffix="%"
              trend={{ value: 5.1, isPositive: true }}
            />
          </Col>
        </Row>

        <Row gutter={[24, 24]} className={styles.chartsRow}>
          <Col xs={24} lg={14}>
            <Card title="客户趋势" className={styles.chartCard}>
              <CustomerTrend data={stats?.customer_trend || []} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="订单状态分布" className={styles.chartCard}>
              <OrderDistribution data={stats?.order_distribution || []} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          <Col span={24}>
            <Card
              title="最新订单"
              extra={
                <a href="/orders/list" className={styles.moreLink}>
                  查看更多
                </a>
              }
            >
              <RecentOrders orders={stats?.recent_orders || []} />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}

export default Dashboard
```

```typescript
// pages/Dashboard/hooks/useDashboard.ts
import { useCallback, useState } from 'react'
import { statsApi } from '@/services/api/stats'

interface DashboardStats {
  total_customers: number
  monthly_revenue: number
  conversion_rate: number
  appeal_success_rate: number
  customer_trend: { date: string; count: number }[]
  order_distribution: { status: string; count: number }[]
  recent_orders: any[]
}

export const useDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await statsApi.getOverview()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    stats,
    loading,
    fetchStats,
  }
}
```

### 8.2 客户列表页面

```typescript
// pages/customers/List/index.tsx
import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Dropdown,
  Modal,
  message,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { customerApi, CustomerListParams } from '@/services/api/customer'
import type { Customer } from '@/services/api/types'
import { useCustomerStore } from '@/stores/customerStore'
import styles from './index.module.css'

const STATUS_COLORS: Record<string, string> = {
  potential: 'default',
  consulting: 'processing',
  intentional: 'warning',
  purchased: 'success',
  completed: 'success',
  failed: 'error',
}

const STATUS_TEXT: Record<string, string> = {
  potential: '潜在客户',
  consulting: '咨询中',
  intentional: '有意向',
  purchased: '已购买',
  completed: '已完成',
  failed: '失败',
}

export const CustomerList: React.FC = () => {
  const navigate = useNavigate()
  const { customers, pagination, setCustomers, setPagination } = useCustomerStore()
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params: CustomerListParams = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        keyword: keyword || undefined,
        customer_status: statusFilter || undefined,
      }
      const res = await customerApi.list(params)
      setCustomers(res.list)
      setPagination({ total: res.total })
    } catch (error) {
      message.error('获取客户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [pagination.page, pagination.pageSize, statusFilter])

  const handleSearch = () => {
    setPagination({ page: 1 })
    fetchCustomers()
  }

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      onOk: async () => {
        try {
          await customerApi.delete(id)
          message.success('删除成功')
          fetchCustomers()
        } catch (error) {
          message.error('删除失败')
        }
      },
    })
  }

  const columns = [
    {
      title: '客户信息',
      dataIndex: 'xianyu_nick',
      key: 'xianyu_nick',
      render: (nick: string, record: Customer) => (
        <div className={styles.customerCell}>
          <span className={styles.nick}>{nick}</span>
          <span className={styles.merchant}>{record.merchant_id || '-'}</span>
        </div>
      ),
    },
    {
      title: '商户类型',
      dataIndex: 'merchant_type',
      key: 'merchant_type',
    },
    {
      title: '主体类型',
      dataIndex: 'subject_type',
      key: 'subject_type',
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      render: (level: string) => {
        const colors: Record<string, string> = {
          warning: 'orange',
          limited: 'red',
          closed: 'red',
        }
        return level ? <Tag color={colors[level]}>{level}</Tag> : '-'
      },
    },
    {
      title: '状态',
      dataIndex: 'customer_status',
      key: 'customer_status',
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_TEXT[status]}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Customer) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/customers/${record.id}`)}
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/customers/${record.id}?action=edit`)}
          />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除',
                  danger: true,
                  onClick: () => handleDelete(record.id),
                },
              ],
            }}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>客户管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/customers/create')}
        >
          新建客户
        </Button>
      </div>

      <div className={styles.filters}>
        <Space>
          <Input.Search
            placeholder="搜索客户名称/商户号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 260 }}
            allowClear
          />
          <Button onClick={() => setStatusFilter('')}>全部</Button>
          {Object.entries(STATUS_TEXT).map(([value, text]) => (
            <Button
              key={value}
              type={statusFilter === value ? 'primary' : 'default'}
              onClick={() => setStatusFilter(value)}
            >
              {text}
            </Button>
          ))}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={customers}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination({ page, pageSize })
          },
        }}
      />
    </div>
  )
}

export default CustomerList
```

### 8.3 AI对话页面

```typescript
// pages/chat/ChatLayout/index.tsx
import React, { useEffect, useState, useRef } from 'react'
import { Input, Button, Spin, Empty } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { ChatBubble } from '@/components/business/ChatBubble'
import { CustomerList } from './CustomerList'
import { useChatStore } from '@/stores/chatStore'
import { chatApi, SendMessageData } from '@/services/api/chat'
import { useCustomerStore } from '@/stores/customerStore'
import styles from './index.module.css'

export const ChatLayout: React.FC = () => {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    currentCustomerId,
    loading,
    sending,
    setMessages,
    addMessage,
    setCurrentSession,
    setLoading,
    setSending,
  } = useChatStore()

  const { customers } = useCustomerStore()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleCustomerSelect = async (customerId: number) => {
    setLoading(true)
    setCurrentSession(`session_${customerId}_${Date.now()}`, customerId)

    try {
      const history = await chatApi.getHistory(customerId)
      setMessages(history)
    } catch (error) {
      console.error('Failed to fetch chat history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentCustomerId || sending) return

    const messageData: SendMessageData = {
      customer_id: currentCustomerId,
      content: inputValue.trim(),
    }

    setInputValue('')
    setSending(true)

    try {
      const userMessage = {
        id: Date.now(),
        customer_id: currentCustomerId,
        role: 'user' as const,
        content: messageData.content,
        created_at: new Date().toISOString(),
      }
      addMessage(userMessage)

      const response = await chatApi.send(messageData)
      addMessage(response.message)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFeedback = async (messageId: number, type: 'like' | 'dislike') => {
    try {
      await chatApi.submitFeedback(messageId, type)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    }
  }

  return (
    <div className={styles.chatLayout}>
      <div className={styles.customerPanel}>
        <div className={styles.panelHeader}>
          <h3>客户列表</h3>
        </div>
        <CustomerList
          customers={customers}
          selectedId={currentCustomerId}
          onSelect={handleCustomerSelect}
        />
      </div>

      <div className={styles.chatPanel}>
        <div className={styles.chatHeader}>
          <h3>AI对话</h3>
          <span className={styles.hint}>AI助手将帮助您与客户沟通</span>
        </div>

        <div className={styles.messagesArea}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <Spin size="large" />
            </div>
          ) : messages.length === 0 ? (
            <Empty
              description="选择客户开始对话"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                feedback={msg.feedback || null}
                onFeedback={
                  msg.role === 'assistant' ? () => handleFeedback(msg.id, 'like') : undefined
                }
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <div className={styles.quickReplies}>
            <span className={styles.quickLabel}>快捷回复：</span>
            <Button
              size="small"
              onClick={() => setInputValue('请问您的商户号是被限制收款了，还是完全无法使用了？')}
            >
              商户号状态
            </Button>
            <Button
              size="small"
              onClick={() => setInputValue('请提供一下您的商户号和营业执照信息')}
            >
              收集信息
            </Button>
          </div>
          <div className={styles.inputRow}>
            <Input.TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={!currentCustomerId || sending}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !currentCustomerId || sending}
              loading={sending}
            >
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatLayout
```

---

## 9. 常用Hooks

### 9.1 分页Hook

```typescript
// hooks/usePagination.ts
import { useState, useCallback } from 'react'

interface UsePaginationOptions {
  defaultPageSize?: number
  onChange?: (page: number, pageSize: number) => void
}

export const usePagination = (options?: UsePaginationOptions) => {
  const { defaultPageSize = 20, onChange } = options || {}

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const changePage = useCallback(
    (newPage: number, newPageSize?: number) => {
      if (newPageSize && newPageSize !== pageSize) {
        setPageSize(newPageSize)
        setPage(1)
        onChange?.(1, newPageSize)
      } else {
        setPage(newPage)
        onChange?.(newPage, pageSize)
      }
    },
    [pageSize, onChange]
  )

  const reset = useCallback(() => {
    setPage(1)
    setPageSize(defaultPageSize)
  }, [defaultPageSize])

  return {
    page,
    pageSize,
    changePage,
    reset,
    pagination: {
      current: page,
      pageSize,
      onChange: changePage,
    },
  }
}
```

### 9.2 请求Hook

```typescript
// hooks/useRequest.ts
import { useState, useCallback } from 'react'

interface UseRequestOptions<T> {
  manual?: boolean
  defaultParams?: any[]
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export const useRequest = <T>(
  service: (...args: any[]) => Promise<T>,
  options?: UseRequestOptions<T>
) => {
  const { manual = false, defaultParams = [], onSuccess, onError } = options || {}

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!manual)
  const [error, setError] = useState<Error | null>(null)

  const run = useCallback(
    async (...params: any[]) => {
      setLoading(true)
      setError(null)

      try {
        const result = await service(...params)
        setData(result)
        onSuccess?.(result)
        return result
      } catch (err) {
        const error = err as Error
        setError(error)
        onError?.(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [service, onSuccess, onError]
  )

  const mutate = useCallback((newData: T | ((old: T | null) => T)) => {
    setData((prev) =>
      typeof newData === 'function'
        ? (newData as Function)(prev)
        : newData
    )
  }, [])

  return {
    data,
    loading,
    error,
    run,
    mutate,
  }
}
```

### 9.3 弹窗Hook

```typescript
// hooks/useModal.ts
import { useState, useCallback } from 'react'
import { Modal } from 'antd'

interface UseModalOptions {
  onOk?: () => void | Promise<void>
  onCancel?: () => void
}

export const useModal = (options?: UseModalOptions) => {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  const open = useCallback(() => setVisible(true), [])
  const close = useCallback(() => setVisible(false), [])

  const confirm = useCallback(async () => {
    setLoading(true)
    try {
      await options?.onOk?.()
      close()
    } finally {
      setLoading(false)
    }
  }, [options, close])

  const modal = {
    visible,
    loading,
    open,
    close,
  }

  const ModalComponent = useCallback(
    ({ title, content, ...props }: any) => (
      <Modal
        title={title}
        open={visible}
        onOk={confirm}
        onCancel={close}
        confirmLoading={loading}
        {...props}
      >
        {typeof content === 'function' ? content() : content}
      </Modal>
    ),
    [visible, loading, confirm, close]
  )

  return {
    modal,
    ModalComponent,
  }
}
```

---

## 10. 代码规范

### 10.1 命名规范

```typescript
// 文件命名
// 组件文件：PascalCase
// CustomerList/index.tsx
// useCustomerList.ts (hooks)

// 样式文件：index.module.css

// 变量命名
const customerList: Customer[] = []           // 普通变量：camelCase
const CUSTOMER_STATUS = { ... }              // 常量：UPPER_SNAKE_CASE
const MAX_PAGE_SIZE = 100

// 函数命名
const fetchCustomers = async () => {}         // 异步函数：camelCase
const handleCustomerClick = () => {}         // 事件处理：handle + 动作
const getCustomerById = (id: number) => {}    // 获取函数：get + 目标
const onCustomerSelect = () => {}            // 回调函数：on + 事件

// 类型命名
interface CustomerProps {}                    // Props接口：名称 + Props
interface CustomerState {}                    // State接口：名称 + State
type CustomerCallback = () => void            // 回调类型：名称 + Callback
```

### 10.2 组件规范

```typescript
// 组件文件结构
// 1. 导入
import React from 'react'
import { Button } from 'antd'
import { useCustomerStore } from '@/stores/customerStore'

// 2. 类型定义
interface CustomerCardProps {
  customer: Customer
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
}

// 3. 组件定义
export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onEdit,
  onDelete,
}) => {
  // 3.1 Hooks
  const { deleteCustomer } = useCustomerStore()

  // 3.2 事件处理
  const handleEdit = () => {
    onEdit?.(customer.id)
  }

  // 3.3 辅助函数
  const getStatusColor = (status: string) => {
    // ...
  }

  // 3.4 渲染
  return (
    <div className={styles.card}>
      {/* ... */}
    </div>
  )
}

// 4. 导出
export default CustomerCard
```

### 10.3 Git提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
perf: 性能优化
test: 测试
chore: 构建/工具

提交示例：
feat: 添加客户列表分页功能
fix: 修复聊天消息发送失败问题
docs: 更新README文档
refactor: 重构客户状态管理
```

---

## 11. 开发调试

### 11.1 常用调试命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 代码检查
npm run lint

# 代码格式化
npm run format

# 类型检查
npm run typecheck

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 运行测试
npm run test
```

### 11.2 调试技巧

```typescript
// 1. 使用React DevTools
// 安装React DevTools浏览器扩展

// 2. 使用Zustand DevTools
// 开发环境下自动开启

// 3. 网络请求调试
// 打开浏览器开发者工具 -> Network
// 过滤/api请求查看接口调用

// 4. Console调试
console.log('debug info:', data)
console.error('error:', error)

// 5. 使用断点
debugger
```

---

## 12. 附录

### 12.1 参考资料

| 资源 | 链接 |
|-----|------|
| React | https://react.dev |
| TypeScript | https://www.typescriptlang.org |
| Ant Design | https://ant.design |
| Vite | https://vitejs.dev |
| Zustand | https://zustand-demo.pmnd.rs |
| React Router | https://reactrouter.com |
| Tailwind CSS | https://tailwindcss.com |

### 12.2 组件库速查

| 需求 | 组件 | 文档位置 |
|-----|------|---------|
| 按钮 | Button | antd组件/Button |
| 输入框 | Input, Input.TextArea | antd组件/Input |
| 表格 | Table | antd组件/Table |
| 表单 | Form | antd组件/Form |
| 弹窗 | Modal | antd组件/Modal |
| 消息 | Message | antd组件/Message |
| 标签 | Tag | antd组件/Tag |
| 下拉菜单 | Dropdown | antd组件/Dropdown |
| 分页 | Pagination | antd组件/Pagination |
| 日期选择 | DatePicker | antd组件/DatePicker |
| 选择器 | Select | antd组件/Select |
| 复选框 | Checkbox | antd组件/Checkbox |
| 单选框 | Radio | antd组件/Radio |
| 卡片 | Card | antd组件/Card |
| 头像 | Avatar | antd组件/Avatar |
| 空状态 | Empty | antd组件/Empty |
| 加载 | Spin, Skeleton | antd组件/Spin |

---

## 13. 文档修订记录

| 版本 | 日期 | 修订内容 | 修订人 |
|-----|------|---------|-------|
| V1.0 | 2026-04-13 | 初始版本 | AI产品经理 |
