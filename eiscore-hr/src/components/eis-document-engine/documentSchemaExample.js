export const documentSchemaExample = {
  title: '原料入库单',
  subtitle: '示例：AI 生成的单据模板',
  layout: [
    {
      type: 'row',
      children: [
        { span: 12, label: '供应商', field: 'supplier_name' },
        { span: 12, label: '入库日期', field: 'created_at' }
      ]
    },
    {
      type: 'row',
      children: [
        { span: 12, label: '单号', field: 'document_no' },
        { span: 12, label: '仓库', field: 'warehouse_name' }
      ]
    },
    {
      type: 'table',
      label: '入库明细',
      field: 'items',
      columns: [
        { label: '物料名称', field: 'material_name' },
        { label: '规格', field: 'spec' },
        { label: '数量', field: 'qty', width: 120 },
        { label: '单位', field: 'unit', width: 90 }
      ]
    },
    {
      type: 'row',
      children: [
        { span: 8, label: '经办人', field: 'operator' },
        { span: 8, label: '审核人', field: 'approved_by' },
        { span: 8, label: '合计', content: '{{ total_amount }}' }
      ]
    }
  ],
  footer: '备注：{{ remark }}'
}

export const documentDataExample = {
  supplier_name: '海风原料有限公司',
  created_at: '2024-05-02',
  document_no: 'RK-20240502-001',
  warehouse_name: '原料一号仓',
  operator: '王小明',
  approved_by: '李主管',
  total_amount: '￥12,560.00',
  remark: '请按批次入库',
  items: [
    { material_name: '原料 A', spec: '25kg/袋', qty: 120, unit: '袋' },
    { material_name: '原料 B', spec: '10kg/箱', qty: 60, unit: '箱' }
  ]
}
