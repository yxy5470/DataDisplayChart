<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { use } from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
])

// ─────────────── Types ───────────────
type TimeRange = 'today' | '7d' | '30d' | 'custom'
type ChartType = 'line' | 'bar' | 'table'
type DataMode = 'monitor' | 'condition'

interface SeriesDef {
  k: string
  name: string
  color: string
  unit: string
  axis?: string
}

// ─────────────── Mock Data ───────────────
const START = new Date('2025-12-30T00:00:00')
const POINTS = 96

function makeMonitorData() {
  return Array.from({ length: POINTS }).map((_, i) => {
    const d = new Date(START.getTime() + i * 3_600_000)
    return {
      time: d.toISOString(),
      x: +(Math.sin(i / 6) * 1.2 + 2.5 + Math.random() * 0.4).toFixed(2),
      y: +(Math.cos(i / 7) * 0.9 + 1.8 + Math.random() * 0.3).toFixed(2),
      z: +(Math.sin(i / 8) * 0.6 + 1.2 + Math.random() * 0.2).toFixed(2),
      水位: +(3.5 + Math.sin(i / 10) * 0.6 + Math.random() * 0.1).toFixed(2),
      流速: +(1.2 + Math.cos(i / 8) * 0.4 + Math.random() * 0.08).toFixed(2),
      流量: +(120 + Math.sin(i / 9) * 25 + Math.random() * 5).toFixed(1),
    }
  })
}

function makeConditionData() {
  return Array.from({ length: POINTS }).map((_, i) => {
    const d = new Date(START.getTime() + i * 3_600_000)
    return {
      time: d.toISOString(),
      电压: +(220 + Math.sin(i / 7) * 4 + Math.random() * 2).toFixed(1),
      温度: +(25 + Math.cos(i / 8) * 3 + Math.random()).toFixed(1),
      信号: +(-65 + Math.sin(i / 9) * 8 + Math.random() * 3).toFixed(0),
    }
  })
}

const rawMonitorData = makeMonitorData()
const rawConditionData = makeConditionData()

// ─────────────── Series Definitions ───────────────
const MONITOR_LINES: SeriesDef[] = [
  { k: 'x', name: 'X轴倾角', color: '#3b82f6', unit: '°' },
  { k: 'y', name: 'Y轴倾角', color: '#a855f7', unit: '°' },
  { k: 'z', name: 'Z轴倾角', color: '#10b981', unit: '°' },
  { k: '水位', name: '水位', color: '#06b6d4', unit: 'm' },
  { k: '流速', name: '流速', color: '#f59e0b', unit: 'm/s' },
  { k: '流量', name: '流量', color: '#ec4899', unit: 'm³/h' },
]

const CONDITION_LINES: SeriesDef[] = [
  { k: '电压', name: '电压', color: '#3b82f6', unit: 'V', axis: 'left' },
  { k: '温度', name: '温度', color: '#ef4444', unit: '℃', axis: 'right' },
  { k: '信号', name: '4G信号', color: '#a855f7', unit: 'dBm', axis: 'right2' },
]

// unit → yAxis index mapping
const UNIT_AXIS_IDX: Record<string, number> = {
  '°': 0, 'm': 1, 'm/s': 2, 'm³/h': 3,
  'V': 0, '℃': 1, 'dBm': 2,
}

// ─────────────── Utility Functions ───────────────
function fmtAxis(iso: string) {
  const d = new Date(iso)
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  return `${M}/${D} ${h}:00`
}

function fmtTooltip(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '00')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function smoothSeries(data: any[], keys: string[], window: number) {
  const half = Math.floor(window / 2)
  return data.map((row, i) => {
    const out: any = { ...row }
    keys.forEach((k) => {
      let sum = 0, n = 0
      for (let j = Math.max(0, i - half); j <= Math.min(data.length - 1, i + half); j++) {
        if (typeof data[j][k] === 'number') { sum += data[j][k]; n++ }
      }
      if (n > 0) out[k] = +(sum / n).toFixed(2)
    })
    return out
  })
}

// ─────────────── Reactive State ───────────────
const mode = ref<DataMode>('monitor')
const expanded = ref(true)
const checks = reactive<Record<string, boolean>>({
  x: true, y: true, z: false, 水位: true, 流速: false, 流量: false,
})
const timeRange = ref<TimeRange>('today')
const customRange = reactive({ start: '2025-12-30T00:00', end: '2026-01-02T23:00' })
const chartType = ref<ChartType>('line')
const conditionFilters = ref<string[]>(['电压', '温度'])
const smooth = ref(false)
const smoothWindow = ref(5)
const showTip = ref(false)
const smoothOpen = ref(false)

const smoothOptions = [
  { v: 0, label: '关闭', desc: '原始数据' },
  { v: 3, label: '轻度', desc: '窗口 3，保留细节' },
  { v: 5, label: '中等', desc: '窗口 5，推荐' },
  { v: 7, label: '强', desc: '窗口 7，去抖动' },
  { v: 11, label: '极强', desc: '窗口 11，长趋势' },
]
const currentSmooth = computed(
  () => smoothOptions.find((o) => o.v === (smooth.value ? smoothWindow.value : 0)) ?? smoothOptions[0]
)

function setSmoothValue(v: number) {
  if (v === 0) { smooth.value = false }
  else { smooth.value = true; smoothWindow.value = v }
  smoothOpen.value = false
}

// ─────────────── Computed Data ───────────────
const isMonitor = computed(() => mode.value === 'monitor')

const activeData = computed(() => {
  const raw = isMonitor.value ? rawMonitorData : rawConditionData
  if (isMonitor.value && smooth.value) {
    return smoothSeries(raw, MONITOR_LINES.map((l) => l.k), smoothWindow.value)
  }
  return raw
})

const visibleSeries = computed<SeriesDef[]>(() => {
  if (isMonitor.value) return MONITOR_LINES.filter((l) => checks[l.k])
  return CONDITION_LINES.filter((l) => conditionFilters.value.includes(l.k))
})

function removeConditionFilter(f: string) {
  conditionFilters.value = conditionFilters.value.filter((x) => x !== f)
}

// ─────────────── ECharts Option ───────────────
const chartOption = computed(() => {
  const data = activeData.value
  const series = visibleSeries.value
  const times = data.map((d: any) => d.time)

  // Build yAxis array (deduplicated by unit)
  const usedUnits: string[] = []
  series.forEach((s) => { if (!usedUnits.includes(s.unit)) usedUnits.push(s.unit) })

  const unitColors: Record<string, string> = {
    '°': '#64748b', 'm': '#06b6d4', 'm/s': '#f59e0b', 'm³/h': '#ec4899',
    'V': '#3b82f6', '℃': '#ef4444', 'dBm': '#a855f7',
  }

  const yAxes = usedUnits.map((u, idx) => ({
    type: 'value',
    name: u,
    nameTextStyle: { fontSize: 10, color: unitColors[u] ?? '#64748b' },
    axisLabel: { fontSize: 10, color: unitColors[u] ?? '#64748b', formatter: `{value} ${u}` },
    axisLine: { lineStyle: { color: unitColors[u] ?? '#64748b' } },
    splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    position: idx === 0 ? 'left' : 'right',
    offset: idx > 1 ? (idx - 1) * 60 : 0,
  }))

  const echartsType = chartType.value === 'bar' ? 'bar' : 'line'

  const seriesArr = series.map((s) => {
    const axisIdx = usedUnits.indexOf(s.unit)
    return {
      name: `${s.name} (${s.unit})`,
      type: echartsType,
      yAxisIndex: axisIdx,
      data: data.map((d: any) => d[s.k]),
      itemStyle: { color: s.color },
      lineStyle: { color: s.color, width: 2 },
      smooth: false,
      symbol: 'circle',
      symbolSize: 4,
      showSymbol: false,
    }
  })

  return {
    animation: false,
    grid: { top: 10, right: Math.max(60, (usedUnits.length - 1) * 60), left: 60, bottom: 80 },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: {
        fontSize: 10,
        color: '#64748b',
        formatter: (val: string) => fmtAxis(val),
        interval: Math.floor(times.length / 8),
      },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: yAxes,
    tooltip: {
      trigger: 'axis',
      textStyle: { fontSize: 12 },
      borderRadius: 6,
      borderColor: '#e2e8f0',
      formatter: (params: any[]) => {
        const time = fmtTooltip(params[0]?.axisValue ?? '')
        const rows = params.map((p: any) =>
          `<div style="display:flex;justify-content:space-between;gap:16px">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>${p.seriesName}</span>
            <span style="font-weight:600">${p.value}</span>
          </div>`
        ).join('')
        return `<div style="font-size:11px;color:#475569;margin-bottom:4px">${time}</div>${rows}`
      },
    },
    dataZoom: [
      {
        type: 'slider',
        bottom: 10,
        height: 24,
        borderColor: '#3b82f6',
        handleStyle: { color: '#3b82f6' },
        textStyle: { fontSize: 10, color: '#64748b' },
        labelFormatter: (idx: number) => {
          const t = times[Math.round(idx)]
          if (!t) return ''
          const d = new Date(t)
          return `${String(d.getFullYear()).slice(2)}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
        },
      },
      { type: 'inside' },
    ],
    series: seriesArr,
  }
})

// Time range label
const timeLabel = computed(() => {
  if (timeRange.value === 'today') return '今天'
  if (timeRange.value === '7d') return '近7天'
  if (timeRange.value === '30d') return '近30天'
  return `${customRange.start} ~ ${customRange.end}`
})
</script>

<template>
  <!-- Overlay backdrop (use inside your modal system) -->
  <div
    class="bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
    style="width: min(1400px, 96vw); height: min(860px, 94vh)"
  >
    <!-- ── Header + Status Bar ── -->
    <div class="bg-gradient-to-r from-slate-50 to-sky-50/60 border-b border-slate-200">
      <!-- Title row -->
      <div class="flex items-center justify-between px-6 pt-4 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-1 h-5 bg-blue-500 rounded-sm" />
          <h2 class="text-slate-900 text-base font-semibold">
            设备数据分析详情 - 1号主水泵点位
          </h2>
          <span class="ml-3 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-[11px]">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            在线
          </span>
        </div>
        <button class="p-1.5 rounded hover:bg-slate-200/60 text-slate-500">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Status row -->
      <div class="px-6 pb-4 flex items-center flex-wrap gap-x-5 gap-y-2">
        <div class="flex items-center gap-1.5">
          <span class="text-slate-500 text-[12px]">监测点位：</span>
          <span class="text-slate-800 text-[12px] font-medium">1号主水泵点位</span>
        </div>
        <div class="h-3 w-px bg-slate-300" />
        <div class="flex items-center gap-1.5">
          <span class="text-slate-500 text-[12px]">S/N：</span>
          <code class="bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[11px]">SN883921X</code>
        </div>
        <div class="h-3 w-px bg-slate-300" />
        <div class="flex items-center gap-1">
          <!-- Zap icon -->
          <svg class="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <span class="text-slate-500 text-[12px]">电压：</span>
          <span class="text-slate-800 text-[12px] font-medium">220V</span>
        </div>
        <div class="h-3 w-px bg-slate-300" />
        <div class="flex items-center gap-1">
          <!-- Signal icon -->
          <svg class="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V4M22 20v-2"/></svg>
          <span class="text-slate-500 text-[12px]">4G信号：</span>
          <span class="text-slate-800 text-[12px] font-medium">强 <span class="text-slate-400">(-65dBm)</span></span>
        </div>
        <div class="h-3 w-px bg-slate-300" />
        <div class="flex items-center gap-1">
          <!-- Thermometer icon -->
          <svg class="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
          <span class="text-slate-500 text-[12px]">温湿度：</span>
          <span class="text-slate-800 text-[12px] font-medium">25℃ / 45%RH</span>
        </div>
        <div class="h-3 w-px bg-slate-300" />
        <div class="flex items-center gap-1.5">
          <span class="text-slate-500 text-[12px]">经纬度：</span>
          <span class="text-slate-800 font-mono text-[12px]">116.397, 39.908</span>
          <div class="relative">
            <button
              @mouseenter="showTip = true"
              @mouseleave="showTip = false"
              class="ml-1 w-6 h-6 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-sm transition"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </button>
            <div
              v-if="showTip"
              class="absolute bottom-full mb-2 right-0 whitespace-nowrap bg-slate-800 text-white px-2.5 py-1 rounded shadow-lg z-10 text-[12px]"
            >
              点击跳转至首页 GIS 地图
              <div class="absolute top-full right-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Body ── -->
    <div class="flex-1 flex min-h-0 px-6 py-4 gap-0">

      <!-- Left Tree -->
      <div class="w-[260px] border-r border-slate-200 pr-4 overflow-y-auto">
        <div class="relative mb-3">
          <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder="搜索数据类型"
            class="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 text-[12px]"
          />
        </div>

        <!-- 监测数据 -->
        <div>
          <div
            @click="mode = 'monitor'"
            :class="[
              'flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer',
              mode === 'monitor' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700',
            ]"
          >
            <button
              @click.stop="expanded = !expanded"
              class="p-0.5 hover:bg-slate-200/60 rounded"
            >
              <svg v-if="expanded" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <!-- Radio -->
            <button
              @click.stop="mode = 'monitor'"
              :class="['w-4 h-4 rounded-full border flex items-center justify-center', mode === 'monitor' ? 'border-blue-500' : 'border-slate-300 hover:border-blue-400']"
            >
              <span v-if="mode === 'monitor'" class="w-2 h-2 rounded-full bg-blue-500" />
            </button>
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
            <span class="text-[13px] font-medium">监测数据</span>
          </div>

          <div v-if="expanded" class="ml-5 mt-1 border-l border-slate-200 pl-3 space-y-1">
            <label
              v-for="n in MONITOR_LINES"
              :key="n.k"
              class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-slate-700"
            >
              <!-- Checkbox -->
              <button
                @click="checks[n.k] = !checks[n.k]"
                :class="[
                  'w-4 h-4 rounded-sm border flex items-center justify-center transition',
                  checks[n.k] ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300 hover:border-blue-400',
                ]"
              >
                <svg v-if="checks[n.k]" viewBox="0 0 16 16" class="w-3 h-3 text-white" fill="none">
                  <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span class="text-[13px]">{{ n.name }}</span>
            </label>
          </div>
        </div>

        <!-- 工况数据 -->
        <div class="mt-2">
          <div
            @click="mode = 'condition'"
            :class="[
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
              mode === 'condition' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700',
            ]"
          >
            <span class="w-3.5" />
            <button
              @click.stop="mode = 'condition'"
              :class="['w-4 h-4 rounded-full border flex items-center justify-center', mode === 'condition' ? 'border-blue-500' : 'border-slate-300 hover:border-blue-400']"
            >
              <span v-if="mode === 'condition'" class="w-2 h-2 rounded-full bg-blue-500" />
            </button>
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
            <span class="text-[13px] font-medium">工况数据 (全量)</span>
          </div>
        </div>
      </div>

      <!-- Right Area -->
      <div class="flex-1 pl-5 flex flex-col min-w-0">
        <!-- Toolbar -->
        <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <!-- Time range -->
          <div class="flex items-center border border-slate-200 rounded overflow-hidden">
            <button
              v-for="(t, i) in [{ k: 'today', l: '今天' }, { k: '7d', l: '近7天' }, { k: '30d', l: '近30天' }]"
              :key="t.k"
              @click="timeRange = t.k as TimeRange"
              :class="[
                'px-3 py-1.5 text-[12px] transition',
                timeRange === t.k ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:text-blue-500',
                i > 0 ? 'border-l border-slate-200' : '',
              ]"
            >
              {{ t.l }}
            </button>
            <!-- Custom datetime -->
            <div :class="['flex items-center gap-1 px-2 py-1 border-l border-slate-200', timeRange === 'custom' ? 'bg-blue-50' : 'bg-white']">
              <svg :class="['w-3 h-3', timeRange === 'custom' ? 'text-blue-500' : 'text-slate-400']" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <input
                type="datetime-local"
                v-model="customRange.start"
                @change="timeRange = 'custom'"
                class="bg-transparent outline-none text-slate-700 text-[12px]"
              />
              <span class="text-slate-400 text-[12px]">→</span>
              <input
                type="datetime-local"
                v-model="customRange.end"
                @change="timeRange = 'custom'"
                class="bg-transparent outline-none text-slate-700 text-[12px]"
              />
            </div>
          </div>

          <!-- Compare device -->
          <button class="flex items-center gap-1.5 border-2 border-blue-400 text-blue-600 bg-blue-50/40 hover:bg-blue-50 px-3 py-1 rounded transition text-[12px]">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            引入其他设备比对
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          <!-- Condition filter -->
          <div
            v-if="mode === 'condition'"
            class="flex items-center gap-2 border border-slate-200 rounded px-2 py-1 bg-white min-w-[260px]"
          >
            <span class="text-slate-500 text-[12px]">工况指标：</span>
            <div class="flex items-center gap-1 flex-wrap">
              <span
                v-for="f in conditionFilters"
                :key="f"
                class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]"
              >
                {{ f }}
                <button @click="removeConditionFilter(f)" class="text-slate-400 hover:text-slate-600">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </span>
            </div>
            <svg class="w-3 h-3 text-slate-400 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>

          <!-- Right controls -->
          <div class="ml-auto flex items-center gap-2">
            <!-- Smooth control -->
            <div v-if="isMonitor" class="relative">
              <button
                @click="smoothOpen = !smoothOpen"
                :class="[
                  'flex items-center gap-1.5 px-2.5 py-1.5 border rounded transition text-[12px]',
                  smooth ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300',
                ]"
                title="对数据进行滑动平均滤波，去除噪声波动"
              >
                <svg viewBox="0 0 16 16" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M1 11c2 0 2-4 4-4s2 6 4 6 2-8 4-8 2 3 2 3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                数据平滑
                <span :class="['px-1.5 py-0.5 rounded text-[10px]', smooth ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500']">
                  {{ currentSmooth.label }}
                </span>
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <template v-if="smoothOpen">
                <div class="fixed inset-0 z-10" @click="smoothOpen = false" />
                <div class="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-1">
                  <div class="px-3 py-1.5 border-b border-slate-100 text-slate-500 text-[11px]">滤波强度</div>
                  <button
                    v-for="o in smoothOptions"
                    :key="o.v"
                    @click="setSmoothValue(o.v)"
                    :class="['w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-blue-50', (smooth ? smoothWindow === o.v : o.v === 0) ? 'bg-blue-50/60' : '']"
                  >
                    <div>
                      <div :class="[(smooth ? smoothWindow === o.v : o.v === 0) ? 'text-blue-600' : 'text-slate-700', 'text-[12px] font-medium']">{{ o.label }}</div>
                      <div class="text-slate-400 text-[11px]">{{ o.desc }}</div>
                    </div>
                    <svg v-if="smooth ? smoothWindow === o.v : o.v === 0" viewBox="0 0 16 16" class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
              </template>
            </div>

            <!-- Export -->
            <button class="flex items-center gap-1 px-2 py-1.5 text-slate-500 hover:text-blue-500 border border-slate-200 rounded text-[12px]">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              导出
            </button>

            <!-- Chart type switcher -->
            <div class="flex items-center border border-slate-200 rounded overflow-hidden">
              <button
                v-for="(t, i) in [
                  { k: 'line', icon: 'line' },
                  { k: 'bar', icon: 'bar' },
                  { k: 'table', icon: 'table' },
                ]"
                :key="t.k"
                @click="chartType = t.k as ChartType"
                :class="[
                  'px-2.5 py-1.5 transition',
                  chartType === t.k ? 'bg-blue-500 text-white' : 'bg-white text-slate-500 hover:text-blue-500',
                  i > 0 ? 'border-l border-slate-200' : '',
                ]"
              >
                <!-- Line icon -->
                <svg v-if="t.icon === 'line'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <!-- Bar icon -->
                <svg v-else-if="t.icon === 'bar'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
                <!-- Table icon -->
                <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Chart / Table area -->
        <div class="flex-1 border border-slate-200 rounded-md bg-white p-4 min-h-0 flex flex-col">
          <!-- Chart header -->
          <div class="flex items-center justify-between mb-2 flex-shrink-0">
            <div class="text-slate-700 text-[13px] font-medium">
              {{ isMonitor ? '倾角监测数据趋势' : '工况数据趋势' }}
              <span class="text-slate-400 ml-2 text-[11px]">({{ timeLabel }})</span>
            </div>
            <div class="flex items-center gap-4 text-[12px]">
              <span
                v-for="s in visibleSeries"
                :key="s.k"
                class="flex items-center gap-1.5 text-slate-600"
              >
                <span class="w-3 h-0.5 inline-block" :style="{ background: s.color }" />
                {{ s.name }}
                <span class="text-slate-400">({{ s.unit }})</span>
              </span>
            </div>
          </div>

          <!-- ECharts -->
          <div v-if="chartType !== 'table'" class="flex-1 min-h-0 w-full">
            <v-chart
              class="w-full h-full"
              :option="chartOption"
              autoresize
            />
          </div>

          <!-- Table view -->
          <div v-else class="flex-1 min-h-0 overflow-auto border border-slate-200 rounded">
            <table class="w-full text-[12px]">
              <thead class="bg-slate-50 sticky top-0">
                <tr class="text-slate-600">
                  <th class="px-3 py-2 text-left border-b border-slate-200 font-medium">时间</th>
                  <th
                    v-for="s in visibleSeries"
                    :key="s.k"
                    class="px-3 py-2 text-right border-b border-slate-200 font-medium"
                  >
                    <span class="inline-flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-sm" :style="{ background: s.color }" />
                      {{ s.name }}
                      <span class="text-slate-400">({{ s.unit }})</span>
                    </span>
                  </th>
                  <th class="px-3 py-2 text-left border-b border-slate-200 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in activeData"
                  :key="idx"
                  class="hover:bg-blue-50/40 border-b border-slate-100"
                >
                  <td class="px-3 py-1.5 text-slate-700 font-mono">{{ fmtTooltip(row.time) }}</td>
                  <td
                    v-for="s in visibleSeries"
                    :key="s.k"
                    class="px-3 py-1.5 text-right text-slate-800 font-mono"
                  >
                    {{ row[s.k] }}<span class="text-slate-400 ml-0.5">{{ s.unit }}</span>
                  </td>
                  <td class="px-3 py-1.5">
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[11px]">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      正常
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
