// 先把完整首页显示出来，再下载应用与字体，避免首屏图片和整套脚本争抢慢网带宽。
const cover = document.querySelector<HTMLImageElement>('#startup-cover img');
void (cover?.decode().catch(() => {}) ?? Promise.resolve()).then(() => import('./main'));
export {};
