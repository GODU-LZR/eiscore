// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

// Curated from the two independent-site research packs supplied in
// C:\Users\Twist\Desktop\经纬网厂. The files are cached locally for stable
// delivery, while the original URL remains available for attribution and
// rights review. These are research references until the factory confirms
// commercial usage in writing.
const entries = [
  ['gallery-001.png', '湛江市经纬网厂 / 经纬实业厂区大门', 'Jingwei Netting Factory entrance', '企业与工厂', 'Factory & company', 'https://www.cnnpn.cn/uploadfile/2024/1102/20241102110543681.png', '企业本体明确', 'Factory identity reference'],
  ['gallery-002.png', '产品生产车间', 'Production workshop', '企业与工厂', 'Factory & company', 'https://www.cnnpn.cn/uploadfile/2024/1102/20241102110555106.png', '企业本体明确', 'Factory identity reference'],
  ['gallery-003.png', '大型网衣装配车间', 'Large net assembly workshop', '企业与工厂', 'Factory & company', 'https://www.cnnpn.cn/uploadfile/2024/1102/20241102110606315.png', '企业本体明确', 'Factory identity reference'],
  ['gallery-004.jpg', '广东海洋大学培训班参观现场', 'GDOU training visit to the factory', '交流与来访', 'Visits & exchange', 'https://jxjy.gdou.edu.cn/__local/D/00/9F/C9FC78D98013311D4341B6D038F_9ED72DD2_30550.jpg', '现场交流参考', 'Visit reference'],
  ['gallery-005.webp', 'PE 养殖网箱', 'PE farmed fishing net cage', '产品与网箱', 'Products & cages', 'https://img13.fr-trading.com/3/1_833_54138_756_756.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-006.webp', '深海浮式网箱', 'Deep-sea floating net cage', '产品与网箱', 'Products & cages', 'https://img13.fr-trading.com/3/1_541_54448_800_800.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-007.webp', '方形浮式网箱', 'Square floating net cage', '产品与网箱', 'Products & cages', 'https://img13.fr-trading.com/3/1_722_54194_800_572.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-008.webp', 'PE 有结网 / 三股捻线', 'PE knotted net / three-strand twine', '产品与网衣', 'Products & netting', 'https://img13.fr-trading.com/3/1_49_54110_800_800.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-009.webp', '聚乙烯无结网', 'Polythene knotless net', '产品与网衣', 'Products & netting', 'https://img13.fr-trading.com/3/1_458_54086_800_705.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-010.webp', '尼龙 Raschel 无结网', 'Nylon Raschel knotless net', '产品与网衣', 'Products & netting', 'https://img13.fr-trading.com/3/1_689_54238_800_600.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-011.webp', '多股渔网 / 刺网', 'Multifilament fishing gill net', '产品与网衣', 'Products & netting', 'https://img13.fr-trading.com/3/1_118_54334_598_800.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-012.webp', '多股渔网细节', 'Multifilament fishing net detail', '产品与网衣', 'Products & netting', 'https://img13.fr-trading.com/3/1_106_54422_598_800.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-013.webp', 'PP 多股三股捻绳', 'PP multifilament three-strand rope', '绳线产品', 'Rope & twine', 'https://img13.fr-trading.com/3/1_10_54200_569_569.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-014.webp', 'PE / PP / 尼龙 / 涤纶绳', 'Braided or twisted PE, PP, nylon and polyester rope', '绳线产品', 'Rope & twine', 'https://img13.fr-trading.com/3/1_374_54490_768_768.jpg.webp', 'B2B 产品参考', 'B2B product reference'],
  ['gallery-015.jpeg', '“湛江湾 1 号”深远海养殖平台', 'Zhanjiang Bay No. 1 offshore aquaculture platform', '案例参考', 'Case reference', 'https://new-img.gdzjdaily.com.cn/a/10001/202511/0eb8c54eb6c51057920988043edeea39.jpeg', '媒体案例参考', 'Media case reference'],
  ['gallery-016.jpg', '“海威 2 号”智能养殖平台', 'Haiwei 2 intelligent aquaculture platform', '案例参考', 'Case reference', 'https://imgpolitics.gmw.cn/attachement/jpg/site2/20231105/18c04d00990c26b189a22f.jpg', '政府媒体参考', 'Government media reference'],
  ['gallery-017.jpg', '湛江金鲳鱼深海养殖捕捞', 'Deep-sea golden pompano harvest in Zhanjiang', '海洋牧场参考', 'Marine ranch reference', 'https://english.news.cn/20230530/84291df5bfad47bdb0a924969f9990a2/2023053084291df5bfad47bdb0a924969f9990a2_035e204f-66cb-4b46-a104-4c4a27b515cf.jpg', '区域产业参考', 'Regional industry reference'],
  ['gallery-018.jpeg', '湛江金鲳鱼收获场景', 'Golden pompano harvest in Zhanjiang', '海洋牧场参考', 'Marine ranch reference', 'https://new-img.gdzjdaily.com.cn/a/10001/202211/e97e342adf321301e659f8c1cf0b9d4b.jpeg', '区域产业参考', 'Regional industry reference'],
  ['gallery-019.jpg', '蓝海 / BLUE OCEAN 注册商标图样', 'BLUE OCEAN registered trademark specimen', '品牌与商标', 'Brand & trademark', 'https://tm.aliyun.com/detail/7f2e_6712883_22', '商标线索，待授权', 'Trademark lead, authorization pending'],
  ['gallery-020.jpg', 'JW 圆形企业标识线索', 'JW circular identity lead', '品牌与商标', 'Brand & trademark', 'https://www.cnnpn.cn/uploadfile/2026/0518/20260518115543695.jpg', 'VI 线索，待确认', 'VI lead, confirmation pending'],
  ['gallery-021.jpeg', '粤府鲜视觉标识 / 围裙实拍', 'Yuefuxian identity on an apron', '品牌与商标', 'Brand & trademark', 'https://idea-cp.cnfin.com/ice/2025/09/08/fae8fdff28f5413d9a6a6953834033d0.jpeg', '关联品牌参考', 'Associated brand reference'],
  ['gallery-022.jpg', '张春文核电厂冷源安全论坛报告', 'Zhang Chunwen nuclear plant cooling-source forum talk', '人物与技术', 'People & technology', 'https://www.cnnpn.cn/uploadfile/2026/0518/20260518115536372.jpg', '公开活动参考', 'Public event reference'],
  ['gallery-023.jpg', '张春文论坛主旨报告 / JW 标识', 'Forum keynote with the JW identity clue', '人物与技术', 'People & technology', 'https://www.cnnpn.cn/uploadfile/2026/0518/20260518115543695.jpg', '公开活动参考', 'Public event reference'],
  ['gallery-024.jpg', '张春文论坛演讲近景', 'Close view of the forum talk', '人物与技术', 'People & technology', 'https://www.cnnpn.cn/uploadfile/2026/0518/20260518115553557.jpg', '公开活动参考', 'Public event reference'],
  ['gallery-025.jpeg', '金鲳鱼捕捞场景', 'Golden pompano fishing scene', '海洋牧场参考', 'Marine ranch reference', 'https://idea-cp.cnfin.com/ice/2025/09/08/120cddfef844457782c5809093e9f66e.jpeg', '媒体图片参考', 'Media image reference'],
  ['gallery-026.jpeg', '海洋牧场 / 网箱养殖航拍', 'Aerial view of marine ranching cages', '海洋牧场参考', 'Marine ranch reference', 'https://idea-cp.cnfin.com/ice/2025/09/08/d96408329e104eb5a54ed5bfb8d580aa.jpeg', '媒体图片参考', 'Media image reference'],
  ['gallery-027.webp', 'Polythene Knotted Net', 'Polythene knotted net', '历史外贸产品', 'Historical export products', 'https://image.made-in-china.com/155f0j00lejasoLWnVbH/Polythene-Knotted-Net.webp', '历史产品参考', 'Historical product reference'],
  ['gallery-028.webp', 'Nylon Monofilament Fishing Line', 'Nylon monofilament fishing line', '历史外贸产品', 'Historical export products', 'https://image.made-in-china.com/202f0j00WCZajwIbLVqP/Nylon-Monofilament-Fishing-Line.webp', '历史产品参考', 'Historical product reference'],
  ['gallery-029.webp', 'Polyester Multifilament Fishing Net', 'Polyester multifilament fishing net', '历史外贸产品', 'Historical export products', 'https://image.made-in-china.com/202f0j00ivjQKILwfhcH/Polyester-Multifilament-Fishing-Net.webp', '历史产品参考', 'Historical product reference'],
  ['gallery-030.webp', 'Nylon / Polyester Twine Spool', 'Nylon or polyester twine spool', '历史外贸产品', 'Historical export products', 'https://image.made-in-china.com/155f0j00VBsEjSIgnWkL/Nylon-Polyester-Twine-Spool.webp', '历史产品参考', 'Historical product reference'],
  ['gallery-031.webp', 'Rope', 'Rope', '历史外贸产品', 'Historical export products', 'https://image.made-in-china.com/202f0j00IMstLfbGaiqc/Rope.webp', '历史产品参考', 'Historical product reference']
]

export const JINWEI_RESEARCH_IMAGES = Object.freeze(entries.map((item, index) => {
  const [file, title, titleEn, category, categoryEn, source, rights, rightsEn] = item
  return Object.freeze({
    id: `gallery-${String(index + 1).padStart(3, '0')}`,
    src: `research-gallery/${file}`,
    title,
    titleEn,
    category,
    categoryEn,
    source,
    rights,
    rightsEn,
    alt: `${title}（经纬独立站调研图集）`,
    altEn: `${titleEn} (Jingwei independent-site research pack)`
  })
}))

export const JINWEI_RESEARCH_GROUPS = Object.freeze([
  { id: 'all', label: '全部图集', labelEn: 'All research images' },
  ...[...new Map(JINWEI_RESEARCH_IMAGES.map((item) => [item.category, item.categoryEn]))].map(([label, labelEn], index) => ({
    id: `group-${index + 1}`,
    label,
    labelEn
  }))
])
