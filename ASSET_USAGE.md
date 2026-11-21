# 第一章图片用途对照

用户要求：`红嘴鸥第一章` 中全部28张图片都接入网页。原文件保持不变，网页使用 `public/assets` 中的优化派生图；素材源文件与派生图的完整对应另见 `public/assets/chapter-01-sources.json`。

顺序为封面 → 目录 → 原设计扉页与章节页 → 角色介绍与日记 → 视频 → 稿件 → 汉江影像 → 迁徙与鸟瞰 → 回信 → 留白页与封套。18张照片都可以在9页「汉江影像」中看到，点击可放大；稿件和鸟瞰保留原有主题配图。

## 日记本与角色图：10张

| 原文件 | 网页派生图 | 读者可见位置 |
| --- | --- | --- |
| 1 未翻开LOGO页 设计 zsr.png | notebook-logo.webp | 章末「合上日记，下次再见」完整封套 |
| 2 翻开封面页 设计 zsr.png | notebook-title.webp | 目录后「日记扉页」，完整原设计 |
| 3 翻开封面页+目录 第一期 先至 设计 zsr.png | notebook-chapter.webp | 扉页后「第一章 · 先至」，完整原设计 |
| 日记本单页.png | paper.webp | 阅读书页与目录的纸张底图 |
| 欧宝脚印.png | footprint.webp | 封面、开篇与回信落章 |
| 纯翻开空白页   备选.png | notebook-blank.webp；river-watercolor.webp | 章末「把下一页留给冬天」完整设计，另派生江景背景 |
| 欧宝 1 zsr.png | oubao.webp | 开篇鸥宝介绍、迁徙路线 |
| 红嘴鸥一家三口.png | family.webp | 封面一家三口 |
| 红嘴鸥妈妈形象设计.png | mother.webp | 开篇家人介绍「妈妈」，可放大 |
| 鸥爸1 zsr.png | father.webp | 开篇家人介绍「爸爸」，可放大 |

## 实景照片：18张

以下派生图位于 `public/assets/chapter-01`，均完整显示，不裁掉主体。

| 原文件 | 派生图 | 汉江影像页 |
| --- | --- | --- |
| CELH7770.JPG | photo-01.webp | 01 在汉江，轻轻落脚 |
| CHFM0093.JPG | photo-02.webp | 02 风从翅膀下经过；另用于视频封面、稿件 |
| CUDF9165.JPG | photo-03.webp | 01 在汉江，轻轻落脚 |
| CXRK5470.JPG | photo-04.webp | 03 每一次振翅 |
| DFGI3060.JPG | photo-05.webp | 03 每一次振翅 |
| DJI_20261110160250_0221_D.JPG | photo-06.webp | 06 岸边，都是相逢；另用于鸟瞰 |
| DJI_20261110161556_0245_D.JPG | photo-07.webp | 06 岸边，都是相逢；另用于稿件 |
| FQUA0023.JPG | photo-08.webp | 04 暖光里的身影 |
| FYDZ0370.JPG | photo-09.webp | 04 暖光里的身影 |
| THYM2906.JPG | photo-10.webp | 05 和江水打个招呼 |
| TPDP5157.JPG | photo-11.webp | 07 江边来了许多人 |
| UNOC3537.JPG | photo-12.webp | 02 风从翅膀下经过 |
| XQMY3453.JPG | photo-13.webp | 09 把约定留给晚霞；另用于稿件 |
| 微信图片_20261120103455_203_64.jpg | photo-14.webp | 08 在这座城的冬天；另用于稿件 |
| 微信图片_20261120103456_204_64.jpg | photo-15.webp | 09 把约定留给晚霞 |
| 微信图片_20261120103458_205_64.jpg | photo-16.webp | 07 江边来了许多人 |
| 微信图片_20261120103500_206_64.jpg | photo-17.webp | 08 在这座城的冬天 |
| 微信图片_20261120103502_207_64.jpg | photo-18.webp | 05 和江水打个招呼 |

原设计图中的字样保持原图，不修改原素材。网页图注与相簿标题为编排新增文案，不作为原始新闻事实的补充。

验证：`tests/assets.spec.ts` 核对28项来源、网页实际引用、18张相簿照片去重覆盖，并逐页检查手机端的加载、完整显示和放大功能。
