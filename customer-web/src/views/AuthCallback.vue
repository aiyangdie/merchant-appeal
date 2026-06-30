<template>
  <div class="callback-page">
    <div class="card box">
      <div v-if="loading" class="status">
        <div class="spinner" />
        <p>正在登录...</p>
      </div>
      <div v-else-if="error" class="status error">
        <p class="title">登录失败</p>
        <p class="msg">{{ error }}</p>
        <button class="btn-primary" @click="goLogin">重新登录</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { exchangeOAuthCode, setAuth } from '../api'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')

function goLogin() {
  window.location.href = '/chat/'
}

function needsBind(user) {
  return !user?.phone || !/^1[3-9]\d{9}$/.test(String(user.phone).trim())
}

onMounted(async () => {
  const code = route.query.code
  const state = route.query.state
  const err = route.query.error || route.query.error_description

  if (err) {
    error.value = String(err)
    loading.value = false
    return
  }

  if (!code) {
    error.value = '未收到授权码，请从首页重新发起登录'
    loading.value = false
    return
  }

  const returnPath = sessionStorage.getItem('oauth_return_path') || '/chat/'

  try {
    const data = await exchangeOAuthCode(code, state, returnPath)
    setAuth(data.token, data.user)
    sessionStorage.removeItem('oauth_return_path')
    const bind = data.needsProfile || needsBind(data.user)
    window.location.href = bind ? '/chat/?bindPhone=1' : '/chat/'
  } catch (e) {
    error.value = e.message || '授权失败，请重新登录（code 只能用一次，勿刷新本页）'
    loading.value = false
  }
})
</script>

<style scoped>
.callback-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;
}
.box { padding: 32px 24px; text-align: center; max-width: 400px; width: 100%; }
.status p { color: #666; margin: 12px 0; }
.status.error .title { color: #ef4444; font-weight: 600; font-size: 18px; }
.status.error .msg { font-size: 14px; line-height: 1.6; }
.spinner {
  width: 36px; height: 36px; margin: 0 auto 12px;
  border: 3px solid #e5e7eb; border-top-color: #07C160; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
