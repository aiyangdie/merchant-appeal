<template>
  <div class="page">
    <div class="card box">
      <UserAvatar :url="user?.avatarUrl" :name="user?.nickname" :size="64" />
      <h2>绑定手机号</h2>
      <p class="sub">微信登录后必须绑定手机号，用于通知与账号安全</p>
      <form @submit.prevent="submit">
        <label>手机号 <span class="req">*</span></label>
        <input v-model="phone" class="input" type="tel" maxlength="11" placeholder="11位手机号" required />
        <label>昵称（可选）</label>
        <input v-model="nickname" class="input" placeholder="不填则保留微信昵称" maxlength="20" />
        <p v-if="error" class="error-text">{{ error }}</p>
        <button class="btn-primary" type="submit" :disabled="loading">
          {{ loading ? '保存中...' : '完成绑定' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getStoredUser, completeProfile, fetchProfile } from '../api'
import UserAvatar from '../components/UserAvatar.vue'

const router = useRouter()
const user = ref(getStoredUser())
const phone = ref('')
const nickname = ref('')
const error = ref('')
const loading = ref(false)

onMounted(async () => {
  try {
    user.value = await fetchProfile()
    nickname.value = user.value?.nickname || ''
  } catch {
    window.location.href = '/chat/?bindPhone=1'
  }
})

async function submit() {
  error.value = ''
  if (!/^1[3-9]\d{9}$/.test(phone.value.trim())) {
    error.value = '请输入正确的11位手机号'
    return
  }
  loading.value = true
  try {
    await completeProfile({
      phone: phone.value.trim(),
      nickname: nickname.value.trim() || undefined,
    })
    window.location.href = '/chat/'
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.box { padding: 24px 20px; max-width: 420px; margin: 40px auto; text-align: center; }
.box h2 { margin: 12px 0 4px; }
.sub { color: #888; font-size: 13px; margin-bottom: 16px; }
.req { color: #ef4444; }
label { display: block; text-align: left; font-size: 13px; color: #666; margin: 12px 0 6px; }
</style>
