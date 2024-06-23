<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main
    class="h-screen w-screen flex flex-col items-center justify-center gap-x-4 gap-y-6 lg:flex-row"
  >
    <button
      class="w-2/3 cursor-pointer border-0 rounded-lg bg-lime-600 px-5 py-3 text-[15px] text-white shadow-gray-500/50 shadow-lg lg:w-1/3 active:scale-[.97]"
    >
      Import Tournament
    </button>
    <button
      @click="router.push('/tournament')"
      class="w-2/3 cursor-pointer border-0 rounded-lg bg-lime-800 px-5 py-3 text-[15px] text-white shadow-gray-500/50 shadow-lg lg:w-1/3 active:scale-[.97]"
    >
      Create New Tournament
    </button>
  </main>
</template>
<style scoped>
.center {
  display: grid;
  place-content: center;
}
</style>
