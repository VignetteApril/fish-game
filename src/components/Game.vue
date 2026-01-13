<template>
  <div class="game-container">

    <div v-if="showLoginModal" class="modal-overlay">
      <div class="modal-box">
        <h1 class="game-title">🌊 深海进化论</h1>
        <p class="subtitle">Evolution: Deep Sea Survival</p>

        <div v-if="!user" class="auth-section">
          <p class="hint">登录以同步云端存档，冲击排行榜！</p>
          <div class="btn-group">
            <button class="btn primary-btn" @click="handleLogin">
              <span class="icon">G</span> Google 一键登录
            </button>
            <button class="btn guest-btn" @click="handleGuestStart">
              游客试玩 (不存档)
            </button>
          </div>
        </div>

        <div v-else class="auth-section">
          <div class="user-info">
            <img v-if="user.user_metadata.avatar_url" :src="user.user_metadata.avatar_url" class="avatar" />
            <p>欢迎回来，{{ user.user_metadata.full_name || user.email }}</p>
          </div>

          <div class="btn-group">
            <button class="btn start-btn" @click="handleLoadAndStart">
              {{ hasSave ? `继续游戏 (Lv.${savedLevel})` : '开始新游戏' }}
            </button>
            <button class="btn logout-btn" @click="logout">注销</button>
          </div>
        </div>
      </div>
    </div>

    <div class="ui-panel" v-if="!showLoginModal">
      <div class="stats-row">
        <div class="level-badge">
          <span class="label">Lv.{{ uiData.level }}</span>
          <span class="value">{{ uiData.levelName }}</span>
        </div>
        <div class="score-box">
          <span>得分:</span>
          <strong>{{ uiData.score }}</strong>
        </div>
      </div>

      <div class="progress-box">
        <div class="progress-label">
          <span>消化进度</span>
          <span>{{ uiData.stomach }}/3</span>
        </div>
        <div class="bar-bg">
          <div class="bar-fill" :style="{ width: (uiData.stomach / 3) * 100 + '%' }"></div>
        </div>
        <p class="tutorial-text" v-if="uiData.level < 3">
          提示: 吃掉 3 条低级鱼或 1 条同级鱼可增长
        </p>
      </div>
    </div>

    <div id="phaser-game"></div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import Phaser from 'phaser';
import MainScene from '../game/MainScene.js';
// 引入上一轮生成的 Composable
import { useGameCloud } from '../composables/useGameCloud.js';

// === 1. 状态管理 ===
const { user, login, logout, checkSession, saveGameData, loadGameData } = useGameCloud();

const showLoginModal = ref(true); // 控制弹窗显示
const hasSave = ref(false);       // 是否有存档
const savedLevel = ref(1);        // 存档显示的等级
let savedDataCache = null;        // 暂存从云端拉取的数据

// 游戏 UI 响应式数据
const uiData = ref({
  level: 1,
  levelName: '蝌蚪',
  score: 0,
  stomach: 0
});

let gameInstance = null;

// === 2. 初始化流程 ===
onMounted(async () => {
  // 检查是否是从 OAuth 回调回来的，或者已有 Session
  const currentUser = await checkSession();

  if (currentUser) {
    // 如果已登录，尝试静默拉取存档
    const data = await loadGameData();
    if (data) {
      hasSave.value = true;
      savedLevel.value = data.level;
      savedDataCache = data; // 存起来，等用户点“继续游戏”时传给 Phaser
    }
  }
});

onUnmounted(() => {
  if (gameInstance) {
    gameInstance.destroy(true);
  }
});

// === 3. 按钮交互事件 ===

// 点击登录
const handleLogin = async () => {
  await login();
  // 注意：Supabase OAuth 会跳转页面，所以下面的代码通常不会执行，
  // 而是页面刷新后重新触发 onMounted
};

// 点击游客试玩
const handleGuestStart = () => {
  startGame(null); // 传入空数据
};

// 点击开始/继续游戏
const handleLoadAndStart = () => {
  // 如果有存档缓存，就传进去；否则传 null 代表新游戏
  startGame(savedDataCache);
};

// 统一启动入口
const startGame = (initialData) => {
  showLoginModal.value = false; // 隐藏弹窗
  initPhaser(initialData);      // 启动引擎
};

// === 4. Phaser 引擎集成 ===
const initPhaser = (initialData) => {
  if (gameInstance) return;

  const config = {
    type: Phaser.AUTO,
    parent: 'phaser-game',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#243C64', // 深海蓝
    physics: {
      default: 'arcade',
      arcade: { debug: false }
    },
    scene: [MainScene]
  };

  gameInstance = new Phaser.Game(config);

  // --- 关键修复：使用 Registry 传递数据 ---
  // Phaser 的 Registry 是一个全局数据存储，MainScene 可以直接读取
  if (initialData) {
    console.log("正在注入存档数据:", initialData);
    gameInstance.registry.set('saveData', initialData);
  } else {
    // 即使是新游戏，也设为空对象，防止读取报错
    gameInstance.registry.set('saveData', {});
  }

  // --- 事件监听 ---

  // 1. 监听游戏内的 UI 更新事件
  gameInstance.events.on('update-ui', (data) => {
    uiData.value = data;
  });

  // 2. 监听自动保存事件 (由 MainScene 在进化时触发)
  gameInstance.events.on('auto-save', (gameStatus) => {
    console.log('Vue 收到自动保存请求:', gameStatus);
    saveGameData(gameStatus); // 调用 Composable 上传 Supabase
  });

  // 3. 窗口大小自适应
  window.addEventListener('resize', () => {
    gameInstance.scale.resize(window.innerWidth, window.innerHeight);
  });
};
</script>

<style scoped>
/* 全屏容器 */
.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #000;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* === 模态窗样式 (Login/Start) === */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(12, 20, 35, 0.85); /* 深色半透明背景 */
  backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center;
  z-index: 100;
}

.modal-box {
  background: linear-gradient(145deg, #1e2f4a, #162236);
  border: 1px solid #3a506b;
  padding: 40px;
  border-radius: 16px;
  text-align: center;
  width: 360px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  color: white;
}

.game-title {
  font-size: 28px; margin: 0;
  color: #FF9F40; text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.subtitle {
  color: #8fa6c5; font-size: 14px; margin-top: 5px; margin-bottom: 30px;
}

.auth-section { display: flex; flex-direction: column; gap: 15px; }

.user-info {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;
}
.avatar { width: 32px; height: 32px; border-radius: 50%; }

.hint { font-size: 12px; color: #666; margin-bottom: 10px; }

.btn-group { display: flex; flex-direction: column; gap: 12px; }

.btn {
  padding: 12px; border: none; border-radius: 8px;
  font-size: 16px; font-weight: bold; cursor: pointer;
  transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px;
}

.primary-btn { background: #2ea44f; color: white; }
.primary-btn:hover { background: #2c974b; transform: translateY(-2px); }

.guest-btn { background: transparent; border: 1px solid #444; color: #aaa; font-size: 14px; }
.guest-btn:hover { border-color: #888; color: white; }

.start-btn { background: #FF9F40; color: #1e2f4a; }
.start-btn:hover { background: #ffb060; transform: scale(1.05); }

.logout-btn { background: #444; color: white; margin-top: 10px; }

/* === 游戏 HUD 样式 === */
.ui-panel {
  position: absolute;
  top: 20px; left: 20px;
  z-index: 10;
  pointer-events: none; /* 让鼠标穿透 */
  user-select: none;
  display: flex; flex-direction: column; gap: 12px;
}

.stats-row { display: flex; gap: 12px; }

.level-badge {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid #FF9F40;
  border-radius: 8px;
  padding: 8px 12px;
  color: #FF9F40;
  display: flex; flex-direction: column; align-items: center;
  min-width: 80px;
}
.level-badge .label { font-size: 12px; opacity: 0.8; }
.level-badge .value { font-size: 18px; font-weight: bold; }

.score-box {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 8px 16px;
  color: white;
  display: flex; flex-direction: column; justify-content: center;
}

.progress-box {
  background: rgba(0, 0, 0, 0.6);
  padding: 10px;
  border-radius: 8px;
  width: 200px;
}

.progress-label {
  display: flex; justify-content: space-between;
  font-size: 12px; color: #ccc; margin-bottom: 6px;
}

.bar-bg {
  width: 100%; height: 8px;
  background: #333; border-radius: 4px; overflow: hidden;
}

.bar-fill {
  height: 100%; background: #FF9F40;
  transition: width 0.3s ease-out;
}

.tutorial-text {
  font-size: 10px; color: #888; margin-top: 6px; text-align: center;
}
</style>