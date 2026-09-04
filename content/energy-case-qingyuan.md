# 一期分镜稿 = 一个文件。复制本文件改内容即可出新片。
# 语法极简：`## 卡型` 开头定卡片，下面 `字段: 值` 填内容。
# broll: 关键词 用于自动从 Pexels 下载视频背景（避免纯信息卡单调）
# caption = 原文解说词（TTS 读什么，字幕就显示什么），≤40字（约2行）
# point = 从该段解说词中提炼的核心信息和数字（视觉卡片）
# 支持卡型见底部注释。跑: bash scripts/case-publish.sh energy-case-qingyuan

## meta
title: 千亿级发电大模型，如何改写电厂的底层逻辑
theme: energy
voice: Brian

## head
subtitle: 国家能源集团 · 擎源大模型案例速览
caption: 当人工智能遇上传统能源，一场静悄悄的革命正在发生。
broll: power plant aerial view sunset

## head
subtitle: 国家能源集团 · 擎源大模型案例速览
caption: 这里是《能源行业智能转型案例说》，每天一个真实案例，带你看见能源行业的智能未来。
broll: power plant aerial view sunset

## points
kicker: 发电行业的四大共性痛点
point: 安全风险高——高温高压环境，设备故障可能酿成重大事故
point: 交易决策难——市场化改革，如何在复杂市场做出最优决策
point: 多能协同复杂——火电水电风电光伏，如何协同调度实现效益最大化
point: 设备运维被动——事后维修模式，成本高昂且非计划停机
caption: 发电行业，关系着国计民生的基础产业，长期以来面临着几大共性痛点——
broll: power plant control room operators

## points
kicker: 传统手段已难突破
point: 传统手段已难以突破四大共性痛点
point: 人工智能正在打开一扇新的大门
caption: 这些痛点，靠传统手段已难以突破。而人工智能，正在打开一扇新的大门。
broll: futuristic data center AI

## points
kicker: 擎源大模型 · 全球首个千亿级发电专用大模型
point: 2026年6月正式发布，全球首个千亿级参数的发电行业专用大模型
point: 三横三纵N域——算力层数据层算法层三大底座，覆盖火电水电新能源三板块
point: 覆盖安全环保、电力交易、产调中枢、设备检修四大业务域
caption: 2026年6月，国家能源集团正式发布擎源大模型——全球首个千亿级发电专用大模型。
broll: data center servers AI

## points
kicker: 吃数据长大的大模型
point: 310万个测点遍布火电、水电、风电、光伏电站
point: 涵盖温度、压力、振动、电流等数十种参数
point: 基于这一数据底座，孵化出41个业务智能体
caption: 为了让大模型真正懂发电，集团拿出了310万个测点的实时运行数据来训练。
broll: data dashboard analytics

## stats
kicker: 41个智能体 · 各有分工
row: 智能安全卫士 安全环保风险识别与预警
row: 多能调度指挥官 多能协同优化调度
row: 电力交易参谋 电力市场交易决策支持
row: 设备检修管家 设备预测性维护与检修辅助
caption: 基于这一数据底座，擎源大模型孵化出41个业务智能体，每个都有自己的角色名——
broll: futuristic control room screens

## points
kicker: 定州电厂 · 破局数据孤岛
point: 集团下辖数百家电厂，DCS、SIS、MIS系统各不相同
point: 集团花了两年时间建立统一数据中台，让数据真正流动起来
caption: 擎源大模型的落地，并非一蹴而就。第一个关键挑战，是打破数据孤岛。
broll: thermal power plant worker operating

## points
kicker: 定州电厂 · 让一线工人信任AI
point: 过去每天3700多次操作，如今降至249次，锐减91.8%
point: 一开始老师傅不敢用——机器能比我更懂锅炉？
caption: 第二个关键挑战，是让一线工人信任AI。日均操作量降至249次，锐减91.8%。
broll: industrial control room engineer

## points
kicker: 转折点 · 擎源提前6小时预警
point: 擎源大模型提前6小时预测到一台给水泵即将发生故障，建议立即切换备用泵
caption: 擎源大模型提前6小时预测到一台给水泵即将发生故障，建议立即切换备用泵。
broll: AI predictive maintenance warning

## points
kicker: 转折点 · 半信半疑的执行
point: 运行人员半信半疑地执行了，结果3小时后，这台泵果然出现了严重振动
point: 如果当时没有切换，后果不堪设想
caption: 运行人员半信半疑地执行了，结果3小时后，这台泵果然出现了严重振动。
broll: AI predictive maintenance warning

## points
kicker: 转折点 · 从不敢用到离不开
point: 一线工人从不敢用变成了离不开
caption: 从此，一线工人从不敢用变成了离不开。
broll: industrial control room engineer

## data
kicker: 接入擎源后
value: -91.8%
label: 日均操作量
caption: 日均操作量从三千七百次降至两百四十九次，锐减91.8%。
broll: data comparison chart digital

## stats
kicker: 全面落地的多维成效
row: 成本 600MW机组生产成本下降0.3%
row: 盈利 机组盈利能力提升2%
row: 预测 新能源功率预测准确率提升2.8%
row: 检测 海上风电海缆检测由1个月缩至10天
caption: 擎源大模型的成效，用数据说话——
broll: offshore wind farm sea

## data
kicker: 集团整体经济效益
value: 数亿元
label: 年节约燃料成本
caption: 按国家能源集团整体测算，年节约燃料成本可达数亿元。
broll: energy saving money efficiency

## data
kicker: 集团整体经济效益
value: 2-3年
label: 投资回收期
caption: 投资回收期缩短至2-3年，经济效益显著。
broll: financial growth chart

## points
kicker: 给行业的启示
point: 第一，AI大模型必须从业务痛点出发，而非技术驱动
point: 第二，能源智能化要先做数据底座，再做场景应用
caption: 擎源大模型的成功，给能源行业智能化转型带来两点启示——
broll: industry conference meeting

## out
slogan: 从事后维修到预测性维护，从人工判断到智能决策
tagline: 关注 · 解锁更多能源转型案例
caption: 从人工判断到智能决策——擎源大模型正在改变发电行业的底层逻辑
broll: smart city future energy