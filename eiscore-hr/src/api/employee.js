import request from '@/utils/request'

// PostgREST 的查询语法非常强大
// 比如: ?select=*,department&age=gt.25

export const getEmployeeList = (params) => {
  return request({
    url: '/employees', // 对应数据库里的 employees 表
    method: 'get',
    params: {
      order: 'id.desc', // 按 ID 倒序
      ...params
    }
  })
}

export const addEmployee = (data) => {
  return request({
    url: '/employees',
    method: 'post',
    data
  })
}

export const deleteEmployee = (id) => {
  return request({
    url: '/employees',
    method: 'delete',
    params: { id: `eq.${id}` } // PostgREST 语法: id = id
  })
}