import express from 'express'
import { createSchedule, getSchedules, updateSchedule, deleteSchedule } from '../db.js'

const router = express.Router()

// GET /api/schedules - 获取所有日程
router.get('/', async (req, res) => {
  try {
    const schedules = await getSchedules()
    res.json({ schedules })
  } catch (err) {
    console.error('获取日程失败:', err)
    res.status(500).json({ error: '获取日程失败' })
  }
})

// POST /api/schedules - 创建日程
router.post('/', async (req, res) => {
  try {
    const { title, description, scheduledTime, type, status } = req.body
    if (!title || !scheduledTime) {
      return res.status(400).json({ error: '标题和时间是必填的' })
    }
    const id = await createSchedule({ title, description, scheduledTime, type, status })
    res.json({ success: true, id })
  } catch (err) {
    console.error('创建日程失败:', err)
    res.status(500).json({ error: '创建日程失败' })
  }
})

// PUT /api/schedules/:id - 更新日程
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, scheduledTime, type, status } = req.body
    await updateSchedule(id, { title, description, scheduledTime, type, status })
    res.json({ success: true })
  } catch (err) {
    console.error('更新日程失败:', err)
    res.status(500).json({ error: '更新日程失败' })
  }
})

// DELETE /api/schedules/:id - 删除日程
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await deleteSchedule(id)
    res.json({ success: true })
  } catch (err) {
    console.error('删除日程失败:', err)
    res.status(500).json({ error: '删除日程失败' })
  }
})

export default router