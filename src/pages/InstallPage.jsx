import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const InstallPage = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // 配置信息
  const [config, setConfig] = useState({
    dbHost: 'localhost',
    dbPort: '3306',
    dbUser: 'root',
    dbPassword: '',
    dbName: 'merchant_appeal',
    jwtSecret: '',
    encryptKey: '',
    adminUsername: 'admin',
    adminPassword: ''
  })
  
  // 生成随机密钥
  useEffect(() => {
    // 生成JWT密钥
    const generateJwtSecret = () => {
      return Math.random().toString(36).substring(2, 35) + Math.random().toString(36).substring(2, 35)
    }
    
    // 生成加密密钥（64位十六进制）
    const generateEncryptKey = () => {
      return Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')
    }
    
    setConfig(prev => ({
      ...prev,
      jwtSecret: generateJwtSecret(),
      encryptKey: generateEncryptKey()
    }))
  }, [])
  
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setConfig(prev => ({
      ...prev,
      [name]: value
    }))
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const response = await fetch('/api/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('安装成功！正在跳转到登录页面...')
        setTimeout(() => {
          navigate('/admin')
        }, 2000)
      } else {
        setError(data.error || '安装失败，请检查配置')
      }
    } catch (err) {
      setError('网络错误，请检查服务器是否运行')
    } finally {
      setLoading(false)
    }
  }
  
  const validateForm = () => {
    return (
      config.dbHost &&
      config.dbPort &&
      config.dbUser &&
      config.dbPassword &&
      config.dbName &&
      config.jwtSecret &&
      config.encryptKey &&
      config.adminUsername &&
      config.adminPassword
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#07C160] flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">商户号申诉助手 - 安装向导</h1>
          <p className="text-gray-500 mt-2">请按照向导完成系统安装配置</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">系统配置</h2>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`w-8 h-0.5 ${step >= 2 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-4 bg-green-50 text-green-600 rounded-lg">
              {success}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">数据库配置</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">数据库主机</label>
                    <input
                      type="text"
                      name="dbHost"
                      value={config.dbHost}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">数据库端口</label>
                    <input
                      type="text"
                      name="dbPort"
                      value={config.dbPort}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="3306"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">数据库用户名</label>
                    <input
                      type="text"
                      name="dbUser"
                      value={config.dbUser}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="root"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">数据库密码</label>
                    <input
                      type="password"
                      name="dbPassword"
                      value={config.dbPassword}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="请输入密码"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">数据库名称</label>
                    <input
                      type="text"
                      name="dbName"
                      value={config.dbName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="merchant_appeal"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">安全配置</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">JWT密钥</label>
                    <input
                      type="text"
                      name="jwtSecret"
                      value={config.jwtSecret}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="自动生成"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">加密密钥（64位十六进制）</label>
                    <input
                      type="text"
                      name="encryptKey"
                      value={config.encryptKey}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="自动生成"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">管理员配置</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">管理员用户名</label>
                    <input
                      type="text"
                      name="adminUsername"
                      value={config.adminUsername}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="admin"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">管理员密码</label>
                    <input
                      type="password"
                      name="adminPassword"
                      value={config.adminPassword}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-transparent"
                      placeholder="请设置密码"
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading || !validateForm()}
                  className="w-full py-3 px-4 bg-[#07C160] text-white font-medium rounded-lg hover:bg-[#06a853] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      安装中...
                    </>
                  ) : (
                    '开始安装'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
        
        <div className="mt-4 text-center text-xs text-gray-500">
          © 2026 商户号申诉助手 | 版本 2.0.0
        </div>
      </div>
    </div>
  )
}

export default InstallPage