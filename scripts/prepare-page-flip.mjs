import { readFile, writeFile, mkdir } from 'node:fs/promises';

// 固定上游2.0.7，修复生命周期，并把翻页动画克隆设为不可交互的装饰。
// 将产物纳入项目，运行网页不依赖此脚本；升级上游时必须重新检查补丁。
const root = new URL('../', import.meta.url);
let code = await readFile(
  new URL('node_modules/page-flip/dist/js/page-flip.module.js', root),
  'utf8',
);
const patches = [
  [
    'this.copiedElement=this.element.cloneNode(!0),this.element.parentElement.appendChild(this.copiedElement)',
    'this.copiedElement=this.element.cloneNode(!0),this.copiedElement.setAttribute("aria-hidden","true"),this.copiedElement.inert=true,this.copiedElement.dataset.flipCopy="true",this.element.parentElement.appendChild(this.copiedElement)',
  ],
  [
    'start(){this.update();const t=e=>{this.render(e),requestAnimationFrame(t)};requestAnimationFrame(t)}',
    'start(){this.stopped=false;this.update();const t=e=>{if(this.stopped)return;this.render(e),this.frame=requestAnimationFrame(t)};this.frame=requestAnimationFrame(t)}stop(){this.stopped=true,cancelAnimationFrame(this.frame),this.finishAnimation()}',
  ],
  [
    'destroy(){this.app.getSettings().useMouseEvents&&this.removeHandlers(),this.distElement.remove(),this.wrapper.remove()}',
    'destroy(){this.removeHandlers(),this.distElement.remove(),this.wrapper.remove()}',
  ],
  [
    'destroy(){this.ui.destroy(),this.block.remove()}',
    'destroy(){this.render.stop(),this.ui.destroy(),this.block.remove()}',
  ],
];
for (const [before, after] of patches) {
  if (!code.includes(before) || code.indexOf(before) !== code.lastIndexOf(before))
    throw new Error('翻页库版本发生变化，请人工复核补丁。');
  code = code.replace(before, after);
}
await mkdir(new URL('src/vendor/', root), { recursive: true });
const license = await readFile(new URL('node_modules/page-flip/LICENSE', root), 'utf8');
await writeFile(
  new URL('src/vendor/page-flip.js', root),
  `/* StPageFlip 2.0.7 — lifecycle fixes by this project.\n${license}\n*/\n${code}`,
);
console.log('已生成含生命周期修复的翻页模块。');
