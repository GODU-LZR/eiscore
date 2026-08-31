# @eiscore/platform

EISCore 前端平台契约的单一来源。当前提供企业配置、导航、HTTP/Axios、Auth/Session、安全存储、登录品牌、系统配置和前端权限判断能力；尚未完成的跨模块导航、非会话存储与共享 Grid 迁移由 G2 退出审计持续跟踪。

业务应用只能依赖公开的 `exports`，不得引用包内未导出的文件。
