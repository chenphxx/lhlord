import "./styles.css";


const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot)
{
    throw new Error("缺少 #app 容器");
}

appRoot.innerHTML = `
    <main class="boot-screen">
        <div class="boot-seal">谱</div>
        <p class="eyebrow">LHLORD · CATALOG</p>
        <h1>万象谱</h1>
        <p>修仙世界的名册与器物将在此展开</p>
    </main>
`;
