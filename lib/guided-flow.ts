export function isGuidedIndustrialRequest(message: string | undefined) {
  const value = message?.trim() ?? "";
  return /减速机|流体接头|快换接头|卡套接头|P3[IE]|公司资料|我们做|外贸\s*B2B/.test(value);
}

export function needsGuidedBusinessQuestion(message: string | undefined) {
  const value = message?.trim() ?? "";
  if (/(?:【公司资料】|资料性质：)[\s\S]*目标：/.test(value)) return false;
  return isGuidedIndustrialRequest(value);
}
