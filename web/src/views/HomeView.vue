<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const file = ref<HTMLInputElement | null>(null)

const router = useRouter()

function onFileSelected(event: any) {
  if (event.target.files.length === 0) {
    alert('No files selected')
    return
  }
  var reader = new FileReader()
  reader.onload = onReaderLoad
  reader.readAsText(event.target.files[0])
}

function onReaderLoad(event: any) {
  console.log(event.target.result)
  var obj = JSON.parse(event.target.result)
  console.log(obj)
}
</script>

<template>
  <main
    class="h-screen w-screen flex flex-col items-center justify-center gap-x-4 gap-y-6 lg:flex-row"
  >
    <button
      @click="file?.click()"
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
