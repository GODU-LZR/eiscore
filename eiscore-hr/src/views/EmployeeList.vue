<template>
  <div class="app-container" style="padding: 20px;">
    <el-card shadow="never">
      <template #header>
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold;">👤 员工花名册</span>
          <el-button type="primary" icon="Plus" @click="handleAdd">新增员工</el-button>
        </div>
      </template>

      <div style="margin-bottom: 20px;">
        <el-input v-model="searchKeyword" placeholder="搜索姓名..." style="width: 200px; margin-right: 10px;" />
        <el-button type="primary" plain icon="Search" @click="fetchData">查询</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column prop="name" label="姓名" width="120">
          <template #default="{ row }">
            <el-tag effect="plain">{{ row.name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="position" label="职位" />
        <el-table-column prop="department" label="部门" />
        <el-table-column prop="created_at" label="入职时间" width="180" />
        <el-table-column label="操作" width="150" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新增员工" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="职位">
          <el-input v-model="form.position" />
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="form.department" placeholder="请选择">
            <el-option label="研发部" value="研发部" />
            <el-option label="生产部" value="生产部" />
            <el-option label="销售部" value="销售部" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getEmployeeList, addEmployee, deleteEmployee } from '@/api/employee'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const tableData = ref([])
const searchKeyword = ref('')

const dialogVisible = ref(false)
const submitting = ref(false)
const form = ref({ name: '', position: '', department: '' })

// 1. 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    // 如果有搜索词，使用 PostgREST 的模糊查询语法 like
    const params = searchKeyword.value ? { name: `like.*${searchKeyword.value}*` } : {}
    const res = await getEmployeeList(params)
    tableData.value = res
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 2. 新增逻辑
const handleAdd = () => {
  form.value = { name: '', position: '', department: '' }
  dialogVisible.value = true
}

const submitForm = async () => {
  submitting.value = true
  try {
    await addEmployee(form.value)
    ElMessage.success('添加成功')
    dialogVisible.value = false
    fetchData() // 刷新列表
  } catch (error) {
    console.error(error)
  } finally {
    submitting.value = false
  }
}

// 3. 删除逻辑
const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除员工 ${row.name} 吗?`, '警告', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await deleteEmployee(row.id)
    ElMessage.success('删除成功')
    fetchData()
  })
}

onMounted(() => {
  fetchData()
})
</script>