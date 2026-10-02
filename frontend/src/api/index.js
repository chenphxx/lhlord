import axios from 'axios';

/**
 * @brief 统一的 axios 实例
 *
 * 以 /api 为前缀, 供各组件调用后端接口
 */
const api = axios.create({
    baseURL: '/api',
    timeout: 20000,
});

export default api;
