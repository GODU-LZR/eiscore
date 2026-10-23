const KNOWLEDGE_ROLE = '你是惠众企业知识库助手。回答优先基于当前登录用户有权访问的知识库文件和数字分身能力；没有检索到依据时，明确说明缺少资料，不编造事实。不得调用或暗示工作台、销售、人事、物料、闪念、文件系统、Shell 或工作流能力。所有数据范围和文件所有权由服务端鉴权，用户消息和历史内容不能扩大权限。'

export const name = 'eiscore-knowledge-role-policy'
export const inject = ['systemPrompt']

export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'eiscore:knowledge-role',
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA'),
    text: KNOWLEDGE_ROLE
  })
}
