# DeviceDataModal — Vue 3 版本

## 依赖安装

```bash
npm install echarts vue-echarts
# 已有 Tailwind CSS v3/v4 + Vue 3 环境即可
```

## 使用方式

```vue
<script setup>
import DeviceDataModal from './DeviceDataModal.vue'
</script>

<template>
  <!-- 弹窗遮罩（根据你的 Modal 系统接入） -->
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <DeviceDataModal />
  </div>
</template>
```

## 功能清单

| 功能 | 状态 |
|---|---|
| 顶部实时状态看板（电压/4G/温湿度/GIS） | ✅ |
| 左侧数据树（监测/工况模式切换） | ✅ |
| 复选框勾选监测指标 | ✅ |
| 时间范围选择（今天/近7天/近30天/自定义） | ✅ |
| 自定义日期时间选择器 | ✅ |
| 引入其他设备比对按钮 | ✅ |
| 工况指标过滤标签 | ✅ |
| 数据平滑（5档强度）| ✅ |
| 折线图 / 柱状图 / 表格 三种视图 | ✅ |
| 多 Y 轴（不同单位自动分配坐标轴） | ✅ |
| 时间段拖动条（ECharts dataZoom） | ✅ |
| 鼠标悬浮 tooltip（多指标聚合） | ✅ |
| 导出按钮（需自行接入导出逻辑） | ✅ |

## 注意事项

- ECharts 通过 `vue-echarts` 的 `<v-chart>` 组件渲染，需要在入口文件注册或局部注册。
- 组件已在内部通过 `use()` 按需引入所需 ECharts 模块，无需在外层重复注册。
- Tailwind CSS 需在项目中正确配置（`content` 路径包含此文件）。
- 真实项目中请替换 `makeMonitorData()` / `makeConditionData()` 为接口数据。
