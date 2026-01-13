import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { track } from '@vercel/analytics'; // 1. 引入 Analytics

const user = ref(null)

export function useGameCloud() {
    // === 1. 登录逻辑 (集成埋点) ===
    // 修改点：接收 providerName 参数，默认值为 'github'
    const login = async (providerName = 'google') => {

        // 2. 【核心埋点】记录用户点击了登录
        track('Login Clicked', {
            provider: providerName,
            timestamp: new Date().toISOString()
        });

        console.log(`📡 [Analytics] Tracking login click: ${providerName}`);

        // 3. 开始 OAuth 流程
        const { error } = await supabase.auth.signInWithOAuth({
            provider: providerName, // 使用传入的参数 (github 或 google)
            options: { redirectTo: window.location.origin }
        })

        if (error) {
            console.error('Login failed:', error);
            // (可选) 上报登录错误
            track('Login Error', { provider: providerName, error: error.message });
        }
    }

    const logout = async () => {
        await supabase.auth.signOut()
        user.value = null
        window.location.reload() // 刷新页面清除状态
    }

    // === 2. 检查当前用户 ===
    const checkSession = async () => {
        const { data } = await supabase.auth.getSession()
        user.value = data.session?.user || null
        return user.value
    }

    // === 3. 上传存档 (Upsert) ===
    const saveGameData = async (gameData) => {
        if (!user.value) return // 游客不存档

        const { level, score, stomach } = gameData
        const { error } = await supabase
            .from('game_saves')
            .upsert({
                user_id: user.value.id,
                level,
                score,
                stomach,
                updated_at: new Date()
            })

        if (error) console.error('Save failed:', error)
        else console.log('☁️ Auto-saved to cloud!')
    }

    // === 4. 读取存档 (处理新用户) ===
    const loadGameData = async () => {
        if (!user.value) return null

        const { data, error } = await supabase
            .from('game_saves')
            .select('*')
            .single()

        if (error) {
            // 如果错误代码是 PGRST116，说明是“无结果”，即新用户
            if (error.code === 'PGRST116') {
                console.log('👶 新用户，无云端存档');
                return null; // 返回 null，代表从 1 级开始
            }

            // 其他错误才是真的出事了
            console.error('❌ 读取存档失败:', error);
            return null;
        }

        console.log('✅ 读取云端存档成功:', data);
        return data;
    }

    return {
        user,
        login,
        logout,
        checkSession,
        saveGameData,
        loadGameData
    }
}