<template>
  <div class="game-container">
    <div class="ui-panel">
      <h2>🐟 大鱼吃小鱼 MVP</h2>
      <div class="info-row">
        <span>当前等级:</span>
        <strong style="color: #FF9F40; font-size: 1.2em;">Lv.{{ uiData.level }} {{ uiData.levelName }}</strong>
      </div>

      <div class="info-row">
        <span>得分:</span>
        <span>{{ uiData.score }}</span>
      </div>

      <div class="progress-box">
        <p>低级鱼消化进度 ({{ uiData.stomach }}/3)</p>
        <div class="bar-bg">
          <div class="bar-fill" :style="{ width: (uiData.stomach / 3) * 100 + '%' }"></div>
        </div>
      </div>

      <div class="rules">
        <p>1. 吃同级鱼 -> +1 挂件</p>
        <p>2. 吃3条低级鱼 -> +1 挂件</p>
        <p>3. 攒齐3个挂件 -> 进化！</p>
      </div>
    </div>

    <div id="phaser-game"></div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import Phaser from 'phaser';
import MainScene from '../game/MainScene.js';

// 响应式数据，用于 UI 显示
const uiData = ref({
  level: 1,
  levelName: '蝌蚪',
  score: 0,
  stomach: 0
});

let gameInstance = null;

onMounted(() => {
  // 游戏配置
  const config = {
    type: Phaser.AUTO,
    parent: 'phaser-game', // 对应上面的 div id
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#243C64', // 深海蓝背景
    physics: {
      default: 'arcade',
      arcade: {
        debug: false, // 改为 true 可以看到绿色的物理碰撞框
        gravity: { y: 0 } // 太空/海洋模式，没有重力
      }
    },
    scene: [MainScene]
  };

  // 启动游戏
  gameInstance = new Phaser.Game(config);

  // 监听游戏逻辑发出的事件
  gameInstance.events.on('update-ui', (data) => {
    uiData.value = data;
  });

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  if (gameInstance) {
    gameInstance.destroy(true);
  }
  window.removeEventListener('resize', handleResize);
});

// 窗口调整逻辑
const handleResize = () => {
    if (gameInstance) {
        gameInstance.scale.resize(window.innerWidth, window.innerHeight);
    }
}
</script>

<style scoped>
.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.ui-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 10px;
  border: 1px solid #444;
  min-width: 220px;
  pointer-events: none; /* 让鼠标点击穿透，不影响游戏 */
  user-select: none;
}

h2 {
  margin: 0 0 10px 0;
  font-size: 18px;
  text-align: center;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-box {
  margin-top: 10px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px;
  border-radius: 5px;
}

.progress-box p {
  margin: 0 0 5px 0;
  font-size: 12px;
}

.bar-bg {
  width: 100%;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: #FF9F40; /* 进度条颜色 */
  transition: width 0.3s ease;
}

.rules {
  margin-top: 15px;
  font-size: 11px;
  color: #aaa;
  border-top: 1px solid #555;
  padding-top: 5px;
}

.rules p {
  margin: 2px 0;
}
</style>