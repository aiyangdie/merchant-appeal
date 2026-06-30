<template>
  <div class="page with-nav">
    <header class="top">
      <div>
        <h1>我的案件</h1>
        <p class="greet" v-if="user">{{ user.nickname ? `你好，${user.nickname}` : '你好' }}</p>
      </div>
      <router-link to="/profile" class="profile-link">
        <UserAvatar :url="user?.avatarUrl" :name="user?.nickname" :size="40" />
      </router-link>
    </header>

    <div v-if="loading" class="hint"><div class="spinner" />加载中...</div>
    <div v-else-if="error" class="empty card">
      <p>{{ error }}</p>
      <button class="btn-primary" @click="load">重试</button>
    </div>
    <div v-else-if="!cases.length" class="empty card">
      <div class="empty-icon">📂</div>
      <p>还没有案件记录</p>
      <p class="sub">开始咨询后，申诉/尽调进度会显示在这里</p>
      <button class="btn-primary" :disabled="creating" @click="startConsult">
        {{ creating ? '创建中...' : '开始咨询' }}
      </button>
      <p v-if="createMsg" class="create-msg">{{ createMsg }}</p>
    </div>
    <ul v-else class="list">
      <li v-for="s in cases" :key="s.id" class="card item" @click="openChat(s.id)">
        <div class="row">
          <span class="scenario" :class="s.scenario">{{ s.scenarioLabel }}</span>
          <span class="badge" :class="s.status">{{ statusLabel(s.status) }}</span>
        </div>
        <h3 class="title">{{ s.title }}</h3>
        <p v-if="s.preview" class="preview">{{ s.preview }}</p>
        <div class="meta">
          <span>{{ formatTime(s.createdAt) }}</span>
          <span>{{ s.messageCount }} 条对话</span>
        </div>
      </li>
    </ul>

    <button v-if="cases.length && !loading" class="fab" :disabled="creating" @click="startConsult">
      {{ creating ? '…' : '+' }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getStoredUser, fetchCases, fetchProfile, createSession } from '../api'
import UserAvatar from '../components/UserAvatar.vue'

const user = ref(getStoredUser())
const cases = ref([])
const loading = ref(true)
const error = ref('')
const creating = ref(false)
const createMsg = ref('')

function statusLabel(s) {
  return s === 'active' ? '进行中' : s === 'completed' ? '已完成' : '已归档'
}
function formatTime(t) {
  if (!t) return ''
  try {
    const d = new Date(t)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return t }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    user.value = await fetchProfile()
    cases.value = await fetchCases()
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function startConsult() {
  creating.value = true
  createMsg.value = ''
  try {
    const { sessionId } = await createSession()
    openChat(sessionId)
  } catch (e) {
    createMsg.value = e.message || '创建失败'
  } finally {
    creating.value = false
  }
}

function openChat(sessionId) {
  if (!sessionId) return
  window.location.href = `/chat/?sessionId=${encodeURIComponent(sessionId)}`
}

onMounted(load)
</script>

<style scoped>
.with-nav { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
.top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.top h1 { font-size: 20px; margin: 0; }
.greet { font-size: 13px; color: #888; margin: 4px 0 0; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.item { padding: 14px 16px; cursor: pointer; transition: box-shadow 0.15s; }
.item:active { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.scenario {
  font-size: 11px; padding: 2px 8px; border-radius: 6px;
  background: #f0fdf4; color: #059669; font-weight: 600;
}
.scenario.due_diligence { background: #fff7ed; color: #c2410c; }
.title { margin: 8px 0 4px; font-size: 15px; font-weight: 600; line-height: 1.4; }
.preview {
  font-size: 13px; color: #666; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.meta { display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: #aaa; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #f3f4f6; color: #666; }
.badge.active { background: #ecfdf5; color: #059669; }
.empty { padding: 32px 20px; text-align: center; }
.empty-icon { font-size: 40px; margin-bottom: 8px; }
.empty .sub { color: #999; font-size: 13px; margin: 8px 0 16px; }
.create-msg { margin-top: 12px; font-size: 13px; color: #059669; line-height: 1.5; }
.hint { text-align: center; color: #999; padding: 40px; }
.spinner {
  width: 28px; height: 28px; margin: 0 auto 8px;
  border: 2px solid #e5e7eb; border-top-color: #07C160; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.fab {
  position: fixed; right: 20px; bottom: calc(72px + env(safe-area-inset-bottom));
  width: 48px; height: 48px; border-radius: 50%; border: none;
  background: #07C160; color: #fff; font-size: 24px; font-weight: 300;
  box-shadow: 0 4px 16px rgba(7,193,96,0.4); cursor: pointer;
}
.fab:disabled { opacity: 0.6; }
</style>
