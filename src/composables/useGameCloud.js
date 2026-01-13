import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)

export function useGameCloud() {
    // === 1. 登录逻辑 ===
    const login = async () => {
        // 这里演示 GitHub 登录，记得在 Supabase 后台 Auth -> Providers 里启用 GitHub
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin } // 登录后跳回当前页
        })
        if (error) console.error('Login failed:', error)
    }

    const logout = async () => {
        await supabase.auth.signOut()
        user.value = null
        window.location.reload()
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

    // === 4. 读取存档 ===
    const loadGameData = async () => {
        if (!user.value) return null

        const { data, error } = await supabase
            .from('game_saves')
            .select('*')
            .single()

        if (error) {
            // === 关键修改 ===
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