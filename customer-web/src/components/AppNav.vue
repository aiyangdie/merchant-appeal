<template>
  <nav class="app-nav" v-if="show">
    <router-link to="/cases" class="nav-item" active-class="active">
      <span class="icon">📋</span>
      <span>案件</span>
    </router-link>
    <router-link to="/profile" class="nav-item" active-class="active">
      <span class="icon">👤</span>
      <span>我的</span>
    </router-link>
    <a href="/chat/" class="nav-item">
      <span class="icon">🤖</span>
      <span>AI咨询</span>
    </a>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const show = computed(() => route.meta.nav === true)
</script>

<style scoped>
.app-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: #fff;
  border-top: 1px solid #eee;
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
  z-index: 50;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.04);
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 0;
  font-size: 11px;
  color: #999;
  text-decoration: none;
}
.nav-item.active { color: #07C160; font-weight: 600; }
.icon { font-size: 20px; line-height: 1; }
</style>
