<template>
  <router-view />
</template>

<script setup>
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
}

#app {
  height: 100%;
}

#app.dark {
  background-color: #0b0f14;
  color: #f3f4f6;
}
#app.dark a,
#app.dark p,
#app.dark span,
#app.dark div,
#app.dark li {
  color: inherit;
}
#app.dark .el-card,
#app.dark .el-dialog,
#app.dark .el-message-box,
#app.dark .el-popover,
#app.dark .el-dropdown-menu,
#app.dark .el-tooltip__popper {
  background-color: #0f172a;
  color: #f3f4f6;
  border-color: #1f2937;
}
#app.dark .el-card__header,
#app.dark .el-dialog__header,
#app.dark .el-message-box__header {
  border-bottom-color: #1f2937;
  color: #f3f4f6;
}
#app.dark .el-form-item__label,
#app.dark .el-breadcrumb__inner,
#app.dark .el-breadcrumb__separator {
  color: #f3f4f6;
}
#app.dark .el-input__wrapper,
#app.dark .el-textarea__inner,
#app.dark .el-select__wrapper,
#app.dark .el-select-dropdown,
#app.dark .el-input-number {
  background-color: #0b0f14;
  border-color: #1f2937;
  color: #f3f4f6;
  box-shadow: none;
}
#app.dark .el-input__inner,
#app.dark .el-textarea__inner {
  color: #f3f4f6;
}
#app.dark .el-button:not(.is-text):not(.is-link) {
  background-color: #0f172a;
  border-color: #1f2937;
  color: #f3f4f6;
}
#app.dark .el-button.is-disabled {
  background-color: #0b0f14;
  border-color: #1f2937;
  color: #6b7280;
}
#app.dark .el-tabs__item,
#app.dark .el-tabs__nav {
  color: #f3f4f6;
  border-color: #1f2937;
}
#app.dark .el-switch__core {
  background-color: #111827;
}
</style>
