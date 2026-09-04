# 一期分镜稿 = 一个文件。复制本文件改内容即可出新片。
# 语法极简：`## 卡型` 开头定卡片，下面 `字段: 值` 填内容。
# broll: 关键词 用于自动从 Pexels 下载视频背景（避免纯信息卡单调）
# caption = 原文解说词（TTS 读什么，字幕就显示什么），≤40字（约2行）
# point = 从该段解说词中提炼的核心信息和数字（视觉卡片）
# 支持卡型见底部注释。跑: bash scripts/case-publish.sh energy-ep001-zhiqu-grid
# 来源文稿: raw/sucai/EP001-自驱电网-视频文稿.md （忠实还原，解说词逐句对应）

## meta
title: 自驱电网来了：电网调度从"人工判断"到"AI自主决策"
theme: energy
voice: Brian

## head
subtitle: 能源行业智能转型案例说 · EP001
caption: 自驱电网来了。电网调度，正从人工判断，跨进 AI 自主决策的时代。
broll: power grid control room operators

## points
kicker: 转型背景 · 靠经验的年代
point: 过去几十年，调度员靠经验和一通通电话守住电网
caption: 过去几十年，调度员靠经验和一通通电话，守住了电网。
broll: engineer operator control room

## points
kicker: 转型背景 · 变量暴涨
point: 风电光伏、储能、充电桩、可中断负荷同时涌入
point: 变量从几千个涨到几百万个，人脑再也算不过来
caption: 如今风电光伏大规模并网，变量从几千个，涨到了几百万个。
broll: wind turbine farm aerial

## points
kicker: 新能源出力靠天
point: 负荷曲线越来越陡，极端天气只剩几分钟判断
caption: 新能源出力靠天，极端天气一来，留给人的判断时间只有几分钟。
broll: solar panel storm clouds

## data
kicker: 国家能源局首批场景
value: 51个
label: "人工智能+电网"高价值场景
caption: 这正是国家能源局把人工智能加电网，列入首批五十一个高价值场景的原因——不是锦上添花，是不得不转。
broll: government technology energy policy

## points
kicker: 国网的两层答案
point: 一层是"脑子"——光明电力大模型
point: 一层是"规矩"——L2级自驱电网
caption: 国家电网的答案分两层：一层是脑子，一层是规矩。
broll: ai technology data abstract

## data
kicker: 光明电力大模型
value: 千亿级
label: 国内首个电力行业多模态大模型
caption: 脑子，是光明电力大模型——国内首个电力行业的千亿级多模态大模型。
broll: neural network ai visualization

## points
kicker: 三大关键技术突破
point: 电力大模型结构优化
point: 行业知识增强训练
point: 电力思维链推理
caption: 它突破了结构优化、知识增强训练和思维链推理，三项关键技术。
broll: data network ai technology

## points
kicker: 能力一 · 电力气象预报
point: 地表辐照度、百米风速的高精度预测
caption: 它能做电力气象预报，给出地表辐照度、百米风速的高精度预测。
broll: weather radar meteorology technology

## data
kicker: 电力时序预测
value: 98% / 92%
label: 省级负荷预测 / 分布式光伏预测
caption: 电力时序预测，让省级负荷预测精度达到98%，分布式光伏达到92%以上。
broll: data dashboard analytics charts

## data
kicker: 电网分析计算
value: <20ms
label: 万级节点计算 · 潮流收敛>95%
caption: 电网分析计算，万级节点算完小于二十毫秒，潮流收敛成功率超95%。
broll: power grid computer processing

## points
kicker: 一句话看懂光明
point: 看得懂天 / 算得准负荷
point: 能瞬间推演整张电网
caption: 它既看得懂天，也算得准负荷，还能瞬间推演整张电网。
broll: futuristic digital energy grid

## data
kicker: L2级自驱电网
value: 全球首个
label: 国网湖南电力自主研发
caption: 规矩，是全球首个L2级自驱电网，由国网湖南电力自主研发。
broll: automated robotic technology futuristic

## points
kicker: 自驱电网 · 三层架构
point: 感知层——实时扫描全网状态
point: 认知层——把调度规则翻译成AI能懂的知识
point: 决策层——寻优 + 双引擎安全否决
caption: 它分三层：感知层扫描全网，认知层翻译知识，决策层寻优并否决越线方案。
broll: layered system architecture technology

## points
kicker: 把整张电网装进大脑
point: 天 / 负荷 / 整张电网
point: 装进了同一个大脑
caption: 简单说，它把天、负荷和整张电网，装进了同一个大脑。
broll: glowing brain network energy

## head
subtitle: 最难的一步：敢不敢把方向盘交出去
caption: 真正难的从来不是技术，是敢不敢把方向盘交出去。
broll: power substation high voltage

## points
kicker: 调度是电网的"心脏"
point: AI一旦给出错误方案，代价是整片区域停电
caption: 调度是电网的心脏，AI 一旦错一次，代价是整片区域停电。
broll: control room serious operator

## data
kicker: 关键决策 · 先划红线
value: 先学规矩，再学优化
label: 不追求替代人，先给AI划红线
caption: 国家电网的关键决策，是不追求让AI替代人，而是先给AI划红线。
broll: boundary safety lines technology

## points
kicker: 概率+断言双引擎
point: 开放求解空间里大胆寻优
point: 触碰安全红线，一律一票否决
caption: 这个概率加断言双引擎，让AI大胆寻优，又在安全边界前寸步不让。
broll: artificial intelligence security lock

## points
kicker: 落地方法论
point: 先把拓扑、参数、规程写进知识图谱
point: 先学规矩，再学优化，最后谈自主
caption: 团队先把拓扑参数写进知识图谱，先学规矩，再学优化，最后才谈自主。
broll: knowledge graph network data

## points
kicker: 长沙 · 配网调度智能体"光明"
point: 每条建议讲清依据、风险、影响范围、备选方案
point: 让调度员看得懂、敢签字
caption: 长沙的配网智能体光明，每条建议都讲清依据与风险，让调度员看得懂、敢签字。
broll: city power grid ai assistant

## points
kicker: 不是黑箱，是会解释的搭档
point: 每一条建议都透明、可解释
caption: 它不是黑箱，而是一位会解释的搭档。
broll: human robot collaboration interface

## data
kicker: 成效 · 日前校核
value: 数天 → 2小时内
label: 省地县三级多智能体协同 · 人工工作量降75%
caption: 省地县三级多智能体协同，把原本数天的日前校核，压缩到两小时以内。
broll: data processing speed fast

## data
kicker: 供电方案编制
value: 35秒
label: 准确率超过99.85%
caption: 供电方案编制时长压缩到35秒，准确率超过99.85%。
broll: digital documents fast typing

## data
kicker: 安全 · 调度辅助决策
value: 95%
label: 告警准确率 · 决策从15分钟压到分钟级
caption: 调度辅助决策已在国调中心试点，告警准确率95%，决策压到分钟级。
broll: warning alert system security

## stats
kicker: 覆盖规模
row: 27家 省级电力公司
row: 600余个 业务场景赋能
row: 90%+ 推荐方案采纳率
caption: 光明大模型已覆盖总部及27家省公司，赋能600余个场景，采纳率超90%。
broll: wide network coverage map grid

## data
kicker: 绿色托底
value: 14亿kW+
label: 新能源装机 · 跨区输电3.7亿kW
caption: 更准的预测意味着更少弃风弃光，它托底的是超14亿千瓦新能源装机。
broll: solar wind farm green energy

## points
kicker: 启示一 · 可解释性比能力更重要
point: AI进核心环节的前提，不是模型多聪明
point: 而是敢不敢先划红线、把安全写成硬规则
caption: AI进核心环节的前提，不是模型多聪明，而是敢不敢先划红线、把安全写成硬规则。
broll: chess rules strategy decision

## points
kicker: 启示二 · 范式跃迁
point: 把老师傅经验、调度规程、物理规律
point: 翻译成机器可计算的知识，再在更大空间寻优
caption: 范式跃迁不是上一个系统，而是把经验与规律，翻译成机器可计算的知识。
broll: knowledge transfer transformation light

## head
subtitle: 从"盆景"到"风景"
caption: 当电网开始自己巡航、自己出方案、自己守住底线，能源智能化才算真正长成了连片的风景。
broll: power lines landscape golden hour

## out
slogan: 从"人盯屏幕"到"电网自驱"
tagline: 关注 · 解锁更多能源数智化转型案例
caption: 变的不是岗位，是决策的方式。
broll: smart city future energy grid
