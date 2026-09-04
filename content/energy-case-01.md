# 一期分镜稿 = 一个文件。复制本文件改内容即可出新片。
# 语法极简：`## 卡型` 开头定卡片，下面 `字段: 值` 填内容。
# 支持卡型见底部注释。跑: bash scripts/case-publish.sh energy-case-01
# (不写扩展名，脚本会自动拼 .md)

## meta
title: 一场输电网的数智跃迁
theme: energy
voice: Brian

## head
subtitle: 能源企业数智化转型 · 案例速览
caption: 一条输电线路出了故障，过去要多久才能发现？

## points
kicker: 传统巡检的困局
point: 设备多靠人工巡检，一次全站要数小时
point: 数据分散在各系统，形不成统一视图
point: 故障往往等用户报修才被发现
caption: 设备多靠人工，数据各自为政，故障总要等报修

## data
kicker: 接入统一平台后
value: -70%
label: 巡检人力投入
caption: 把两千座站点接进一个平台后，人力先省七成

## stats
kicker: 平台上线一年
row: 2000座 接入变电站
row: 3秒 故障自动识别
row: 24小时 全天候感知
caption: 两千座站，三秒识障，全年无休在线感知

## points
kicker: 怎么做到的
point: 传感器+边缘网关，数据实时上云
point: AI 模型自动研判告警，代替人盯屏
point: 一张大屏统管全网，告警直达运维
caption: 靠的是传感上云、AI研判、一屏统管

## data
kicker: 运维效率
value: 5倍
label: 故障处置提速
caption: 过去小时级的事故响应，现在压缩到分钟级

## out
slogan: 数智能源，让每一次告警都有回响
tagline: 关注 · 解锁更多转型案例
caption: 数字化转型，不是把纸换屏，是让系统替人思考

# ==== 卡型参考（复制需要的一种，删掉不用的）====
# ## head      片头卡        title / subtitle / caption
# ## points    要点卡        kicker / point(可多行) / caption
# ## data      大数字卡      kicker / value / label / caption
# ## stats     多组数字卡    kicker / row(可多行: "数字 说明") / caption
# ## out       片尾卡        slogan / tagline / caption
# 说明：
#   kicker  = 卡片左上小标签（一句话定位这屏在讲啥）
#   point   = 一条要点，多行写多个 point
#   row     = 一条数据，"数字 说明"用空格分隔，多行写多个
#   caption = 这一屏的口播旁白（会生成配音+卡拉OK字幕），可省略=静音卡
#   theme   = energy | warm (energy 科技蓝 / warm 暖色, 默认 energy)
#   voice   = ElevenLabs 声音名 (Brian/Adam/...), 默认 .env 的 ELEVENLABS_VOICE_ID
