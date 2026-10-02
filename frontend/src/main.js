/**
 * @brief 前端应用入口
 *
 * 创建 Vue 应用并注册 Element Plus 与中文语言包
 */
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import './styles/theme.css';
import App from './App.vue';

const app = createApp(App);
app.use(ElementPlus, { locale: zhCn });
app.mount('#app');
