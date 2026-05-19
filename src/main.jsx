/**
 * @fileoverview 应用入口文件
 * @description 初始化 React 根组件并挂载到 DOM
 * @module main
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * 创建 React 应用根节点并渲染 App 组件
 * 使用 React.StrictMode 开启严格模式，帮助发现潜在问题
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
