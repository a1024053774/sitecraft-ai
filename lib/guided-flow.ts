export function isGuidedIndustrialRequest(message: string | undefined) {
  const value = message?.trim() ?? "";
  const materials = /(?:【公司资料】|资料性质：)/.test(value);
  const editLike = /(?:把|将|改|修改|替换|调整|改成|文案|标题|副标题|按钮|主行动|CTA)/.test(value);
  if (editLike && !materials) return false;
  return /减速机|流体接头|快换接头|卡套接头|P3[IE]|公司资料|我们做|外贸\s*B2B/.test(value);
}

export function needsGuidedBusinessQuestion(message: string | undefined) {
  const value = message?.trim() ?? "";
  if (/(?:【公司资料】|资料性质：)[\s\S]*目标：/.test(value)) return false;
  return isGuidedIndustrialRequest(value);
}
