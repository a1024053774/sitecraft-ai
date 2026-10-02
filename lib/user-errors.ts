export type UserErrorInput = {
  code?: string | null;
  status?: number;
  message?: string | null;
  userMessage?: string | null;
  recovery?: string | null;
};

export type UserErrorDescription = {
  code: string;
  message: string;
  nextStep: string;
  recovery: string;
};

const catalog: Record<string, UserErrorDescription> = {
  revision_conflict: {
    code: "revision_conflict",
    message: "草稿已经更新，当前修改没有覆盖新版本。",
    nextStep: "右侧已载入最新草稿；检查后重新提交这次修改。输入内容和需求选择会保留。",
    recovery: "refresh_and_resubmit",
  },
  stale_question: {
    code: "stale_question",
    message: "这个问题已经更新，旧选项没有提交。",
    nextStep: "请使用当前显示的问题和选项；旧标签页的点击会被安全拒绝。",
    recovery: "reload_alignment_state",
  },
  conversation_not_found: {
    code: "conversation_not_found",
    message: "这次需求对齐会话已经不存在。",
    nextStep: "重新打开需求对齐并提交原 Prompt；不会自动创建另一份草稿。",
    recovery: "restart_alignment",
  },
  conversation_forbidden: {
    code: "conversation_forbidden",
    message: "这次会话不属于当前站点。",
    nextStep: "回到当前站点重新开始，避免把别的站点答案写入这里。",
    recovery: "restart_alignment",
  },
  alignment_pending: {
    code: "alignment_pending",
    message: "上一项需求仍在等待你的回答或确认。",
    nextStep: "先回答当前问题、确认方案或关闭需求对齐，再提交新的 Prompt。",
    recovery: "continue_alignment",
  },
  invalid_payload: {
    code: "invalid_payload",
    message: "提交内容不完整，尚未保存。",
    nextStep: "检查当前问题、选项和补充说明后再提交。",
    recovery: "review_input",
  },
  invalid_option: {
    code: "invalid_option",
    message: "这个选项已失效，尚未保存。",
    nextStep: "使用当前问题卡片里的选项，不要重复提交旧页面。",
    recovery: "reload_alignment_state",
  },
  not_configured: {
    code: "not_configured",
    message: "模型服务尚未配置，草稿没有伪造修改。",
    nextStep: "配置模型后重新提交；当前草稿和已上传素材不会被覆盖。",
    recovery: "configure_provider",
  },
  timeout: {
    code: "timeout",
    message: "模型处理超时，这次修改没有自动重试或覆盖新版本。",
    nextStep: "确认网络后重新提交；如果是需求对齐，先读取当前会话状态。",
    recovery: "retry_once_after_state_read",
  },
  provider_error: {
    code: "provider_error",
    message: "模型服务暂时不可用，草稿没有因此改写。",
    nextStep: "稍后重试；已保存的问题和答案仍可继续。",
    recovery: "retry_after_state_read",
  },
  truncated: {
    code: "truncated",
    message: "这次生成被截断，没有改动草稿。",
    nextStep: "可以直接重试；已保存的问题和答案仍可继续。",
    recovery: "retry_after_state_read",
  },
  invalid_output: {
    code: "invalid_output",
    message: "模型返回的方案无法安全校验，草稿没有修改。",
    nextStep: "重新提交或缩小需求范围；未经校验的内容不会写进页面。",
    recovery: "retry_with_narrower_prompt",
  },
  operation_error: {
    code: "operation_error",
    message: "方案没有成功保存，当前草稿保持原版本。",
    nextStep: "读取最新草稿后再试；不要重复确认旧方案。",
    recovery: "reload_draft_and_retry",
  },
  image_invalid: {
    code: "image_invalid",
    message: "图片不符合成品素材要求，尚未进入草稿。",
    nextStep: "使用 PNG/JPEG/WebP 的真实图片，并补齐站点归属、来源和许可信息。",
    recovery: "upload_valid_provenance",
  },
  lead_invalid: {
    code: "lead_invalid",
    message: "询盘内容不完整，尚未保存。",
    nextStep: "检查姓名、邮箱和需求说明后再提交。",
    recovery: "review_lead_form",
  },
  lead_not_found: {
    code: "lead_not_found",
    message: "当前站点不存在，询盘没有保存。",
    nextStep: "返回站点发布页后重新提交，不会创建新的空站点。",
    recovery: "return_to_site",
  },
  lead_full: {
    code: "lead_full",
    message: "这个站点的询盘收件箱已满，当前留言没有保存。",
    nextStep: "先处理已有询盘，之后再提交新的留言。",
    recovery: "review_inbox",
  },
  smtp_error: {
    code: "smtp_error",
    message: "询盘已经写入收件箱，但邮件转发暂未成功。",
    nextStep: "先在收件箱确认留言，再检查本地或外部邮件服务配置。",
    recovery: "read_inbox_and_check_smtp",
  },
  delete_unconfirmed: {
    code: "delete_unconfirmed",
    message: "删除没有执行。",
    nextStep: "输入当前站点编号后再确认；未确认的数据不会被删除。",
    recovery: "confirm_site_id",
  },
  site_not_found: {
    code: "site_not_found",
    message: "找不到这个站点。",
    nextStep: "返回站点列表，打开仍存在的站点。",
    recovery: "return_to_sites",
  },
  database_error: {
    code: "database_error",
    message: "数据存储暂时不可用，当前操作没有确认成功。",
    nextStep: "稍后读取草稿或收件箱确认状态，不要根据按钮结果猜测已保存。",
    recovery: "read_back_then_retry",
  },
  site_migration_error: {
    code: "site_migration_error",
    message: "旧站点资料无法安全迁移，当前草稿没有改动。",
    nextStep: "请联系管理员处理这份旧站点记录；系统没有丢弃或覆盖原始资料。",
    recovery: "contact_admin_for_migration",
  },
  network_error: {
    code: "network_error",
    message: "网络连接中断，当前操作结果需要回读确认。",
    nextStep: "刷新后先读取草稿和会话状态，再决定是否重新提交。",
    recovery: "refresh_and_read_back",
  },
};

export function describeUserError(input: UserErrorInput): UserErrorDescription {
  const code = input.code?.trim() || (input.status === 409 ? "revision_conflict" : "unknown_error");
  const known = catalog[code];
  if (known) return known;
  if (input.userMessage?.trim()) {
    return {
      code,
      message: input.userMessage.trim(),
      nextStep: "请读取当前页面状态后再决定下一步。",
      recovery: input.recovery?.trim() || "read_back_then_retry",
    };
  }
  return {
    code,
    message: "操作没有完成，当前草稿未确认发生变化。",
    nextStep: "刷新后读取最新草稿和会话状态；确认没有重复提交后再试。",
    recovery: input.recovery?.trim() || "refresh_and_read_back",
  };
}

export function userFacingError(input: UserErrorInput, fallback = "操作没有完成，当前草稿未确认发生变化。") {
  const description = describeUserError(input);
  if (input.userMessage?.trim()) return input.userMessage.trim();
  if (input.code?.trim() && catalog[input.code.trim()]) return `${description.message} ${description.nextStep}`;
  if (input.message && /[\u4e00-\u9fff]/.test(input.message) && !/[\\/]|Error:|at |token|secret|api[_-]?key/i.test(input.message)) {
    return input.message.trim();
  }
  return `${description.message} ${description.nextStep}` || fallback;
}

export function errorCatalog() {
  return Object.values(catalog).map((item) => ({ ...item }));
}

export function userErrorPayload(input: UserErrorInput, fallback = "操作没有完成，当前数据未确认发生变化。") {
  const description = describeUserError(input);
  const message = input.userMessage?.trim() || `${description.message} ${description.nextStep}` || fallback;
  return {
    error: message,
    code: description.code,
    userMessage: message,
    recovery: description.recovery,
  };
}
