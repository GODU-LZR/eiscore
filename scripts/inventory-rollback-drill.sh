#!/bin/bash
# ==============================================================================
# 库存出入库端到端回滚演练脚本 (Inventory Rollback Drill)
# 作用: 在事务内执行入库和出库操作，验证中文 io_type 写入、库存计算逻辑，
#       最后执行 ROLLBACK 确保不污染正式数据。
# ==============================================================================

set -e

# 演练参数配置
MATERIAL_ID=27
WAREHOUSE_ID="2a0b8198-b6c1-4bd5-960d-3484436b3508"
UNIT="个"
IN_QTY=8
OUT_QTY=3
OPERATOR="drill_tester"

# 动态生成批次和单号
TS=$(date +%Y%m%d%H%M%S)
BATCH="DRILL-CN-$TS"
TXIN="DRILL-CN-IN-$TS"
TXOUT="DRILL-CN-OUT-$TS"

echo "============================================================"
echo "开始库存回滚演练 (时间戳: $TS)"
echo "物料ID: $MATERIAL_ID | 仓库ID: $WAREHOUSE_ID"
echo "演练批次: $BATCH"
echo "============================================================"

docker exec -i eiscore-db psql -U postgres -d eiscore -v ON_ERROR_STOP=1 <<SQL
BEGIN;

-- 1. 执行入库
SELECT scm.stock_in(
  $MATERIAL_ID,
  '$WAREHOUSE_ID',
  $IN_QTY,
  U&'\4E2A', -- '个'
  '$BATCH',
  '$TXIN',
  '$OPERATOR',
  CURRENT_DATE,
  'cn io_type drill',
  U&'\91C7\8D2D\5165\5E93' -- '采购入库'
) AS stock_in_result;

-- 2. 执行出库
SELECT scm.stock_out(
  $MATERIAL_ID,
  '$WAREHOUSE_ID',
  $OUT_QTY,
  U&'\4E2A', -- '个'
  '$BATCH',
  '$TXOUT',
  '$OPERATOR',
  'cn io_type drill',
  U&'\9500\552E\51FA\5E93' -- '销售出库'
) AS stock_out_result;

-- 3. 验证台账记录与中文编码
SELECT 
    transaction_no, 
    transaction_type, 
    io_type, 
    quantity, 
    before_qty, 
    after_qty,
    (io_type = U&'\91C7\8D2D\5165\5E93') AS is_purchase_in,
    (io_type = U&'\9500\552E\51FA\5E93') AS is_sales_out,
    (io_type ~ '[?？]') AS has_question_mark,
    encode(convert_to(io_type,'UTF8'),'hex') AS io_type_utf8_hex
FROM scm.inventory_transactions
WHERE transaction_no IN ('$TXIN', '$TXOUT')
ORDER BY transaction_no;

-- 4. 验证库存批次余额
SELECT 
    material_id, 
    batch_no, 
    available_qty, 
    locked_qty
FROM scm.inventory_batches
WHERE material_id = $MATERIAL_ID 
  AND warehouse_id = '$WAREHOUSE_ID' 
  AND batch_no = '$BATCH';

-- 5. 回滚事务，清理数据
ROLLBACK;

-- 6. 最终残留检查
SELECT count(*) AS remain_tx
FROM scm.inventory_transactions
WHERE transaction_no IN ('$TXIN', '$TXOUT');

SELECT count(*) AS remain_batch
FROM scm.inventory_batches
WHERE material_id = $MATERIAL_ID 
  AND warehouse_id = '$WAREHOUSE_ID' 
  AND batch_no = '$BATCH';
SQL

echo "============================================================"
echo "演练结束，数据已回滚。"
echo "============================================================"
