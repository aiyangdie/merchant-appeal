<template>
  <img
    v-if="src"
    :src="src"
    :alt="alt"
    class="avatar"
    :style="{ width: size + 'px', height: size + 'px' }"
  />
  <div v-else class="avatar placeholder" :style="{ width: size + 'px', height: size + 'px' }">
    {{ letter }}
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { upgradeAvatar } from '../api'

const props = defineProps({
  url: String,
  name: String,
  size: { type: Number, default: 40 },
  alt: { type: String, default: '头像' },
})

const src = computed(() => upgradeAvatar(props.url))
const letter = computed(() => (props.name || '用户').slice(0, 1))
</script>

<style scoped>
.avatar { border-radius: 12px; object-fit: cover; }
.placeholder {
  border-radius: 12px; background: #07C160; color: #fff;
  display: flex; align-items: center; justify-content: center; font-weight: 600;
}
</style>
