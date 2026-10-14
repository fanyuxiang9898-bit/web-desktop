# 选型与验收

调研与本地验证日期：2026-10-14。

## 用户目标

现有网站中的元素像手机桌面图标一样：可拖动、可放大缩小、可交换位置、可复原、可自动补位。用户明确不需要传统列表排序。

## GitHub 候选

| 项目 | 匹配点 | 结论 |
| --- | --- | --- |
| [GridStack](https://github.com/gridstack/gridstack.js) | 网格、尺寸、碰撞、compact、保存；引擎可独立于 DOM 使用 | 采用 14.0.0 引擎；不 fork 整个仪表盘项目 |
| [Swapy](https://github.com/TahaSh/swapy) | 拖动交换 slot | 交换契合，但不是完整缩放和补位方案 |
| [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout) | 拖动、缩放、响应式网格 | 更适合自己控制 React 渲染的页面；不适合直接接管第三方 DOM |
| [Design Mode](https://github.com/SandeepBaskaran/design-mode) | 原网页可视化编辑 | 主交互是设计编辑；与桌面网格补位目标不同 |

技术依据：[GridStackEngine](https://gridstackjs.com/doc/html/classes/GridStackEngine.html) 的无 DOM 布局计算，以及 compact、moveNode、addNode API。

## 实现取舍

保留节点和父节点，避免克隆事件丢失、表单归属改变、框架子树被移动。用可恢复的 inline 样式覆盖坐标/尺寸；编辑控件放在独立 Shadow DOM 中。仅恢复仍由本工具持有的样式值，不覆盖网站随后自己写入的值。

使用 GridStack 执行碰撞和补位；同尺寸交换先进行原子坐标交换，不同尺寸则为目标元素预留空间并重新布局。每次操作检查所有组件无重叠、边界有效、ID 不丢失。

保存按页面路径隔离；宿主授权按网站申请，启用网站记录保存在扩展 storage。启动时重新核对授权并重建动态 content script 注册，处理浏览器重启或解压扩展重新加载后注册丢失的情况。

## 验收证据

- 5 项引擎测试，含 250 次确定性随机布局事务。
- 13 项真实浏览器交互检查。
- 8 项实际 MV3 扩展检查，含完整浏览器关闭再启动。
- 16 项公开网站检查：Wikipedia / Wiktionary 语言入口，真实鼠标拖放、缩放、自动补位、像素边界、刷新及完整样式复原。
- 详见 `tests/`；运行结果写入忽略提交的 `test-results/`。

测试不证明任意第三方网站兼容，也没有绕过浏览器授权：测试版单独预授权 localhost 或两个测试网站，正式版由用户在浏览器中确认。

## 0.1.1 修复

容器先移除 padding 再测量网格宽度，避免 content-box 首次布局与后续操作宽度不同。样式记录保存 CSSOM 实际归一化的值，避免小数像素比较失败导致复原残留，同时保留网站后续自己修改的属性。两项均有浏览器回归测试。

测试网络曾出现超时；导航最多重试一次，失败不计通过。Python 和 W3C 官网未完成验证。两个通过的网站均属于相近的门户结构，不能据此推断复杂 SPA、登录业务站或原生 App 兼容。
