# 🐟 进化：大鱼吃小鱼

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Tech Stack](https://img.shields.io/badge/Vue3-Phaser3-blueviolet)
![Vibe Coding](https://img.shields.io/badge/Dev_Mode-Vibe_Coding-ff69b4)

> **一次“Vibe Coding”实验：** 使用自然语言编程 (Natural Language Programming) 在 1 小时内构建的无限地图生存游戏。

## 📖 项目简介

本项目是一个概念验证 (PoC) 作品，旨在验证 **"Vibe Coding" (直觉编程/AI 辅助开发)** 工作流的可行性。核心目标是模拟从“代码执行者 (Coder)”向“架构设计者 (Architect)”的角色转变——即由人类负责逻辑编排与架构设计，让 AI 生成 95% 的具体实现代码，从而实现极速交付。

游戏本身是一款基于浏览器的“类 Agario 风格”生存游戏，玩家需要在大地图中通过吞噬其他鱼类，从一只小蝌蚪一路进化为神话中的龙。

## 🧪 工程理念 (Vibe Coding)

* **零样板代码 (Zero-Boilerplate)：** 拒绝在环境搭建、物理引擎基础配置上手工浪费时间。
* **提示词驱动开发 (Prompt-Driven Development)：** 碰撞检测、进化阈值、摄像机跟随等核心逻辑均通过自然语言描述生成。
* **架构优先 (Architecture First)：** 严格遵循关注点分离原则：
    * **Phaser 3：** 负责物理引擎 (Arcade)、渲染循环和空间哈希计算。
    * **Vue 3：** 负责 HUD 界面、响应式状态管理 (分数、等级) 和 DOM 覆盖层。
    * **EventBus：** 实现游戏引擎与 UI 层的彻底解耦。

## 🛠 技术栈

* **前端框架：** Vue 3 (Composition API)
* **游戏引擎：** Phaser 3
* **构建工具：** Vite
* **语言：** JavaScript (ES6+)
* **美术资源：** 程序化生成 (Phaser Graphics) - *为追求 MVP 效率，零外部图片素材依赖。*

## 🎮 游戏机制

### 核心循环
1.  **吃低级鱼：** 填充“消化槽” (每吃 3 条低级鱼 = 1 个挂件/经验球)。
2.  **吃同级鱼：** 直接增加 1 个挂件/经验球，并跟随在玩家身边。
3.  **进化：** 当集齐 **3 个挂件** 时，触发进化，体型变大并升级。

### 进化链
`蝌蚪` → `金鱼` → `食人鱼` → `剑鱼` → `大白鲨` → `虎鲸` → `深海巨怪` → `中国龙`

## 🏗 架构设计

```mermaid
graph TD
    UserInput[用户输入: 鼠标移动] --> PhaserEngine

    subgraph "游戏逻辑层 (Phaser)"
        PhaserEngine[MainScene.js] --> Physics{物理碰撞检测}
        Physics -- 敌人 > 玩家 --> GameOver[游戏结束]
        Physics -- 敌人 <= 玩家 --> EatLogic[吞噬逻辑]

        EatLogic -- 吃同级 --> Stack[++挂件数]
        EatLogic -- 吃低级 --> Stomach[++消化槽]
        Stomach -- 满(3) --> Stack

        Stack -- 满(3) --> Evolution[进化: 等级+1 / 体积变大]
    end

    subgraph "UI 交互层 (Vue)"
        Evolution --> EventBus[事件总线]
        EventBus --> ReactiveState[响应式数据 Ref]
        ReactiveState --> DOM[更新 DOM: 分数/进度条]
    end