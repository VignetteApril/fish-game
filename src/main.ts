import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
// 1. 引入 vue-gtag
import VueGtag from "vue-gtag"

const app = createApp(App)

// 2. 挂载并配置 ID
app.use(VueGtag, {
    config: {
        id: "G-6X95LP8LJS" // 记得换成你的衡量 ID
    }
})

app.mount('#app')