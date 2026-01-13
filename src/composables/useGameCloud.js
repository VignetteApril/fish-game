import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { event as gaEvent } from 'vue-gtag'; // 只保留 GA

const user = ref(null)

export function useGameCloud() {

    // === 1. 登录逻辑 ===
    const login = async (providerName = 'google') => {

        // --- Google Analytics 埋点 ---
        gaEvent('login', {
            method: providerName,
            event_category: 'engagement',
            event_label: 'Login Button'
        });

        console.log(`📡 [GA] Tracking login click: ${providerName}`);

        // 开始 OAuth 流程
        const { error } = await supabase.auth.signInWithOAuth({
            provider: providerName,
            options: { redirectTo: window.location.origin }
        })

        if (error) {
            console.error('Login failed:', error);

            // --- GA 错误上报 ---
            gaEvent('exception', {
                description: `Login Error: ${error.message}`,
                fatal: false
            });
        }
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

    // === 3. 上传存档 ===
    const saveGameData = async (gameData) => {
        if (!user.value) return

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
            if (error.code === 'PGRST116') {
                console.log('👶 新用户，无云端存档');
                return null;
            }
            console.error('❌ 读取存档失败:', error);
            return null;
        }

        console.log('✅ 读取云端存档成功:', data);
        return data;
    }

    // === 5. 通用埋点工具函数 (只发 GA) ===
    const logEvent = (eventName, params = {}) => {
        // 直接发送给 Google
        gaEvent(eventName, params);
    }

    return {
        user,
        login,
        logout,
        checkSession,
        saveGameData,
        loadGameData,
        logEvent
    }
}