<template>
  <div class="login-page">
    <div v-if="wechatBooting" class="wechat-boot">
      <div class="spinner" />
      <p>正在微信授权登录...</p>
      <p class="sub">请稍候，无需输入账号</p>
    </div>

    <div v-else class="login-card card">
      <div class="login-left">
        <div class="brand">
          <div class="logo">申</div>
          <h1>商户申诉助手</h1>
          <p>专业 AI 辅助 · 微信商户号申诉与尽调</p>
        </div>
        <ul class="features">
          <li>智能收集申诉材料</li>
          <li>案件进度一目了然</li>
          <li>微信内一键登录</li>
        </ul>
      </div>
      <div class="login-right">
        <h2>{{ mode === 'register' ? '注册' : '登录' }}</h2>
        <p class="sub">{{ isWechatEnv ? '授权失败时可使用手机号登录' : '手机号登录 / 微信授权' }}</p>

        <form @submit.prevent="submit">
          <label>手机号</label>
          <input
            v-model="phone"
            class="input"
            type="tel"
            maxlength="11"
            placeholder="11位手机号"
            autocomplete="tel"
          />
          <template v-if="mode === 'register'">
            <label>中文昵称</label>
            <input v-model="nickname" class="input" placeholder="用于显示的名称" maxlength="20" />
          </template>
          <p v-if="error" class="error-text">{{ error }}</p>
          <button class="btn-primary" type="submit" :disabled="loading">
            {{ loading ? '处理中...' : mode === 'register' ? '注册并登录' : '手机号登录' }}
          </button>
        </form>

        <button class="link-btn" type="button" @click="toggleMode">
          {{ mode === 'register' ? '已有账号？去登录' : '没有账号？去注册' }}
        </button>

        <button
          v-if="oauthEnabled && !isWechatEnv"
          class="btn-wechat"
          type="button"
          :disabled="oauthRedirecting"
          @click="startWechatLogin"
        >
          {{ oauthRedirecting ? '跳转中...' : '微信授权登录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  isWechat, getOAuthConfig, getOAuthUrl,
  loginWithPhone, registerWithPhone, getToken, canStartOAuthRedirect,
} from '../api'

const route = useRoute()
const router = useRouter()
const phone = ref('')
const nickname = ref('')
const mode = ref('login')
const error = ref('')
const loading = ref(false)
const oauthEnabled = ref(false)
const oauthRedirecting = ref(false)
const isWechatEnv = isWechat()
const wechatBooting = ref(isWechatEnv)

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
}

async function startWechatLogin() {
  if (!canStartOAuthRedirect()) {
    error.value = '正在跳转授权，请稍候...'
    return
  }
  oauthRedirecting.value = true
  try {
    const returnPath = route.query.redirect || '/cases'
    sessionStorage.setItem('oauth_return_path', returnPath)
    const { url } = await getOAuthUrl(returnPath)
    window.location.href = url
  } catch (e) {
    error.value = e.message
    oauthRedirecting.value = false
    wechatBooting.value = false
  }
}

async function submit() {
  error.value = ''
  if (!/^1[3-9]\d{9}$/.test(phone.value.trim())) {
    error.value = '请输入正确的11位手机号'
    return
  }
  loading.value = true
  try {
    if (mode.value === 'register') {
      if (!nickname.value.trim()) {
        error.value = '请输入中文昵称'
        loading.value = false
        return
      }
      await registerWithPhone(phone.value.trim(), nickname.value.trim())
    } else {
      await loginWithPhone(phone.value.trim())
    }
    router.replace(route.query.redirect || '/cases')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (getToken()) {
    router.replace(route.query.redirect || '/cases')
    return
  }
  try {
    const cfg = await getOAuthConfig()
    oauthEnabled.value = cfg.enabled
    if (isWechatEnv && cfg.enabled) {
      await startWechatLogin()
      return
    }
  } catch {
    oauthEnabled.value = false
  }
  wechatBooting.value = false
})
</script>

<style scoped>
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: linear-gradient(160deg, #e8f8ee 0%, #f5f5f5 50%);
}
.wechat-boot {
  text-align: center; padding: 48px 24px;
}
.wechat-boot p { color: #333; margin: 8px 0; font-size: 16px; }
.wechat-boot .sub { color: #999; font-size: 13px; }
.login-card {
  display: flex; width: 100%; max-width: 880px; overflow: hidden;
}
.login-left {
  flex: 1; background: linear-gradient(145deg, #07C160, #059669);
  color: #fff; padding: 40px 32px;
}
.brand h1 { margin: 12px 0 8px; font-size: 24px; }
.brand p { opacity: 0.9; font-size: 14px; }
.logo {
  width: 48px; height: 48px; background: rgba(255,255,255,0.2);
  border-radius: 14px; display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700;
}
.features { margin: 24px 0 0; padding: 0; list-style: none; font-size: 14px; line-height: 2; opacity: 0.95; }
.login-right { flex: 1; padding: 32px 28px; }
.login-right h2 { margin: 0 0 4px; font-size: 20px; }
.sub { color: #888; font-size: 13px; margin-bottom: 20px; }
label { display: block; font-size: 13px; color: #666; margin: 12px 0 6px; }
.link-btn {
  margin-top: 12px; background: none; border: none; color: #07C160;
  font-size: 13px; cursor: pointer; width: 100%; padding: 8px;
}
.btn-wechat {
  margin-top: 16px; width: 100%; padding: 12px; border-radius: 12px;
  border: 1px solid #07C160; background: #f0fdf4; color: #059669;
  font-weight: 600; cursor: pointer;
}
.btn-wechat:disabled { opacity: 0.6; }
.spinner {
  width: 40px; height: 40px; margin: 0 auto 16px;
  border: 3px solid #e5e7eb; border-top-color: #07C160; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
  .login-card { flex-direction: column; }
  .login-left { padding: 24px 20px; }
  .features { display: none; }
  .login-right { padding: 20px 18px 28px; }
}
</style>
