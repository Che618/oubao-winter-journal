# 鸥宝越冬志

手机端单页翻书 H5。第一章接入真实日记、报道与现有图片；八章共用书本、导航、分页和回信组件。设计依据见 [SKILL.md](./SKILL.md)。项目已配置 GitHub Pages 自动发布流程，首次使用需启用仓库的 Pages 设置。

## 本地运行

需要 Node.js 22.12 或更新版本。项目使用 React、TypeScript、Vite，以及提供纸张卷曲效果的 StPageFlip。

```powershell
npm install
npm run dev
```

浏览器打开终端显示的本地地址。当前默认是 `http://127.0.0.1:5173/`。手机实际访问需在后续预览任务中另行开放局域网监听；这里默认只监听本机。

```powershell
npm run build     # 类型检查与正式构建，生成 dist，不会部署
npm run preview   # 本机预览构建产物
npm test          # Chrome 中运行浏览器回归测试
npm run test:pages # 对 dist 在仓库子路径下做浏览器验证，先执行 build
```

测试默认使用已安装的 Google Chrome，以独立的无界面进程运行，不使用个人浏览器配置。如果没有 Chrome，可安装 Playwright Chromium 后执行：

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm test
```

## GitHub Actions 构建与 Pages 发布

仓库内的 `.github/workflows/build.yml` 会在推送到 `main`、向 `main` 发起 PR 时构建，也支持手动运行。流程使用 Node.js 24，执行 `npm ci`、`npm run build` 与 `npm run test:pages`，将 `dist/` 保存为可下载产物。构建版测试在 `/oubao-winter-journal/` 子路径实际打开网页、解码背景图片并播放视频，失败则停止发布。`main` 的推送或手动运行通过后发布到 GitHub Pages；PR 不发布。

所有素材地址通过 `asset()` 以 `document.baseURI` 生成绝对URL。不能在CSS变量里直接使用 `./assets/...`：生产CSS位于 `assets/`，浏览器会将这种相对地址解析成 `assets/assets/...`，导致背景404。开发预览不会暴露这个问题，必须验证构建产物。

首次启用：打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。不需要再选择或生成其他模板工作流，本仓库已有完整配置。

然后打开 **Actions → Build website → Run workflow**，选择 `main` 并运行。等待 **Build and save dist**、**Publish to GitHub Pages** 两项均显示绿色勾。发布任务会输出访问网址，当前仓库默认地址为：

https://che618.github.io/oubao-winter-journal/

如果发布任务的 **Check Pages configuration** 提示 Pages 尚未启用，完成上面的 Source 设置，再手动运行一次。若 **github-pages** 环境要求审核，仓库管理员需要在运行页面点击 **Review deployments** 并批准。

在 GitHub 仓库中打开 **Actions → Build website**，点击最近一次运行查看状态。绿色勾表示构建成功；若失败，展开红色步骤查看日志。构建成功后，在该次运行底部的 **Artifacts** 中下载 `oubao-website-dist`，其中包含可放到静态服务器的网站文件，保留14天。

手动构建：打开 **Actions → Build website → Run workflow**，选择 `main`，再点击 **Run workflow**。后续推送代码时会自动运行，无需手动触发。

构建直接使用仓库中的 `public/assets` 和已生成的翻页模块，不运行依赖本机原始素材的 `npm run assets`。下载的 `dist` 需要通过 HTTP 静态服务预览，不能依赖双击 HTML 文件打开。

网页使用相对资源路径，可在仓库子路径下访问。构建任务只需读取仓库；发布任务单独获得 Pages 写入和部署身份令牌权限，不需要添加个人访问令牌。后续推送到 `main` 即自动更新网站，无须上传 `dist` 到代码分支。

## 页面与内容分离

```text
src/
├── content/
│   ├── types.ts                 章节、文稿、互动的类型约束
│   ├── chapters.ts              八章目录与章节按需加载注册表
│   └── chapters/
│       ├── chapter-01.ts        第一章独立内容
│       └── chapter-template.ts.example
├── book/
│   ├── paginate.ts              按实际字体与书页尺寸测量正文分页
│   ├── FlipBook.tsx             翻页、手势、相邻图片加载、视频暂停
│   └── storage.ts              本机阅读位置、回信存储
├── components/PageView.tsx      各类书页和互动呈现
├── vendor/page-flip.js          固定上游版本的生命周期修复产物
├── App.tsx                     页面组合、目录、阅读恢复与照片查看器
└── styles.css                  手机、桌面与短屏样式
public/assets/                  优化后的网页派生素材
scripts/                        素材处理与翻页库补丁生成脚本
tests/                          阅读流程、分页、多章节扩展回归测试
```

## 新增第二章或第三章

一般只需准备素材、填写一份内容文件、更新一条目录配置。无须复制 `App.tsx`、翻页组件或正文页，也不必手工计算每页字数。

1. 复制 `src/content/chapters/chapter-template.ts.example` 为 `chapter-02.ts`。第三章同理改为 `chapter-03.ts`。
2. 修改内容文件中的 `id`，填写开篇、日记、视频、报道、互动和章末文案。正文使用自然段数组，图片插入报道的 `blocks`。图片描述与署名应填写真实内容。
3. 将网页图片和视频放入 `public/assets/chapter-02/`。通过 `asset('chapter-02/文件名')` 引用。所有共享 IP 图可继续复用。
4. 在 `src/content/chapters.ts` 中，把对应章节改为：

```ts
{
  id: 'chapter-02', number: 2, title: '汇群', subtitle: '江边来了一群人',
  status: 'published',
  load: () => import('./chapters/chapter-02'),
}
```

5. 执行 `npm run build` 和 `npm test`，确认新章节文稿、图片与手机阅读效果后再交付审阅。

必须保持注册表、内容文件及资源目录中的章节 ID 对应。尚未准备好的章节继续使用 `upcoming`，正式产品不会加载测试专用的第二章演示内容。

### 快速生成新章节图片

脚本只读原始素材，派生图输出到 `public/assets`，不覆盖原图。新章节可直接指定原始照片目录：

```powershell
npm run assets -- --photos "红嘴鸥第二章/照片" --chapter chapter-02
```

输出按原始文件名排序，为 `photo-01.webp`、`photo-02.webp` 等，并在终端列出对应关系。确定正文引用后应保持这组文件的排序稳定；新增照片建议单独命名放入派生目录，避免重排已引用的编号。

不带参数执行 `npm run assets`，会重新生成当前第一章及共享 IP、按用途裁切的封面/目录/封套、纸张和原设计背景，共31张派生图，以及28张原图的来源清单 `public/assets/chapter-01-sources.json`。平时启动无须重复生成。照片最大宽1200px，设计场景和纸面使用无损 WebP。所有第一章图片均已接入网页，逐张用途见 `ASSET_USAGE.md`。

### 现有内容类型

- `opening`：每章独立开篇，标题、插画、介绍与旁注均由配置提供。
- `opening.companions`：可选家人或同行角色图，独立呈现并可放大。
- `contentsDesign`：可选本章目录纸面底图。第一章由「3 翻开封面页+目录 第一期 先至」裁出纸面，配合可点击的日记、影像、稿件、相簿、路线与回信导航；后续章按实际设计替换，未填写时使用通用目录。
- `album`：可选图册，放在稿件后；每项包含稳定的 `id`、标题和照片列表。手机建议每页两张照片，完整显示、按当前页及相邻页加载、点击放大。第一章18张照片编为9页，后续章直接配置，无须复制组件。
- `diary`：真实日期、天气、日记标题、自然段和落款。
- `video`：封面、简介，可选 `src`。存在视频才呈现播放控件；有 AI 内容时填写 `aiGenerated: true`，同时应在视频画面内制作标注。
- `article.blocks`：`paragraph` 自然段、`photo` 图片与图注、`subheading` 小标题。长自然段会自动拆页，保留全部文字。
- `journey`：可选路线与鸟瞰页。当前为已知起终点示意；360°体验只有在提供真实 `panoramaUrl` 后才显示入口。
- `activities`：可选互动数组，内置 `quiz` 单选课堂与 `link` 外部互动入口。后续新建拼图等类型只需扩展联合类型及对应渲染组件，翻页逻辑保持共用。
- `ending`：章末文字与可选下一章 ID。

新活动标题、选项和讲解由正式科普文稿提供。模板内的文字仅供填写参考，不应原样发布。

## 当前可用功能与边界

- 已实现封面、全书目录、章节开篇、日记、影像页、图文报道、起终点示意、鸟瞰照片和回信页。
- 支持左右滑动、拖动右下页角、前后翻页按钮、键盘方向键、书签跳转、照片放大及阅读位置恢复。
- 首页直接使用「2 翻开封面页」，不再另外插入扉页；「1 未翻开LOGO页」用于开场加载和合书封套；「3 …目录」用于本章可点击目录；「纯翻开空白页」用于真实场景背景和内容纸面。背景不加渐变、蒙色、伪造山水或漂移动画。`src/design.css` 按1511×2845画布和纸面矩形(136,418,1240,1835)对齐，保留原图中的江景、芦苇、书本投影与颜色。
- 共享动效包括角色轻摆、翻稳后的内容入场、目录逐行显现、路线虚线流动、回信爪印落章。右上角可暂停装饰动效并记住偏好；系统的减少动态效果设置会即时生效。动效集中在 `src/motion.css`，不影响正文分页尺寸，后续章节自动复用。
- 背景音乐为 Kevin MacLeod 的《Dream Culture》（CC BY 4.0），网页使用 `public/audio/dream-culture-web.mp3`（约2.14 MB、80 kbps），原下载文件保留在本地、不参与发布的 `local-audio-originals`。每次进入默认开启，立即预加载并尝试有声播放；浏览器拦截自动播放时，首次轻触页面或点击音乐按钮即可播放，不依赖翻书。浏览器策略优先，不能保证所有手机无操作自动出声。音量20%、循环播放，本次阅读手动关闭后不会因翻页、视频结束或返回前台而重开；重新进入页面恢复默认开启。目录底部有可见署名、转码说明和授权链接，详细来源见 `public/audio/CREDITS.md`。音轨在全书共享，切章和重新分页不重新开始。
- 正文按真实 DOM 测量分页，保持17px基础字号；极短屏幕的开篇、目录与回信等特殊页面允许纵向阅读，滚动区域与页脚分离。
- 日记正文与开篇介绍使用霞鹜文楷，「鸥宝日记」字标使用马善政毛笔字体；稿件继续使用原正文排版。字体随网站提供，SIL OFL许可位于 `public/fonts`。`predev`/`prebuild` 自动运行 `scripts/prepare-fonts.mjs`，从所有章节文本提取文楷字形以减少下载量；新增章节不需额外制作字体。分页前加载本章所需字体后再测量。
- 文稿正文按提供内容保留，原稿中的“协会协会”等重复字样未擅自修改。网页图注、引导短句及目录副标题为本次设计新增文案，后续需结合编辑意见审阅。
- 第一章视频已接入：原片为 `红嘴鸥第一章/视频/vidio.mp4`，网页副本为 `public/assets/chapter-01/vlog.mp4`，约68秒、1280×720、H.264/AAC、12.34 MB。放在日记后、稿件前，读者点击播放才加载；播放时暂停BGM，翻离时暂停，返回保留进度。用户已确认含AI画面，网页副本已烧录“本片含AI辅助画面”标识，简介也保留AI提示；原片未改动。生成命令为 `node scripts/prepare-video.mjs --ffmpeg "FFmpeg程序路径"`，脚本同时提取视频封面、启用faststart以支持边下边播。360°全景仍待补充；路线仅呈现已知起终点。
- 回信按章节保存到当前浏览器的 `localStorage`，支持重新编辑。没有服务器、账号、公开留言墙或后台审核；页面不会提示公开发布成功。
- 阅读记录也保存在本机。屏幕尺寸变化会重新分页并尽量保留页面 ID；同一页内容可能因重排略有位移。
- 仅当前页和相邻页加载正文图片；章节内容通过独立模块按需加载。
- 未进行微信 iOS／Android 真机验证。当前回归测试覆盖 Chrome 的320×568、390×844、1440×1000视口、尺寸变化、真实视频解码播放与BGM切换，以及构建版在仓库子路径下的资源加载。

## 翻页模块维护

上游 `page-flip` 固定为2.0.7。项目对其销毁逻辑做两项小修复：停止动画帧循环，以及移除窗口尺寸监听，避免多次切章、重新分页后累积实例。MIT 许可证保留在产物顶部。

`src/vendor/page-flip.js` 是 `npm run vendor` 的生成产物，不直接手改。更新上游时重新核对 `scripts/prepare-page-flip.mjs` 的补丁与生命周期测试；补丁不匹配会明确失败。
# oubao-winter-journal

