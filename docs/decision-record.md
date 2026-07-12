# Decision record: Fronts 2.0 as an application runtime

Status: accepted for the 2.0 alpha

Date reviewed: 2026-07-13

## 结论

Fronts 2.0 有独立价值，但它不能重复 Module Federation 已经成熟的能力。Module Federation
2.7 已经提供独立 Runtime、Manifest/Snapshot、预加载、Runtime Plugin、动态类型、Chrome
DevTools，以及 React/Vue Bridge。若 Fronts 2.0 继续包装 `remoteEntry`、自建 shared 解析、
重写 bundler plugin，或者把 React 远程组件换一个名字，就会成为官方 Runtime 的脆弱分叉。

仍然存在的空白位于更高一层：企业宿主需要把“一个远程模块”提升为“一个可治理的应用实例”。
这包含统一生命周期、版本与租户策略、不同隔离容器、最小权限宿主能力、替换事务、失败回滚和
跨框架观测。MF Runtime 的职责是可靠地取得模块；这些应用级策略不应反向塞进 MF。

因此 Fronts 2.0 的定位是：

> 一个位于 Module Federation 之上的、传输无关且框架无关的 application runtime 与
> orchestration layer。

它不是另一个 Module Federation Runtime，也不是完整微前端云平台。

## 调研基线

本次实现对照了官方文档和本地提供的 `module-federation/core` 源码，源码基线为
[`37c97f6ec`](https://github.com/module-federation/core/commit/37c97f6ec96bcca573282cfba781ca42aefcd08d)。

MF 2 已经覆盖：

- 独立实例及纯 Runtime 用法：`createInstance()`；
- 动态 `registerRemotes()`、`loadRemote()`、`preloadRemote()`；
- Manifest/Snapshot 的资源、类型与 shared 元数据；
- Runtime Plugin 与装载全链路 hooks；
- shared 版本选择与多 share scope；
- React/Vue Bridge 的 render/destroy、路由协调和 React 数据预取；
- DevTools 的远端替换、依赖图和 loading trace；
- Node/SSR 与更多 bundler/framework 集成。

依据：官方 [Runtime API](https://module-federation.io/guide/runtime/runtime-api)、
[Runtime Hooks](https://module-federation.io/guide/runtime/runtime-hooks)、
[Manifest and Snapshot](https://module-federation.io/guide/basic/manifest-snapshot)、
[React Bridge](https://module-federation.io/guide/bridge/react/getting-started) 和
[MF 2 stable release](https://module-federation.io/blog/v2-stable-version)。

## 必须正视的官方 Bridge 重叠

官方 React Bridge 已经能把完整 React 应用导出、加载、渲染和销毁，并提供路由与数据预取。
Vue 3 Bridge 也提供相同方向的能力。因此：

- 只有 React/Vue + MF、无需平台治理时，应直接使用官方 Bridge；
- `@fronts/react` 与 `@fronts/vue3` 不是“官方 Bridge 的替代品”，而是 Fronts ABI 的生产者
  适配器；
- Fronts 的合理性必须由其框架无关 Host、resolver、容器隔离、capability、替换事务和治理能力
  共同证明；
- 后续可以提供 official Bridge ↔ Fronts ABI 的可选适配器，但核心不能依赖 Bridge 的内部实现。

## 决策矩阵

| 场景                                             | 建议                            |
| ------------------------------------------------ | ------------------------------- |
| 加载共享工具函数或组件                           | 直接使用 MF Runtime             |
| React/Vue 远程应用，官方 Bridge 已满足路由和渲染 | 使用 MF Bridge                  |
| 单框架、同信任域、固定远端地址                   | 通常不需要 Fronts               |
| 多框架应用统一装载/更新/卸载                     | Fronts                          |
| 按环境、租户、cohort、channel 动态选版本         | Fronts resolver + 外部 registry |
| DOM、Shadow DOM、iframe 采用统一 Host API        | Fronts containers               |
| 宿主 API 必须按应用声明和策略裁剪                | Fronts service scopes           |
| 候选部署需 ready 后原子切换、失败保留当前部署    | Fronts replacement transaction  |

## 采用的产品边界

### Fronts 2.0 负责

1. 稳定的 application ABI：`mount → ready → update/activate/deactivate → unmount`。
2. 每个实例的显式状态机、取消和幂等清理。
3. 将逻辑应用引用解析为不可变部署结果。
4. DOM、Shadow DOM、iframe 容器及按容器选择 loader。
5. 宿主服务按应用声明、宿主 policy 和实例生命周期授予。
6. readiness-gated replace、失败回滚和当前实例清理结果。
7. 生命周期事件、错误分段、审计和泄漏检测。
8. React 和 Vue 3 的边界适配。

### Fronts 2.0 委托给 MF

1. 远端注册、Manifest/Snapshot 和 remote entry。
2. expose 与 chunk/CSS 资源装载、预加载。
3. shared dependency 注册与选择。
4. Runtime Plugin 和底层装载 hook。
5. 类型产物、DevTools 和 bundler 集成。

### MVP 明确不做

- 新 bundler plugin 或新的 shared dependency resolver；
- 修改 MF 全局 Snapshot 或导入 `runtime-core` 私有路径；
- 自动抓取、重排或清除第三方 CSS；
- 完整 JavaScript sandbox；
- registry/deployment SaaS、控制台或 router 替代品；
- SSR/RSC 应用编排；
- 隐式全局事件总线。

## 成功标准

Fronts 2.0 只有同时满足以下条件才值得发布：

- `@fronts/mf` 只依赖官方公开 Runtime API；
- 核心不依赖 React、Vue 或某个 bundler；
- 每种容器与失败路径都有契约测试；
- 至少一个测试通过真实 MF Runtime 加载真实远端容器；
- 替换失败不会破坏当前可用实例；
- iframe 不使用通配 `targetOrigin`，服务调用受 capability 限制；
- npm 包在 ESM/CJS 和公开 subpath 下均可导入；
- 清空 `dist` 后的全新安装、构建、测试和发布检查可重复通过。

如果这些约束未来被官方 Runtime/Bridge 完整吸收，Fronts 应缩小甚至退役，而不是为了项目存在
而继续复制官方能力。
