# 雅御官网首版艺术资源

- 书法标识与红印：来自用户提供的雅御科技山水业务图，原作裁切并保守移除背景，未重新生成书法。
- `business-overview.webp`：用户原图的压缩版本，供业务全景查看。
- `yayu-hero.webp`：GPT Image 2 生成的青绿山水品牌背景，2048 × 1152。
- `yayu-industry.webp`：GPT Image 2 生成的山水产业园概念插图，1536 × 1024。页面标注为概念图，不作为已交付项目实拍。
- `favicon.png`：从原作品牌红印裁切生成。

艺术资源位于 `eiscore-base/public/enterprise-assets/yayu`，由既有 Vite 静态资源流程收录。

原始生成图、两份完整提示词与生成来源记录保留在工作区 `output/imagegen/yayu-website-v1`。官网业务文案依据用户提供的 12 页公司介绍及 6 页园区合作方案整理；原材料和完整 PPT 未作为公开下载文件发布。

## 本地预览

安装宿主依赖后，在本工作树执行：

```powershell
npm --prefix eiscore-base ci --no-audit --no-fund
node deploy/yayu/preview.mjs
```

入口为 `http://127.0.0.1:18420/login`。该预览提供雅御独立公开配置与内容，阻止请求默认本地业务代理，避免误接其他企业数据；企业登录弹窗可预览，真实认证继续使用正式雅御站点。
