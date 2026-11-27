export type DiversePackId = 'luthiery' | 'vetclinic' | 'metrology' | 'acoustic';
export type DiversePackFormat = 'oral-narrative' | 'scattered-notes' | 'legacy-web-copy' | 'brochure-copy';

export type DiversePack = {
  id: DiversePackId;
  formatKind: DiversePackFormat;
  companyName: string;
  industry: string;
  email: string;
  requestedPageCount: number;
  pageRequest: string;
  quickContent: { id: string; title: string };
  controlUrls: string[];
  body: string;
};

export const diversePacks: Record<DiversePackId, DiversePack> = {
  luthiery: {
    id: 'luthiery',
    formatKind: 'oral-narrative',
    companyName: '松风提琴修复工坊',
    industry: '乐器手工修缮 / 提琴修复与装配调音',
    email: 'workshop@songfeng-strings.luckye.online',
    requestedPageCount: 2,
    pageRequest: '首页、修复与送修说明两个独立页面。',
    quickContent: { id: 'repair', title: '修复与送修' },
    controlUrls: ['https://www.beares.com/', 'https://www.florianleonhard.com/'],
    body: [
      '资料性质：模拟。不可当作真实企业。',
      '公司名：松风提琴修复工坊',
      '我们这间小工坊平时就两个人守着工作台，专门接小提琴、中提琴和大提琴的裂纹修补、装配调整与琴弓换毛，不做考级通货厂琴买卖，也不接电声乐器电路维修。琴拿过来我们一般先在自然光和内窥镜下看面板、背板、低音梁和音柱位置，能当场说明白工时和做法的就记在接琴单上：像单换小提琴琴码连修削贴合是 380–680 元/把（按琴码木料等级与面板弧度现场核定），乌木指板找平重磨 520 元/把（不含换弦材料费，换弦按琴主自备或选定品牌实算），蒙古白马尾换弓毛小提琴与中提琴弓 320 元/支、大提琴弓 380 元/支，一般在收弓后 3–5 个工作日取回；要是碰到面板低音梁脱胶或贯通裂纹需要开膛清胶和补钉，周期通常要排 2–4 周，具体收费得看开板后的实际伤情确认，没看到实物前没办法在邮件里报死一口价。',
      '工坊对外用“松风提琴修复”六个字，习惯深木褐配暖黄铜小字，没有复杂图形标志。平时周一到周三我们闭门做木工和油漆修补不接待来客，周四至周日 13:00–19:00 开放到坊试音、验琴和取送修；外地琴主如果要寄修，请先把琴身正反侧面和伤处微距照片发到 workshop@songfeng-strings.luckye.online，我们确认属于可修范围后再寄，装箱务必把琴码两侧垫软、放进硬壳琴盒外加纸箱缓冲，往返快递与保价费用由琴主承担。工坊在上海市徐汇区，具体门牌室号、联系电话、过往修复前后对比照片授权、制琴师个人履历以及客户评价目前均待补充。',
    ].join('\n'),
  },
  vetclinic: {
    id: 'vetclinic',
    formatKind: 'scattered-notes',
    companyName: '白桦林宠物内科诊所',
    industry: '伴侣动物医疗 / 社区犬猫内科与牙科诊所',
    email: 'clinic@birch-vet.luckye.online',
    requestedPageCount: 2,
    pageRequest: '首页、诊疗与收费须知两个独立页面。',
    quickContent: { id: 'care', title: '诊疗与收费' },
    controlUrls: ['https://bondvet.com/', 'https://www.banfield.com/'],
    body: [
      '资料性质：模拟。不可当作真实机构。',
      '机构名：白桦林宠物内科诊所',
      '- 只看犬猫日常内科（消化道、泌尿道、老年慢性病随访）、皮肤耳道镜检与牙科洁治；不接骨科内固定手术、异宠（鸟类/爬宠/兔啮齿类）及传染病住院隔离。',
      '- 门诊时间：周二至周日 09:30–18:30（注意周三 13:00–16:30 固定留给预约麻醉洁牙与软组织处置，这个半天暂停现场普通初诊挂号）；周一全天闭店消杀休息。',
      '- 犬猫分开候诊角，猫诊室配费洛蒙扩散器但桌位有限（猫候诊格 3 个、犬候诊位 4 个），带猫出门建议装硬质航空箱或盖透气布。',
      '- 挂号与基础体格检查 60 元/次（含体重、体温、听诊与口腔耳道初筛，不含化验耗材与药品）。',
      '- 皮肤刮片或耳道分泌物显微镜检 80 元/项；血常规五分类 + 基础生化十项复查套组 320 元/次（仅限本院慢病复诊犬猫，初诊按实际筛查单项计）。',
      '- 犬猫超声波洁牙及抛光 680–1180 元/次，按体重区间与牙结石分级核定；硬性前提是须先完成术前血常规与肝肾生化评估并符合异氟烷呼吸麻醉指征，术前化验、牙科 X 光片及松动牙拔除费用另计。',
      '- 牌匾用“白桦林宠物内科”清朗绿白配色，单片桦树叶简笔画作诊室门牌识别。',
      '- 诊所位于成都市武侯区，具体街道门牌号、周边停车指引、联系电话待补充。',
      '- 动物诊疗许可证编号、辐射安全许可证编号、狂犬病免疫点资质状态、执业兽医师姓名与资格证号、24 小时夜间急诊转诊合作医院名单及宠主评价待补充。',
      '- 病历资料与转诊单接收邮箱：clinic@birch-vet.luckye.online',
    ].join('\n'),
  },
  metrology: {
    id: 'metrology',
    formatKind: 'legacy-web-copy',
    companyName: '衡准计量校准实验室',
    industry: '检验检测 / 第三方温湿度与压力计量校准',
    email: 'service@hengzhun-cal.luckye.online',
    requestedPageCount: 3,
    pageRequest: '首页、校准项目、送检须知三个独立页面。',
    quickContent: { id: 'calibration', title: '校准项目' },
    controlUrls: ['https://www.trescal.com/', 'https://www.transcat.com/'],
    body: [
      '资料性质：模拟。不可当作真实企业。',
      '公司名称：衡准计量校准实验室',
      '当前位置：首页 > 关于衡准 > 业务与送检说明（旧版网页文字整理稿）',
      '衡准计量校准实验室面向医药仓储、食品车间和精密制造企业开展热工与力学常规器具的实验室送检及现场校准服务。本机构为独立第三方校准实验室，不销售仪器仪表，不承接故障仪器拆修与零件更换，亦不出具强制检定法定合格印证。对外文件抬头使用“衡准计量”深蓝标准字与等距刻度线标记。',
      '实验室常设校准能力摘录（超出下述量程或准确度等级的器具请先发铭牌核实）：',
      '数字温湿度计及温湿度记录仪 | 温度范围 (−20～80) ℃，相对湿度范围 (20～90) %RH | 常温常湿段在恒温恒湿标准箱内比对校准。',
      '环境试验设备（恒温恒湿箱、干燥箱、培养箱） | 温度范围 (−40～150) ℃ | 按客户指定布点容积上门布放多路铂电阻与湿度传感器现场测试，仅限于具备稳定供电且箱内无易燃挥发残留物的空载或约定负载工况。',
      '一般压力表、精密压力表及数字压力计 | 量程 (−0.1～60) MPa（气体/液压介质分台操作，禁油压力表须在送检单显著注明并走纯水或无油气源通道）。',
      '送检接收窗口工作时间为周一至周五 08:30–17:00（法定节假日停收）。实验室常规送检器具自样品及委托单信息核对无误次日起 5 个工作日内出具中英文或中文校准证书；上门现场校准须提前至少 5 个工作日排期，往返交通及标准器运输费按合同里程实算。单项校准收费标准、加急安排、CNAS 认可证书及附表编号、实验室详细收样地址、联系电话与客户名单评价均待补充。委托咨询与铭牌核对邮箱：service@hengzhun-cal.luckye.online。',
    ].join('\n'),
  },
  acoustic: {
    id: 'acoustic',
    formatKind: 'brochure-copy',
    companyName: '静界声学构造社',
    industry: '专业建筑工程 / 小型排练房与录音间声学改造',
    email: 'hello@jingjie-acoustics.luckye.online',
    requestedPageCount: 2,
    pageRequest: '首页、改造方案与合作流程两个独立页面。',
    quickContent: { id: 'solutions', title: '改造方案' },
    controlUrls: ['https://www.rpgacoustic.com/', 'https://www.gikacoustics.com/'],
    body: [
      '资料性质：模拟。不可当作真实企业。',
      '企业名：静界声学构造社',
      '【一面｜把排练声留在房内，让听感回到准确】',
      '静界声学构造社专注于 12–80 平方米中小型音乐排练室、打击乐琴房、播客配音间及审听室的隔声减振与室内混响控制改造。视觉识别采用炭黑底配暖砂色折线波形标记。我们只按现场实测本底噪声、楼板荷载与墙体结构出具构造详图并组织声学基层施工，不售卖成品家用海绵贴片，不包办商业物业消防报审、建筑主体拆改审批及空调新风主机设备采购。',
      '【二面｜两类常见空间构造做法】',
      '打击乐与乐队排练房（房中房浮筑构造）：采用减振垫浮筑混凝土或复合干式浮筑地面，配合脱开原墙的双层石膏板阻尼隔声轻钢龙骨墙及双道磁吸密封隔声门；要求原始层高 ≥2.85 m 且楼板允许静荷载由物业结构图纸先行确认，层高或荷载不足时改作非混凝土轻质减振方案，降噪量随原建筑墙体条件单案测算，不作统一分贝包干承诺。',
      '配音间与小型混音审听室（混响与驻波调校）：在完成门窗隔声密封基础上，按房间长宽高比例布置低频陷阱、穿孔吸声构造与局部木质扩散面，目标混响时间按房间容积与用途在方案阶段约定；施工周期通常为进场后 15–28 天（不含物业审批与定制隔声门排产期）。',
      '【三面｜现场勘测与合作说明】',
      '苏浙沪地区可预约上门声学初勘与本底噪声测量，单次勘测费 800 元（若 60 日内签订正式改造施工合同，勘测费全额抵扣首期工程款；外省市差旅标准待补充）。声学材料燃烧性能检测报告随进场批次提供，公司施工资质编号、过往竣工实景图片公开授权、具体平方造价区间、办公地址、联系电话及客户评价待补充。图纸与房间尺寸初评请发邮件至 hello@jingjie-acoustics.luckye.online。',
    ].join('\n'),
  },
};

export const diversePackList: DiversePack[] = [
  diversePacks.luthiery,
  diversePacks.vetclinic,
  diversePacks.metrology,
  diversePacks.acoustic,
];
