import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
// 1. 引入 vue-gtag
import VueGtag from "vue-gtag-next"

const app = createApp(App)

// 2. 挂载并配置 ID
app.use(VueGtag, {
    property: {
        id: "G-6X95LP8LJS" // 你的 ID
    }
})

app.mount('#app')