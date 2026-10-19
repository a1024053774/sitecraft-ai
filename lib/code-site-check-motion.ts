// Runs only in isolated check documents. Cancel effects, not author declarations:
// transition/animation computed properties remain part of the outside comparison.
export function stopCodeCheckMotion() {
  try {
    // getAnimations flushes pending style changes, including forced pseudo states,
    // and includes CSS pseudo-element effects. Cancellation exposes underlying CSS.
    for (const animation of document.getAnimations()) animation.cancel();
    // A cancellation can itself change the cascade and start another effect.
    // Refuse that ambiguity instead of retrying or sampling an intermediate frame.
    if (document.getAnimations().length) throw new Error('动画效果仍在运行');
  } catch {
    throw new Error('检查文档无法确定停用作者过渡或动画，本次未保存版本。');
  }
}
