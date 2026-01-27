export const documentSchemaExample = {
  docType: "employee_profile",
  title: "员工详细档案表",
  docNo: "employee_no", // 自动绑定 root.employee_no
  layout: [
    // --- 第一层：Header (基本信息) ---
    {
      type: "section",
      title: "基本信息",
      cols: 2, // 2列布局
      children: [
        { label: "姓名", field: "name", widget: "input" },
        { label: "所属部门", field: "department", widget: "text" }, // 纯文本展示
        { label: "入职日期", field: "join_date", widget: "date" },
        { label: "当前状态", field: "status", widget: "text" }
      ]
    },
    {
      type: "section",
      cols: 1, // 1列布局（通栏）
      children: [
        { label: "身份证号", field: "id_card", widget: "input" },
        { label: "家庭住址", field: "address", widget: "input" }
      ]
    },

    // --- 第二层：Body (明细表) ---
    // 这里假设数据中有一个 properties.work_history 数组
    {
      type: "table",
      title: "工作履历",
      field: "work_history", // 自动去 properties.work_history 找数据
      columns: [
        { label: "公司名称", field: "company", width: 180 },
        { label: "职位", field: "position", width: 120 },
        { label: "开始时间", field: "start_date", width: 120 },
        { label: "结束时间", field: "end_date", width: 120 }
      ]
    },

    // --- 第三层：Footer (签字区) ---
    {
      type: "section",
      cols: 2,
      children: [
        { label: "制表人", field: "created_by", widget: "text" },
        { label: "审核日期", field: "audit_time", widget: "date" }
      ]
    }
  ]
}