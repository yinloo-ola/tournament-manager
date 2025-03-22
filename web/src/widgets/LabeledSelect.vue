<script setup lang="ts">
defineProps(['label', 'name', 'options', 'readonly'])
const model = defineModel()
</script>

<template>
  <div class="relative z-0 mt-3">
    <select
      :name
      :readonly
      v-model="model"
      class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent px-0 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <label
      class="absolute top-3 origin-[0] transform text-sm text-gray-500 duration-300 peer-focus:left-0 -z-10 peer-focus:scale-75 peer-not-placeholder-shown:scale-75 peer-focus:text-blue-600 peer-focus:-translate-y-6 peer-not-placeholder-shown:-translate-y-6 peer-focus:dark:text-blue-500"
      >{{ label }}</label
    >
  </div>
</template>
