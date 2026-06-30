<template>
  <div class="page with-nav">
    <header class="top">
      <router-link to="/cases" class="back">← 案件</router-link>
      <h1>我的</h1>
    </header>
    <div class="card profile-card">
      <UserAvatar :url="user?.avatarUrl" :name="user?.nickname" :size="72" />
      <h2>{{ user?.nickname || '用户' }}</h2>
      <p v-if="user?.phone" class="phone">{{ user.phone }}</p>
      <p v-else class="phone muted">未绑定手机号</p>
      <p class="balance">余额 ¥{{ balance }}</p>
    </div>
    <router-link v-if="!user?.phone" to="/setup-profile" class="btn-outline link-btn">
      绑定手机号
    </router-link>
    <button class="btn-outline" @click="logout">退出登录</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchProfile, clearAuth, getStoredUser } from '../api'
import UserAvatar from '../components/UserAvatar.vue'

const router = useRouter()
const user = ref(getStoredUser())
const balance = computed(() => parseFloat(user.value?.balance || 0).toFixed(2))

function logout() {
  clearAuth()
  router.replace('/login')
}

onMounted(async () => {
  try {
    user.value = await fetchProfile()
  } catch {
    logout()
  }
})
</script>

<style scoped>
.with-nav { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
.top { margin-bottom: 16px; }
.back { font-size: 14px; color: #666; text-decoration: none; }
.top h1 { margin: 8px 0 0; font-size: 20px; }
.profile-card { padding: 28px 20px; text-align: center; }
.profile-card h2 { margin: 12px 0 4px; font-size: 18px; }
.phone { color: #666; font-size: 14px; }
.muted { color: #aaa; }
.balance { margin-top: 12px; font-size: 15px; color: #059669; font-weight: 600; }
.btn-outline, .link-btn {
  display: block; margin-top: 12px; width: 100%; padding: 12px; border-radius: 12px;
  border: 1px solid #e5e7eb; background: #fff; color: #666; cursor: pointer;
  text-align: center; text-decoration: none; font-size: 14px;
}
</style>
