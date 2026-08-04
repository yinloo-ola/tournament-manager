<script setup lang="ts">
import { RouterView } from 'vue-router'
import SnackbarHost from '@/widgets/SnackbarHost.vue'
</script>

<template>
  <div class="font-sans min-h-screen bg-surface-container-low text-on-surface">
    <RouterView />
    <SnackbarHost />
  </div>
</template>

<style>
body {
  margin: 0;
}
</style>
