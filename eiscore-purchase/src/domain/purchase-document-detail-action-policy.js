// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const DEFAULT_BUSINESS_PERMISSION_KEYS = Object.freeze({
  reviewSupplier: 'op:purchase_supplier.review',
  pauseSupplier: 'op:purchase_supplier.pause',
  resumeSupplier: 'op:purchase_supplier.resume',
  createOrder: 'op:purchase_demand.create_order',
  submitDemand: 'op:purchase_demand.submit',
  closeDemand: 'op:purchase_demand.close',
  reopenDemand: 'op:purchase_demand.reopen',
  registerArrival: 'op:purchase_order.register_arrival',
  confirmOrder: 'op:purchase_order.confirm',
  cancelOrder: 'op:purchase_order.cancel',
  confirmInbound: 'op:purchase_arrival.confirm_inbound',
  markException: 'op:purchase_arrival.mark_exception'
})

export const buildPurchaseDocumentPermissionKeys = ({ ops = {}, businessOps = {} } = {}) => ({
  edit: ops?.edit,
  reviewSupplier: businessOps?.reviewSupplier || DEFAULT_BUSINESS_PERMISSION_KEYS.reviewSupplier,
  pauseSupplier: businessOps?.pauseSupplier || DEFAULT_BUSINESS_PERMISSION_KEYS.pauseSupplier,
  resumeSupplier: businessOps?.resumeSupplier || DEFAULT_BUSINESS_PERMISSION_KEYS.resumeSupplier,
  createOrder: businessOps?.createOrder || DEFAULT_BUSINESS_PERMISSION_KEYS.createOrder,
  submitDemand: businessOps?.submitDemand || DEFAULT_BUSINESS_PERMISSION_KEYS.submitDemand,
  closeDemand: businessOps?.closeDemand || DEFAULT_BUSINESS_PERMISSION_KEYS.closeDemand,
  reopenDemand: businessOps?.reopenDemand || DEFAULT_BUSINESS_PERMISSION_KEYS.reopenDemand,
  registerArrival: businessOps?.registerArrival || DEFAULT_BUSINESS_PERMISSION_KEYS.registerArrival,
  confirmOrder: businessOps?.confirmOrder || DEFAULT_BUSINESS_PERMISSION_KEYS.confirmOrder,
  cancelOrder: businessOps?.cancelOrder || DEFAULT_BUSINESS_PERMISSION_KEYS.cancelOrder,
  confirmInbound: businessOps?.confirmInbound || DEFAULT_BUSINESS_PERMISSION_KEYS.confirmInbound,
  markException: businessOps?.markException || DEFAULT_BUSINESS_PERMISSION_KEYS.markException
})

export const buildPurchaseDocumentActionAvailability = ({ appKey, row = {}, permissions = {} } = {}) => {
  const currentRow = row || {}
  const hasRecord = Boolean(currentRow.id)
  const inactive = ['disabled', 'locked'].includes(currentRow.status)
  const demandClosed = [currentRow.demand_status, currentRow.status]
    .some(status => ['已下单', '已关闭', 'locked', 'disabled'].includes(status))
  const orderArrivalClosed = [currentRow.order_status, currentRow.status, currentRow.arrival_progress]
    .some(status => ['已完成', '已取消', 'locked', 'disabled', '已到齐'].includes(status))

  return {
    reviewSupplier: appKey === 'suppliers'
      && hasRecord
      && currentRow.supplier_status === '待评审'
      && !inactive
      && Boolean(permissions.reviewSupplier),
    pauseSupplier: appKey === 'suppliers'
      && hasRecord
      && currentRow.supplier_status !== '暂停合作'
      && !inactive
      && Boolean(permissions.pauseSupplier),
    resumeSupplier: appKey === 'suppliers'
      && hasRecord
      && (currentRow.supplier_status === '暂停合作' || currentRow.status === 'disabled')
      && Boolean(permissions.resumeSupplier),
    submitDemand: appKey === 'demands'
      && hasRecord
      && (currentRow.demand_status === '草稿' || currentRow.status === 'draft')
      && !['locked', 'disabled'].includes(currentRow.status)
      && Boolean(permissions.submitDemand),
    createOrder: appKey === 'demands'
      && hasRecord
      && !demandClosed
      && Boolean(permissions.createOrder),
    closeDemand: appKey === 'demands'
      && hasRecord
      && !['已下单', '已关闭'].includes(currentRow.demand_status)
      && !['locked', 'disabled'].includes(currentRow.status)
      && Boolean(permissions.closeDemand),
    reopenDemand: appKey === 'demands'
      && hasRecord
      && (currentRow.demand_status === '已关闭' || currentRow.status === 'disabled')
      && Boolean(permissions.reopenDemand),
    confirmOrder: appKey === 'orders'
      && hasRecord
      && (currentRow.order_status === '草稿' || currentRow.status === 'draft')
      && currentRow.order_status !== '已取消'
      && Boolean(permissions.confirmOrder),
    cancelOrder: appKey === 'orders'
      && hasRecord
      && (Number(currentRow.arrived_quantity) || 0) <= 0
      && !['已完成', '已取消'].includes(currentRow.order_status)
      && !['disabled', 'locked'].includes(currentRow.status)
      && Boolean(permissions.cancelOrder),
    registerArrival: appKey === 'orders'
      && hasRecord
      && ['已下单', '部分到货'].includes(currentRow.order_status)
      && !orderArrivalClosed
      && Boolean(permissions.registerArrival),
    linkArrival: appKey === 'arrivals'
      && hasRecord
      && !currentRow.order_id
      && !['已入库', '异常'].includes(currentRow.arrival_status)
      && currentRow.iqc_status !== '不合格'
      && Boolean(permissions.edit),
    confirmInbound: appKey === 'arrivals'
      && hasRecord
      && currentRow.arrival_status !== '已入库'
      && currentRow.arrival_status !== '异常'
      && currentRow.iqc_status !== '不合格'
      && Boolean(permissions.confirmInbound),
    markException: appKey === 'arrivals'
      && hasRecord
      && currentRow.arrival_status !== '已入库'
      && currentRow.arrival_status !== '异常'
      && Boolean(permissions.markException),
    related: ['demands', 'orders'].includes(appKey)
  }
}

const ACTION_DEFINITIONS = Object.freeze([
  { key: 'reviewSupplier', label: '完成评审', type: 'primary', plain: false },
  { key: 'pauseSupplier', label: '暂停合作', type: 'danger' },
  { key: 'resumeSupplier', label: '恢复合作', type: 'success' },
  { key: 'submitDemand', label: '提交采购', type: 'primary', plain: false },
  { key: 'createOrder', label: '生成采购订单', type: 'primary', plain: false },
  { key: 'closeDemand', label: '关闭需求', type: 'danger' },
  { key: 'reopenDemand', label: '重新打开', type: 'success' },
  { key: 'confirmOrder', label: '确认下单', type: 'primary', plain: false },
  { key: 'cancelOrder', label: '取消订单', type: 'danger' },
  { key: 'registerArrival', label: '登记到货', type: 'success', plain: false },
  { key: 'linkArrival', label: '关联采购订单', type: 'success' },
  { key: 'confirmInbound', label: '确认入库', type: 'warning' },
  { key: 'markException', label: '标记异常', type: 'danger' },
  { key: 'related', label: '查看到货跟踪', demandLabel: '查看采购订单', type: 'primary' }
])

const ACTION_SOPS = Object.freeze({
  reviewSupplier: {
    title: '供应商完成评审',
    desc: '把待评审供应商标记为已评审，进入可合作状态。',
    steps: ['确认供应商名称、联系人、资质和风险信息', '检查附件和评审意见是否完整', '点击完成评审', '回到供应商表格复核供应商状态'],
    risk: '评审后供应商可能进入采购使用范围，请确认资质、风险和审批记录都已留档。'
  },
  pauseSupplier: {
    title: '暂停供应商合作',
    desc: '暂停当前供应商，避免继续下单或错误使用。',
    steps: ['确认暂停原因和影响范围', '检查是否存在未完成订单或到货', '点击暂停合作', '通知采购相关人员并复核供应商状态'],
    risk: '暂停供应商可能影响未完成采购，请先确认订单、到货和替代供应商。'
  },
  resumeSupplier: {
    title: '恢复供应商合作',
    desc: '恢复暂停供应商，使其重新进入可用范围。',
    steps: ['确认供应商整改或资质恢复完成', '检查风险记录和附件', '点击恢复合作', '回到供应商表格复核状态'],
    risk: '恢复前必须确认暂停原因已经关闭，否则会把风险重新带入采购链路。'
  },
  submitDemand: {
    title: '提交采购需求',
    desc: '把草稿采购需求提交到采购处理状态。',
    steps: ['确认物料、数量、需求日期和申请人', '检查是否重复需求或库存已有满足', '点击提交采购', '回到采购需求表格复核状态'],
    risk: '提交后会进入采购执行范围，请避免重复需求和错误数量。'
  },
  createOrder: {
    title: '采购需求生成采购订单',
    desc: '从当前采购需求生成下游采购订单。',
    steps: ['确认需求未关闭且尚未下单', '复核供应商、物料、数量、价格和交期', '点击生成采购订单', '跳转或回到采购订单应用搜索新订单复核'],
    risk: '生成订单前要确认供应商和数量，否则会导致错误下单或重复下单。'
  },
  closeDemand: {
    title: '关闭采购需求',
    desc: '关闭不再执行的采购需求。',
    steps: ['确认需求确实不再采购', '检查是否已有采购订单或到货', '点击关闭需求', '回到采购需求表格复核关闭状态'],
    risk: '关闭需求会影响采购计划和生产供料，请确认业务方已同意。'
  },
  reopenDemand: {
    title: '重新打开采购需求',
    desc: '把已关闭采购需求恢复为可继续处理。',
    steps: ['确认重新采购的原因', '复核物料、数量和需求日期是否仍有效', '点击重新打开', '回到采购需求表格复核状态'],
    risk: '重新打开旧需求前要确认没有新需求替代，避免重复采购。'
  },
  confirmOrder: {
    title: '确认采购订单下单',
    desc: '确认草稿采购订单已正式下单。',
    steps: ['确认供应商、物料、数量、价格、税率和预计到货日期', '检查合同或报价附件', '点击确认下单', '回到采购订单表格复核订单状态'],
    risk: '确认下单后会影响到货跟踪和应付对账，请确保价格、数量和交期正确。'
  },
  cancelOrder: {
    title: '取消采购订单',
    desc: '取消尚未完成或尚未到货的采购订单。',
    steps: ['确认取消原因和供应商沟通结果', '检查是否已有到货或入库', '点击取消订单', '回到采购订单表格复核状态'],
    risk: '取消订单可能影响生产供料和库存计划，请确认没有下游到货或入库依赖。'
  },
  registerArrival: {
    title: '采购订单登记到货',
    desc: '从采购订单登记到货跟踪记录。',
    steps: ['确认订单处于可到货状态', '复核供应商、物料、订单数量和本次到货数量', '点击登记到货', '到到货跟踪应用搜索并复核记录'],
    risk: '登记到货前请确认实物、送货单和订单一致，避免影响质检和入库。'
  },
  linkArrival: {
    title: '到货记录关联采购订单',
    desc: '把未关联订单的到货记录关联到正确采购订单。',
    steps: ['确认到货记录的供应商、物料和数量', '查找正确采购订单', '点击关联采购订单', '复核到货记录的订单来源'],
    risk: '关联错误订单会影响订单到货进度、质检和入库追溯。'
  },
  confirmInbound: {
    title: '确认采购到货入库',
    desc: '确认合格到货记录进入入库处理。',
    steps: ['确认质检状态不是不合格', '复核到货数量、批次、仓库和库位', '点击确认入库', '跳转或回到仓储入库复核库存影响'],
    risk: '入库会影响库存，请确认质检、批次、仓库和数量都正确。'
  },
  markException: {
    title: '标记采购到货异常',
    desc: '把当前到货记录标记为异常，阻止错误入库。',
    steps: ['确认异常原因，如数量不符、质检不合格或资料缺失', '补充异常说明和附件', '点击标记异常', '回到到货跟踪表格复核异常状态'],
    risk: '异常标记会阻止正常入库，并可能触发质量或供应商处理流程。'
  },
  related: {
    title: '查看采购关联应用',
    desc: '跳转到当前单据的下游应用查看处理结果。',
    steps: ['确认当前单据已经生成或关联下游记录', '点击查看关联应用', '在下游应用用单号搜索', '复核状态、来源、数量和责任人'],
    risk: '跳转后请用单号复核，不能只凭页面跳转判断下游单据已经正确生成。'
  }
})

export const buildPurchaseDocumentBusinessActions = ({ appKey, availability = {}, handlers = {} } = {}) => (
  ACTION_DEFINITIONS
    .filter(action => Boolean(availability[action.key]))
    .map((action) => {
      const sop = ACTION_SOPS[action.key] || {}
      const label = action.key === 'related' && appKey === 'demands'
        ? action.demandLabel
        : action.label
      const result = {
        key: action.key,
        label,
        handler: handlers[action.key],
        type: action.type,
        sopAction: `purchase-detail-${action.key}`,
        sopTitle: sop.title || label,
        sopDesc: sop.desc || `按标准步骤执行“${label}”。`,
        sopSteps: Array.isArray(sop.steps) ? sop.steps.join('|') : (sop.steps || ''),
        sopRisk: sop.risk || '动作完成后请回到相关应用搜索单号，复核状态、来源、数量、责任人和下游链路。'
      }
      if (action.plain === false) result.plain = false
      return result
    })
)
