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
    // === 修复点 1：正确获取 Vue 传过来的存档数据 ===
    // 之前直接写 data?.level 会报错，因为 data 未定义
    // 我们在 Vue 里是用 registry.set('saveData') 存的，所以这里要 get
    const savedData = this.game.registry.get('saveData') || {};

    console.log("🎮 场景接收到的存档:", savedData);

    // 1. 初始化数值
    this.playerLevel = savedData.level || 1;
    this.score = savedData.score || 0;
    this.smallFishStomach = savedData.stomach || 0;
    this.expStacks = 0; // 挂件通常不存，上线重新打

    // 兜底检测：如果存档等级超出了配置表，重置为 1
    if (!EVOLUTION_MAP[this.playerLevel]) {
      console.warn("存档等级异常，重置为 1");
      this.playerLevel = 1;
    }

    // === 2. 设置大地图边界 ===
    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

    // === 3. 添加网格背景 ===
    this.bgGrid = this.add.grid(0, 0, WORLD_SIZE, WORLD_SIZE, 50, 50, 0x243C64)
      .setAltFillStyle(0x1e3252)
      .setOutlineStyle(0x444444)
      .setOrigin(0, 0);

    // === 4. 创建玩家 ===
    // === 修复点 2：根据当前等级加载外观 ===
    // 之前写死是 EVOLUTION_MAP[1]，会导致读档后数值是鲨鱼，样子是蝌蚪
    const startConfig = EVOLUTION_MAP[this.playerLevel];

    // 把玩家放在地图正中间
    this.player = this.add.circle(WORLD_SIZE / 2, WORLD_SIZE / 2, startConfig.radius, startConfig.color);
    this.physics.add.existing(this.player);
    this.player.body.setCircle(startConfig.radius);
    this.player.body.setCollideWorldBounds(true);

    // 玩家文字
    this.levelText = this.add.text(0, 0, `Lv.${this.playerLevel} ${startConfig.name}`, {
      fontSize: '14px', fill: '#fff', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);

    // 确保文字层级最高
    this.levelText.setDepth(100);
    this.player.setDepth(99);

    // === 5. 摄像机设置 ===
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);
    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

    // 挂件容器
    this.followers = [];
    // 敌人组
    this.enemies = this.physics.add.group();

    // 碰撞检测
    this.physics.add.overlap(this.player, this.enemies, this.handleEat, null, this);

    // === 6. 刷怪定时器 ===
    this.time.addEvent({
      delay: 500,
      callback: this.spawnEnemyAroundCamera,
      callbackScope: this,
      loop: true
    });

    // 初始化 UI
    this.updateVueUI();
  }

  update() {
    // === 玩家移动 ===
    const worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
    const speed = EVOLUTION_MAP[this.playerLevel].speed;

    if (distance > 15) {
      this.physics.moveTo(this.player, worldPoint.x, worldPoint.y, speed);
    } else {
      this.player.body.setVelocity(0);
    }

    // === 文字跟随 ===
    // 修复文字高度偏移，让它始终在球体上方
    const currentRadius = EVOLUTION_MAP[this.playerLevel].radius;
    this.levelText.x = this.player.x;
    this.levelText.y = this.player.y - currentRadius - 20;

    // 更新文字内容 (防止升级后文字没变)
    this.levelText.setText(`Lv.${this.playerLevel} ${EVOLUTION_MAP[this.playerLevel].name}`);

    // === 挂件跟随 ===
    if (this.followers.length > 0) {
      const time = this.time.now * 0.003;
      this.followers.forEach((follower, index) => {
        const angle = time + (index * (Math.PI * 2 / 3));
        const orbitRadius = currentRadius + 15;
        follower.x = this.player.x + Math.cos(angle) * orbitRadius;
        follower.y = this.player.y + Math.sin(angle) * orbitRadius;
      });
    }

    // === 清理过远的敌人 ===
    this.enemies.children.each(enemy => {
      if (enemy.active) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (dist > 1500) {
          this.destroyEnemy(enemy);
        } else {
          // 敌人文字跟随
          if (enemy.label) {
            enemy.label.x = enemy.x;
            enemy.label.y = enemy.y;
          }
        }
      }
    });
  }

  spawnEnemyAroundCamera() {
    if (this.enemies.getLength() > 50) return;

    const cam = this.cameras.main;
    const padding = 100;
    const spawnZone = {
      minX: cam.worldView.x - padding,
      maxX: cam.worldView.right + padding,
      minY: cam.worldView.y - padding,
      maxY: cam.worldView.bottom + padding
    };

    let x, y;
    const side = Phaser.Math.Between(0, 3);

    if (side === 0) { x = spawnZone.minX; y = Phaser.Math.Between(spawnZone.minY, spawnZone.maxY); }
    else if (side === 1) { x = spawnZone.maxX; y = Phaser.Math.Between(spawnZone.minY, spawnZone.maxY); }
    else if (side === 2) { x = Phaser.Math.Between(spawnZone.minX, spawnZone.maxX); y = spawnZone.minY; }
    else { x = Phaser.Math.Between(spawnZone.minX, spawnZone.maxX); y = spawnZone.maxY; }

    if (x < 0 || x > WORLD_SIZE || y < 0 || y > WORLD_SIZE) return;

    // 动态生成敌人等级：玩家等级 + 1 以内
    const maxLevel = Math.min(8, this.playerLevel + 1);
    const level = Phaser.Math.Between(1, maxLevel);
    const config = EVOLUTION_MAP[level];

    const enemy = this.add.circle(x, y, config.radius, config.color);
    this.physics.add.existing(enemy);
    enemy.body.setCircle(config.radius);

    const targetX = this.player.x + Phaser.Math.Between(-200, 200);
    const targetY = this.player.y + Phaser.Math.Between(-200, 200);
    this.physics.moveTo(enemy, targetX, targetY, Phaser.Math.Between(50, 150));

    enemy.level = level;
    // 增加层级，防止被背景遮挡
    enemy.setDepth(50);

    const label = this.add.text(x, y, `Lv.${level}`, { fontSize: '10px', fill: '#000' }).setOrigin(0.5);
    label.setDepth(51);
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
      // 这里可以用 confirm，也可以做一个更漂亮的 UI 弹窗
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
      alert("恭喜进化成中国龙！通关！");
      return;
    }
    this.playerLevel++;
    this.expStacks = 0;
    this.smallFishStomach = 0;
    this.followers.forEach(f => f.destroy());
    this.followers = [];

    const config = EVOLUTION_MAP[this.playerLevel];

    // 更新物理半径和显示半径
    this.player.setRadius(config.radius);
    this.player.setFillStyle(config.color);
    this.player.body.setCircle(config.radius);

    this.tweens.add({
      targets: this.player,
      scaleX: 1.2, scaleY: 1.2, duration: 100, yoyo: true, repeat: 1
    });

    this.updateVueUI();

    // 触发自动保存
    this.game.events.emit('auto-save', {
      level: this.playerLevel,
      score: this.score,
      stomach: this.smallFishStomach
    });
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