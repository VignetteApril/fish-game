// src/game/MainScene.js
import Phaser from 'phaser';

// === 配置区 ===
const EVOLUTION_MAP = {
  1: { name: "蝌蚪", color: 0x00FFFF, radius: 10, speed: 300 },
  2: { name: "金鱼", color: 0xFFD700, radius: 15, speed: 280 },
  3: { name: "食人鱼", color: 0xFF4500, radius: 25, speed: 260 },
  4: { name: "剑鱼", color: 0x8A2BE2, radius: 35, speed: 240 },
  5: { name: "大白鲨", color: 0x708090, radius: 50, speed: 220 },
  6: { name: "虎鲸", color: 0xFFFFFF, radius: 70, speed: 200 },
  7: { name: "深海巨怪", color: 0x8B0000, radius: 100, speed: 180 },
  8: { name: "中国龙", color: 0xFF0000, radius: 150, speed: 160 }
};

// 地图大小
const WORLD_SIZE = 4000;

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  create() {
    // 1. 初始化数值
    this.playerLevel = 1;
    this.expStacks = 0;
    this.smallFishStomach = 0;
    this.score = 0;

    // === 2. 设置大地图边界 ===
    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

    // === 3. 添加网格背景 (作为移动参照物) ===
    // 创建一个平铺的网格，这就只要你动，网格就会动
    this.bgGrid = this.add.grid(0, 0, WORLD_SIZE, WORLD_SIZE, 50, 50, 0x243C64).setAltFillStyle(0x1e3252).setOutlineStyle(0x444444);
    this.bgGrid.setOrigin(0, 0);

    // === 4. 创建玩家 ===
    const startConfig = EVOLUTION_MAP[1];
    // 把玩家放在地图正中间
    this.player = this.add.circle(WORLD_SIZE / 2, WORLD_SIZE / 2, startConfig.radius, startConfig.color);
    this.physics.add.existing(this.player);
    this.player.body.setCircle(startConfig.radius);
    this.player.body.setCollideWorldBounds(true); // 撞到世界尽头会停下

    // 玩家文字
    this.levelText = this.add.text(0, 0, `Lv.1 ${startConfig.name}`, {
      fontSize: '14px', fill: '#fff', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    // 确保文字层级最高
    this.levelText.setDepth(100);
    this.player.setDepth(99);

    // === 5. 摄像机设置 (关键！) ===
    // 让摄像机跟随玩家
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);
    // 摄像机边界和世界一样大
    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

    // 挂件容器
    this.followers = [];
    // 敌人组
    this.enemies = this.physics.add.group();

    // 碰撞检测
    this.physics.add.overlap(this.player, this.enemies, this.handleEat, null, this);

    // === 6. 刷怪定时器 ===
    // 缩短时间，每 500ms 尝试刷一条鱼
    this.time.addEvent({
      delay: 500,
      callback: this.spawnEnemyAroundCamera, // 这是一个新函数
      callbackScope: this,
      loop: true
    });

    this.updateVueUI();
  }

  update() {
    // === 玩家移动 ===
    // 注意：input.activePointer.worldX 获取的是鼠标在世界地图的坐标，而不是屏幕坐标
    const worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
    const speed = EVOLUTION_MAP[this.playerLevel].speed;

    if (distance > 15) {
      this.physics.moveTo(this.player, worldPoint.x, worldPoint.y, speed);
    } else {
      this.player.body.setVelocity(0);
    }

    // === 文字跟随 ===
    this.levelText.x = this.player.x;
    this.levelText.y = this.player.y - EVOLUTION_MAP[this.playerLevel].radius - 20;

    // === 挂件跟随 ===
    if (this.followers.length > 0) {
      const time = this.time.now * 0.003;
      this.followers.forEach((follower, index) => {
        const angle = time + (index * (Math.PI * 2 / 3));
        const orbitRadius = EVOLUTION_MAP[this.playerLevel].radius + 15;
        follower.x = this.player.x + Math.cos(angle) * orbitRadius;
        follower.y = this.player.y + Math.sin(angle) * orbitRadius;
      });
    }

    // === 清理过远的敌人 (优化性能) ===
    // 如果敌人距离玩家超过 1500 像素，就销毁它，不然地图上鱼会越来越多卡顿
    this.enemies.children.each(enemy => {
        if (enemy.active) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (dist > 1500) {
                this.destroyEnemy(enemy);
            } else {
                // 文字跟随
                if(enemy.label) {
                    enemy.label.x = enemy.x;
                    enemy.label.y = enemy.y;
                }
            }
        }
    });
  }

  // === 新的刷怪逻辑：只在镜头周围刷 ===
  spawnEnemyAroundCamera() {
    // 限制同屏最大数量，防止太卡
    if (this.enemies.getLength() > 50) return;

    // 获取摄像机当前的视野范围
    const cam = this.cameras.main;

    // 我们要在视野外圈刷怪，让鱼“游进”视野
    // 定义一个比屏幕稍大的矩形
    const padding = 100;
    const spawnZone = {
        minX: cam.worldView.x - padding,
        maxX: cam.worldView.right + padding,
        minY: cam.worldView.y - padding,
        maxY: cam.worldView.bottom + padding
    };

    // 随机生成一个位置，但要确保在世界范围内
    let x, y;
    // 简单的算法：随机选一条边生成
    const side = Phaser.Math.Between(0, 3);

    if (side === 0) { // 左侧外
        x = spawnZone.minX; y = Phaser.Math.Between(spawnZone.minY, spawnZone.maxY);
    } else if (side === 1) { // 右侧外
        x = spawnZone.maxX; y = Phaser.Math.Between(spawnZone.minY, spawnZone.maxY);
    } else if (side === 2) { // 上侧外
        x = Phaser.Math.Between(spawnZone.minX, spawnZone.maxX); y = spawnZone.minY;
    } else { // 下侧外
        x = Phaser.Math.Between(spawnZone.minX, spawnZone.maxX); y = spawnZone.maxY;
    }

    // 边界检查
    if (x < 0 || x > WORLD_SIZE || y < 0 || y > WORLD_SIZE) return;

    // 创建敌人
    const maxLevel = Math.min(8, this.playerLevel + 1);
    const level = Phaser.Math.Between(1, maxLevel);
    const config = EVOLUTION_MAP[level];

    const enemy = this.add.circle(x, y, config.radius, config.color);
    this.physics.add.existing(enemy);
    enemy.body.setCircle(config.radius);

    // 让敌人向玩家的大致方向移动，但不那么精准（增加自然感）
    const targetX = this.player.x + Phaser.Math.Between(-200, 200);
    const targetY = this.player.y + Phaser.Math.Between(-200, 200);
    this.physics.moveTo(enemy, targetX, targetY, Phaser.Math.Between(50, 150));

    enemy.level = level;

    const label = this.add.text(x, y, `Lv.${level}`, { fontSize: '10px', fill: '#000' }).setOrigin(0.5);
    enemy.label = label;

    this.enemies.add(enemy);
  }

  destroyEnemy(enemy) {
    if (enemy.label) enemy.label.destroy();
    enemy.destroy();
  }

  handleEat(player, enemy) {
    if (!enemy.active) return;

    if (enemy.level > this.playerLevel) {
        this.scene.pause();
        const restart = confirm(`你被 Lv.${enemy.level} 吃掉了！重新开始？`);
        if (restart) window.location.reload();
        return;
    }

    this.destroyEnemy(enemy);
    this.score += enemy.level * 10;

    if (enemy.level === this.playerLevel) {
        this.addStack();
    } else if (enemy.level < this.playerLevel) {
        this.smallFishStomach++;
        if (this.smallFishStomach >= 3) {
            this.smallFishStomach = 0;
            this.addStack();
        }
    }
    this.updateVueUI();
  }

  addStack() {
    if (this.expStacks >= 3) return;
    this.expStacks++;
    const follower = this.add.circle(this.player.x, this.player.y, 8, EVOLUTION_MAP[this.playerLevel].color);
    follower.setStrokeStyle(1, 0xffffff);
    follower.setDepth(100);
    this.followers.push(follower);

    if (this.expStacks >= 3) {
        this.time.delayedCall(100, () => { this.evolve(); });
    }
  }

  evolve() {
    if (this.playerLevel >= 8) {
        alert("通关！");
        return;
    }
    this.playerLevel++;
    this.expStacks = 0;
    this.smallFishStomach = 0;
    this.followers.forEach(f => f.destroy());
    this.followers = [];

    const config = EVOLUTION_MAP[this.playerLevel];
    this.player.setRadius(config.radius);
    this.player.setFillStyle(config.color);
    this.player.body.setCircle(config.radius);

    this.tweens.add({
        targets: this.player,
        scaleX: 1.2, scaleY: 1.2, duration: 100, yoyo: true, repeat: 1
    });
    this.updateVueUI();
  }

  updateVueUI() {
    this.game.events.emit('update-ui', {
        levelName: EVOLUTION_MAP[this.playerLevel].name,
        level: this.playerLevel,
        score: this.score,
        stomach: this.smallFishStomach
    });
  }
}