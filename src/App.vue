<script setup>
import { onMounted } from 'vue';
import Game from './components/Game.vue'
</script>

<template>
  <Game />
</template>

<style>
/* 确保 App 占满全屏 */
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>