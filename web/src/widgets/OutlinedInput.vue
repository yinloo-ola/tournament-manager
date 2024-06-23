<script setup lang="ts">
defineProps(['label', 'type', 'name', 'readonly'])
const model = defineModel()
</script>

<template>
  <div class="relative z-0 mt-3">
    <input
      :type
      :name
      :readonly
      v-model="model"
      class="peer box-border block w-full appearance-none border-1 border-gray-500 rounded-lg bg-transparent px-2.5 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
      placeholder=""
    />
    <label
      class="absolute top-3 mx-1.5 origin-[0] transform bg-white px-1 text-sm text-gray-500 duration-300 peer-focus:left-0 -z-10 peer-focus:z-10 peer-not-placeholder-shown:z-10 peer-focus:scale-75 peer-not-placeholder-shown:scale-75 peer-focus:text-blue-600 peer-focus:-translate-y-6 peer-not-placeholder-shown:-translate-y-6 peer-focus:dark:text-blue-500"
      >{{ label }}</label
    >
  </div>
</template>

<!-- <div class="relative">
    <input type="text" id="floating_outlined" class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder=" " />
    <label for="floating_outlined" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">Floating outlined</label>
</div> -->
