/**
 * @fileoverview 日程安排管理面板
 * 提供日程的创建、编辑、删除和状态切换功能
 *
 * 核心功能：
 *   - 日程列表：按状态分组显示（待完成/已完成）
 *   - 创建/编辑日程：弹窗表单，支持标题、描述、时间、类型
 *   - 状态切换：一键标记完成/撤销
 *   - 删除日程：确认后删除
 *   - 日程类型：提醒、任务、会议、截止时间
 *
 * 关键依赖：
 *   - adminFetch: 带认证的 fetch 函数
 *   - showToast: 全局 Toast 通知函数
 *   - 后端接口: GET/POST/PUT/DELETE /api/schedules
 *
 * 注意事项：
 *   - scheduledTime 截取前16位用于 datetime-local 输入框格式
 *   - 已完成日程以半透明灰色样式显示
 */
import React, { useState, useEffect } from 'react'
import AdminAiTabLayout from './AdminAiTabLayout.jsx'

/**
 * 日程安排管理面板
 *
 * @param {Object} props
 * @param {Function} props.adminFetch - 带认证的 fetch 函数
 * @param {Function} props.showToast - 全局 Toast 通知函数
 * @returns {JSX.Element} 日程管理面板 UI
 */
export default function SchedulePanel({ adminFetch, showToast }) {
  /** 日程列表数组 */
  const [schedules, setSchedules] = useState([])
  /** 是否正在加载数据 */
  const [loading, setLoading] = useState(true)
  /** 是否显示创建/编辑弹窗 */
  const [showModal, setShowModal] = useState(false)
  /** 当前正在编辑的日程对象，null 表示新建模式 */
  const [editingSchedule, setEditingSchedule] = useState(null)
  /** 表单数据: { title, description, scheduledTime, type, status } */
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledTime: '',
    type: 'reminder',
    status: 'pending'
  })

  useEffect(() => {
    fetchSchedules()
  }, [])

  /** 获取全部日程列表 */
  async function fetchSchedules() {
    setLoading(true)
    try {
      const res = await adminFetch('/api/schedules')
      const data = await res.json()
      setSchedules(data.schedules || [])
    } catch (err) {
      showToast('获取日程失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 提交表单（创建或更新日程）
   * 新建时调用 POST /api/schedules，编辑时调用 PUT /api/schedules/:id
   * @param {Object} e - 表单提交事件
   */
  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const method = editingSchedule ? 'PUT' : 'POST'
      const url = editingSchedule ? `/api/schedules/${editingSchedule.id}` : '/api/schedules'
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        showToast(editingSchedule ? '日程已更新' : '日程已创建', 'success')
        setShowModal(false)
        setEditingSchedule(null)
        resetForm()
        fetchSchedules()
      }
    } catch (err) {
      showToast('保存失败', 'error')
    }
  }

  /**
   * 删除日程
   * @param {number|string} id - 要删除的日程 ID
   */
  async function handleDelete(id) {
    if (!confirm('确定要删除这个日程吗？')) return
    try {
      const res = await adminFetch(`/api/schedules/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('日程已删除', 'success')
        fetchSchedules()
      }
    } catch (err) {
      showToast('删除失败', 'error')
    }
  }

  /**
   * 切换日程状态（pending ↔ completed）
   * @param {number|string} id - 日程 ID
   * @param {string} currentStatus - 当前状态
   */
  async function handleToggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    try {
      const res = await adminFetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        showToast('状态已更新', 'success')
        fetchSchedules()
      }
    } catch (err) {
      showToast('更新失败', 'error')
    }
  }

  /** 重置表单为默认值（用于新建模式） */
  function resetForm() {
    setFormData({
      title: '',
      description: '',
      scheduledTime: '',
      type: 'reminder',
      status: 'pending'
    })
  }

  /**
   * 打开编辑弹窗，填充表单数据
   * @param {Object} schedule - 要编辑的日程对象
   */
  function openEditModal(schedule) {
    setEditingSchedule(schedule)
    setFormData({
      title: schedule.title,
      description: schedule.description || '',
      scheduledTime: schedule.scheduledTime?.slice(0, 16) || '',
      type: schedule.type || 'reminder',
      status: schedule.status || 'pending'
    })
    setShowModal(true)
  }

  /** 打开新建弹窗 */
  function openCreateModal() {
    setEditingSchedule(null)
    resetForm()
    setShowModal(true)
  }

  /**
   * 获取状态对应的 CSS 类名
   * @param {string} status - 日程状态: completed | pending | cancelled
   * @returns {string} Tailwind CSS 类名
   */
  function getStatusColor(status) {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  /**
   * 获取类型对应的图标 emoji
   * @param {string} type - 日程类型: task | meeting | deadline | reminder
   * @returns {string} Emoji 图标
   */
  function getTypeIcon(type) {
    switch (type) {
      case 'task': return '📋'
      case 'meeting': return '📅'
      case 'deadline': return '⏰'
      default: return '🔔'
    }
  }

  const pendingSchedules = schedules.filter(s => s.status === 'pending')
  const completedSchedules = schedules.filter(s => s.status === 'completed')

  return (
    <AdminAiTabLayout
      tabKey="schedule"
      adminFetch={adminFetch}
      showToast={showToast}
      onRefresh={fetchSchedules}
      loading={loading}
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"
    >
      <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">日程安排</h2>
          <p className="text-gray-500 mt-1">管理您的日程和提醒</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span className="text-xl">+</span> 新增日程
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {pendingSchedules.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                待完成 ({pendingSchedules.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingSchedules.map(schedule => (
                  <div key={schedule.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getTypeIcon(schedule.type)}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(schedule.status)}`}>
                          {schedule.status === 'pending' ? '待完成' : schedule.status}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(schedule)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{schedule.title}</h4>
                    {schedule.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{schedule.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        {schedule.scheduledTime ? new Date(schedule.scheduledTime).toLocaleString('zh-CN') : '未设置时间'}
                      </span>
                      <button
                        onClick={() => handleToggleStatus(schedule.id, schedule.status)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        标记完成
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedSchedules.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                已完成 ({completedSchedules.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedSchedules.map(schedule => (
                  <div key={schedule.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-75">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getTypeIcon(schedule.type)}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(schedule.status)}`}>
                          已完成
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <h4 className="font-semibold text-gray-700 mb-1 line-through">{schedule.title}</h4>
                    {schedule.description && (
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{schedule.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        完成时间: {schedule.completedAt ? new Date(schedule.completedAt).toLocaleString('zh-CN') : '-'}
                      </span>
                      <button
                        onClick={() => handleToggleStatus(schedule.id, schedule.status)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        撤销
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {schedules.length === 0 && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无日程</h3>
              <p className="text-gray-500 mb-6">点击上方按钮创建您的第一个日程</p>
              <button
                onClick={openCreateModal}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建日程
              </button>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingSchedule ? '编辑日程' : '新建日程'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="日程标题"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="日程描述（可选）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">时间</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledTime}
                  onChange={e => setFormData({ ...formData, scheduledTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="reminder">提醒</option>
                  <option value="task">任务</option>
                  <option value="meeting">会议</option>
                  <option value="deadline">截止时间</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingSchedule(null) }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingSchedule ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AdminAiTabLayout>
  )
}