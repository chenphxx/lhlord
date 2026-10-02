import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * @brief Vite 构建与开发服务器配置
 *
 * 开发服务器将 /api 请求代理到本地后端
 */
export default defineConfig({
    plugins: [vue()],
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://127.0.0.1:7100',
        },
    },
});
