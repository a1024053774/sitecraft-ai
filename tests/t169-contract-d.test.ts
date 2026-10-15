import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(`${path.join(process.cwd(), specifier.slice(2))}.ts`).href, context);
} });

const { handleCodeChat } = await import('../lib/code-site-workflow.ts');
const { createCodeSite, getCodeSite } = await import('../lib/code-site-store.ts');
const { getOrCreateConversation } = await import('../lib/conversation-store.ts');
const { codeFactSourceMaterials } = await import('../lib/code-site.ts');

test('合同 D：生产入口保存上传原文和消息来源，不按标签猜出处', async () => {
  const siteId = `t169-contract-d-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(siteId, `conversation-${siteId}`);
  await createCodeSite(siteId, '合同 D', conversation.conversationId);
  const upload = { type: 'upload' as const, sourceId: 'upload-contract-d-1', name: 'company.txt', text: '客户：已服务 30 家客户。' };
  const response = await handleCodeChat(siteId, { message: upload.text, source: upload, baseRevision: 0 });
  assert.equal(response.status, 200);
  const site = await getCodeSite(siteId);
  assert.deepEqual((site as any)?.factSources, [upload]);
  assert.doesNotMatch(String((site as any)?.factSources?.[0]?.text), /页面要求|风格说明/);
});

test('合同 D：消息出处保留发送时序号，要求里的事实也属于用户原文', () => {
  const site: any = {
    materials: '完整上下文：页面要求：把“长期合作客户：甲方公司。”放进首页。',
    factSources: [
      { type: 'upload', sourceId: 'upload-1', name: '资料.txt', text: '企业资料：普通纸盒。' },
      { type: 'message', messageIndex: 2, text: '页面要求：把“长期合作客户：甲方公司。”放进首页。' },
    ],
    versions: [], currentVersionId: null,
  };
  assert.deepEqual(codeFactSourceMaterials(site), site.factSources);
});

test('合同 D：系统提示、风格说明和模型输出不在可引用原文集合中', () => {
  const site: any = {
    materials: '完整上下文：页面要求：使用精密风格。模型输出：长期合作客户：甲方公司。',
    factSources: [{ type: 'message', messageIndex: 1, text: '企业资料：普通纸盒。' }],
    versions: [], currentVersionId: null,
  };
  const sources = codeFactSourceMaterials(site);
  assert.deepEqual(sources, site.factSources);
  assert.doesNotMatch(JSON.stringify(sources), /页面要求|精密风格|模型输出|长期合作客户/);
});
