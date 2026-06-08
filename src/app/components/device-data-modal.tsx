import { useState } from "react";
import {
  X,
  Zap,
  Signal,
  Thermometer,
  MapPin,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Settings2,
  Calendar,
  PlusCircle,
  LineChart as LineChartIcon,
  BarChart as BarChartIcon,
  Table as TableIcon,
  Download,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";

// Multi-day data with full timestamps - 最近30天数据，每小时一个点
const NOW = new Date();
const START = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000); // 30天前
const POINTS = 30 * 24; // 30天 * 24小时
const monitorData = Array.from({ length: POINTS }).map((_, i) => {
  const d = new Date(START.getTime() + i * 60 * 60 * 1000);
  return {
    time: d.toISOString(),
    x: +(Math.sin(i / 6) * 1.2 + 2.5 + Math.random() * 0.4).toFixed(2),
    y: +(Math.cos(i / 7) * 0.9 + 1.8 + Math.random() * 0.3).toFixed(2),
    z: +(Math.sin(i / 8) * 0.6 + 1.2 + Math.random() * 0.2).toFixed(2),
    水位: +(3.5 + Math.sin(i / 10) * 0.6 + Math.random() * 0.1).toFixed(2),
    流速: +(1.2 + Math.cos(i / 8) * 0.4 + Math.random() * 0.08).toFixed(2),
    流量: +(120 + Math.sin(i / 9) * 25 + Math.random() * 5).toFixed(1),
  };
});
const conditionData = Array.from({ length: POINTS }).map((_, i) => {
  const d = new Date(START.getTime() + i * 60 * 60 * 1000);
  return {
    time: d.toISOString(),
    电压: +(12.2 + Math.sin(i / 7) * 0.4 + Math.random() * 0.15).toFixed(2),
    温度: +(25 + Math.cos(i / 8) * 3 + Math.random()).toFixed(1),
    湿度: +(45 + Math.sin(i / 11) * 8 + Math.random() * 2).toFixed(1),
    信号: +(-65 + Math.sin(i / 9) * 8 + Math.random() * 3).toFixed(0),
  };
});

function fmtAxis(iso: string, range?: TimeRange) {
  const d = new Date(iso);
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");

  // 今天显示时:分，其他显示月/日 时:00
  if (range === "today") {
    return `${h}:${m}`;
  }
  return `${M}/${D} ${h}:00`;
}
function fmtBrush(iso: string) {
  const d = new Date(iso);
  const y = String(d.getFullYear()).slice(2);
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${y}/${M}/${D}`;
}
function uniqueUnits(series: { unit: string }[]) {
  const out: string[] = [];
  series.forEach((s) => { if (!out.includes(s.unit)) out.push(s.unit); });
  return out;
}

function smoothSeries(data: any[], keys: string[], window: number) {
  const half = Math.floor(window / 2);
  return data.map((row, i) => {
    const out: any = { ...row };
    keys.forEach((k) => {
      let sum = 0, n = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(data.length - 1, i + half); j++) {
        if (typeof data[j][k] === "number") { sum += data[j][k]; n++; }
      }
      if (n > 0) out[k] = +(sum / n).toFixed(2);
    });
    return out;
  });
}

function fmtTooltip(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`w-4 h-4 rounded-sm border flex items-center justify-center transition ${
        checked
          ? "bg-blue-500 border-blue-500"
          : "bg-white border-slate-300 hover:border-blue-400"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="w-3 h-3 text-white" fill="none">
          <path
            d="M3 8l3.5 3.5L13 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function Radio({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
        checked ? "border-blue-500" : "border-slate-300 hover:border-blue-400"
      }`}
    >
      {checked && <span className="w-2 h-2 rounded-full bg-blue-500" />}
    </button>
  );
}

type TimeRange = "today" | "7d" | "30d" | "custom";
type ChartType = "line" | "bar" | "table";
type DataMode = "monitor" | "condition";

const MONITOR_LINES = [
  { k: "x", name: "X轴倾角", color: "#3b82f6", unit: "°" },
  { k: "y", name: "Y轴倾角", color: "#a855f7", unit: "°" },
  { k: "z", name: "Z轴倾角", color: "#10b981", unit: "°" },
  { k: "水位", name: "水位", color: "#06b6d4", unit: "m" },
  { k: "流速", name: "流速", color: "#f59e0b", unit: "m/s" },
  { k: "流量", name: "流量", color: "#ec4899", unit: "m³/h" },
];

const CONDITION_LINES = [
  { k: "电压", name: "电压", color: "#3b82f6", unit: "V" },
  { k: "温度", name: "温度", color: "#ef4444", unit: "℃" },
  { k: "湿度", name: "湿度", color: "#06b6d4", unit: "%RH" },
  { k: "信号", name: "4G信号", color: "#a855f7", unit: "dBm" },
];

export function DeviceDataModal() {
  const [expanded, setExpanded] = useState(true);
  const [conditionExpanded, setConditionExpanded] = useState(true);
  const [checks, setChecks] = useState<Record<string, boolean>>({
    x: true, y: true, z: false, 水位: true, 流速: false, 流量: false,
  });
  const [conditionChecks, setConditionChecks] = useState<Record<string, boolean>>({
    电压: true, 温度: true, 湿度: false, 信号: false,
  });
  const [mode, setMode] = useState<DataMode>("monitor");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      start: sevenDaysAgo.toISOString().slice(0, 16),
      end: now.toISOString().slice(0, 16),
    };
  });
  const [chartType, setChartType] = useState<ChartType>("line");
  const [showTip, setShowTip] = useState(false);
  const [smooth, setSmooth] = useState(false);
  const [smoothWindow, setSmoothWindow] = useState(5);

  const isMonitor = mode === "monitor";

  // 根据时间范围过滤数据
  const getFilteredData = () => {
    const allData = isMonitor ? monitorData : conditionData;
    const now = new Date();

    if (timeRange === "today") {
      // 今天：最近24小时
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return allData.filter(d => new Date(d.time) >= startTime);
    } else if (timeRange === "7d") {
      // 近7天
      const startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return allData.filter(d => new Date(d.time) >= startTime);
    } else if (timeRange === "30d") {
      // 近30天
      const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return allData.filter(d => new Date(d.time) >= startTime);
    } else if (timeRange === "custom") {
      // 自定义时间范围
      const startTime = new Date(customRange.start);
      const endTime = new Date(customRange.end);
      return allData.filter(d => {
        const t = new Date(d.time);
        return t >= startTime && t <= endTime;
      });
    }
    return allData;
  };

  const filteredData = getFilteredData();

  // 根据时间范围对数据进行采样，避免数据点过多
  const getSampledData = (data: any[]) => {
    if (timeRange === "today") {
      // 今天：每小时一个点已经合适
      return data;
    } else if (timeRange === "7d") {
      // 近7天：每2小时一个点
      return data.filter((_, i) => i % 2 === 0);
    } else if (timeRange === "30d") {
      // 近30天：每4小时一个点
      return data.filter((_, i) => i % 4 === 0);
    } else {
      // 自定义：根据数据量决定
      if (data.length > 200) {
        const step = Math.ceil(data.length / 200);
        return data.filter((_, i) => i % step === 0);
      }
      return data;
    }
  };

  const rawData = getSampledData(filteredData);
  const data = isMonitor && smooth
    ? smoothSeries(rawData, MONITOR_LINES.map((l) => l.k), smoothWindow)
    : rawData;
  const visibleMonitor = MONITOR_LINES.filter((l) => checks[l.k]);
  const visibleCondition = CONDITION_LINES.filter((l) => conditionChecks[l.k]);
  const visibleSeries = isMonitor ? visibleMonitor : visibleCondition;

  // 根据勾选内容生成图表标题
  const getChartTitle = () => {
    if (isMonitor) {
      if (visibleMonitor.length === 0) return "监测数据";
      if (visibleMonitor.length === 1) return `${visibleMonitor[0].name}监测数据趋势`;
      return "监测数据趋势";
    } else {
      if (visibleCondition.length === 0) return "工况数据";
      if (visibleCondition.length === 1) return `${visibleCondition[0].name}工况数据趋势`;
      return "工况数据趋势";
    }
  };

  // 根据时间范围调整横坐标刻度间距
  const getMinTickGap = () => {
    if (timeRange === "today") return 30; // 今天显示更密集
    if (timeRange === "7d") return 40;
    if (timeRange === "30d") return 50;
    return 40; // 自定义
  };

  return (
    <div
      className="bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      style={{ width: "min(1400px, 96vw)", height: "min(860px, 94vh)" }}
    >
      <style>{`.recharts-brush-sm text { font-size: 10px; fill: #64748b; }`}</style>
      {/* Header + Status Bar Merged */}
      <div className="bg-gradient-to-r from-slate-50 to-sky-50/60 border-b border-slate-200">
        {/* Title row */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-sm" />
            <h2 className="text-slate-900" style={{ fontWeight: 600, fontSize: 16 }}>
              运行数据分析-[未命名点位]
            </h2>
            <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded" style={{ fontSize: 11 }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              在线
            </span>
          </div>
          <button className="p-1.5 rounded hover:bg-slate-200/60 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status row */}
        <div className="px-6 pb-4 flex items-center flex-wrap gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500" style={{ fontSize: 12 }}>S/N：</span>
            <code className="bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-mono" style={{ fontSize: 11 }}>CR120251120001</code>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
            <span className="text-slate-500" style={{ fontSize: 12 }}>电压：</span>
            <span className="text-slate-800" style={{ fontSize: 12, fontWeight: 500 }}>12.6V</span>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1">
            <Signal className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-slate-500" style={{ fontSize: 12 }}>4G信号：</span>
            <span className="text-slate-800" style={{ fontSize: 12, fontWeight: 500 }}>强（25 ASU）</span>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1">
            <Thermometer className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-slate-500" style={{ fontSize: 12 }}>温湿度：</span>
            <span className="text-slate-800" style={{ fontSize: 12, fontWeight: 500 }}>25.0℃ / 45.0%RH</span>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500" style={{ fontSize: 12 }}>经纬度：</span>
            <span className="text-slate-800 font-mono" style={{ fontSize: 12 }}>116.397876°E，39.908843°N</span>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTip(true)}
                onMouseLeave={() => setShowTip(false)}
                className="ml-1 w-6 h-6 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-sm transition"
              >
                <MapPin className="w-3.5 h-3.5" />
              </button>
              {showTip && (
                <div className="absolute bottom-full mb-2 right-0 whitespace-nowrap bg-slate-800 text-white px-2.5 py-1 rounded shadow-lg z-10" style={{ fontSize: 12 }}>
                  点击跳转至首页 GIS 地图
                  <div className="absolute top-full right-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 px-6 py-4 gap-0">
        {/* Left Tree */}
        <div className="w-[220px] border-r border-slate-200 pr-4 overflow-y-auto">
          <div>
            <div
              onClick={() => setMode("monitor")}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer ${
                mode === "monitor" ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="p-0.5 hover:bg-slate-200/60 rounded"
              >
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              <Radio checked={mode === "monitor"} onChange={() => setMode("monitor")} />
              <BarChart3 className="w-4 h-4" />
              <span style={{ fontSize: 13, fontWeight: 500 }}>监测数据</span>
            </div>
            {expanded && (
              <div className="ml-5 mt-1 border-l border-slate-200 pl-3 space-y-1">
                {MONITOR_LINES.map((n) => (
                  <label
                    key={n.k}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-slate-700"
                  >
                    <Checkbox
                      checked={!!checks[n.k]}
                      onChange={() => setChecks({ ...checks, [n.k]: !checks[n.k] })}
                    />
                    <span style={{ fontSize: 13 }}>{n.name}</span>
                    <span className="text-slate-400 ml-auto" style={{ fontSize: 11 }}>{n.unit}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2">
            <div
              onClick={() => setMode("condition")}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer ${
                mode === "condition" ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setConditionExpanded(!conditionExpanded); }}
                className="p-0.5 hover:bg-slate-200/60 rounded"
              >
                {conditionExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              <Radio checked={mode === "condition"} onChange={() => setMode("condition")} />
              <Settings2 className="w-4 h-4" />
              <span style={{ fontSize: 13, fontWeight: 500 }}>工况数据</span>
            </div>
            {conditionExpanded && (
              <div className="ml-5 mt-1 border-l border-slate-200 pl-3 space-y-1">
                {CONDITION_LINES.map((n) => (
                  <label
                    key={n.k}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-slate-700"
                  >
                    <Checkbox
                      checked={!!conditionChecks[n.k]}
                      onChange={() => setConditionChecks({ ...conditionChecks, [n.k]: !conditionChecks[n.k] })}
                    />
                    <span style={{ fontSize: 13 }}>{n.name}</span>
                    <span className="text-slate-400 ml-auto" style={{ fontSize: 11 }}>{n.unit}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Area */}
        <div className="flex-1 pl-5 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center border border-slate-200 rounded overflow-hidden">
              {[
                { k: "today", l: "今天" },
                { k: "7d", l: "近7天" },
                { k: "30d", l: "近30天" },
              ].map((t, i) => (
                <button
                  key={t.k}
                  onClick={() => { setTimeRange(t.k as TimeRange); setShowDatePicker(false); }}
                  className={`px-3 py-1.5 transition ${
                    timeRange === t.k
                      ? "bg-blue-500 text-white"
                      : "bg-white text-slate-600 hover:text-blue-500"
                  } ${i > 0 ? "border-l border-slate-200" : ""}`}
                  style={{ fontSize: 12 }}
                >
                  {t.l}
                </button>
              ))}
              {/* Custom date - inline pickers */}
              <div className={`flex items-center gap-1 px-2 py-1 border-l border-slate-200 ${timeRange === "custom" ? "bg-blue-50" : "bg-white"}`}>
                <Calendar className={`w-3 h-3 ${timeRange === "custom" ? "text-blue-500" : "text-slate-400"}`} />
                <input
                  type="datetime-local"
                  value={customRange.start}
                  onChange={(e) => { setCustomRange({ ...customRange, start: e.target.value }); setTimeRange("custom"); }}
                  className="bg-transparent outline-none text-slate-700"
                  style={{ fontSize: 12 }}
                />
                <span className="text-slate-400" style={{ fontSize: 12 }}>→</span>
                <input
                  type="datetime-local"
                  value={customRange.end}
                  onChange={(e) => { setCustomRange({ ...customRange, end: e.target.value }); setTimeRange("custom"); }}
                  className="bg-transparent outline-none text-slate-700"
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>

            <button className="flex items-center gap-1.5 border-2 border-blue-400 text-blue-600 bg-blue-50/40 hover:bg-blue-50 px-3 py-1 rounded transition" style={{ fontSize: 12 }}>
              <PlusCircle className="w-3.5 h-3.5" />
              引入其他设备比对
              <ChevronDown className="w-3 h-3" />
            </button>

            <div className="ml-auto flex items-center gap-2">
              {isMonitor && (
                <SmoothControl
                  value={smooth ? smoothWindow : 0}
                  onChange={(v) => {
                    if (v === 0) { setSmooth(false); }
                    else { setSmooth(true); setSmoothWindow(v); }
                  }}
                />
              )}
              <button className="flex items-center gap-1 px-2 py-1.5 text-slate-500 hover:text-blue-500 border border-slate-200 rounded" style={{ fontSize: 12 }}>
                <Download className="w-3.5 h-3.5" />
                导出
              </button>
              <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                {[
                  { k: "line", icon: LineChartIcon },
                  { k: "bar", icon: BarChartIcon },
                  { k: "table", icon: TableIcon },
                ].map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.k}
                      onClick={() => setChartType(t.k as ChartType)}
                      className={`px-2.5 py-1.5 transition ${
                        chartType === t.k
                          ? "bg-blue-500 text-white"
                          : "bg-white text-slate-500 hover:text-blue-500"
                      } ${i > 0 ? "border-l border-slate-200" : ""}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart / Table */}
          <div className="flex-1 border border-slate-200 rounded-md bg-white p-4 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <div className="text-slate-700" style={{ fontSize: 13, fontWeight: 500 }}>
                {getChartTitle()}
                <span className="text-slate-400 ml-2" style={{ fontSize: 11 }}>
                  ({timeRange === "today" ? "今天" : timeRange === "7d" ? "近7天" : timeRange === "30d" ? "近30天" : `${customRange.start} ~ ${customRange.end}`})
                </span>
              </div>
              <div className="flex items-center gap-4" style={{ fontSize: 12 }}>
                {visibleSeries.map((s) => (
                  <span key={s.k} className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-3 h-0.5" style={{ background: s.color }} />
                    {s.name}
                    <span className="text-slate-400">({s.unit})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Outer div is flex-1 and establishes height for the chart */}
            <div
              key={`chart-${mode}-${chartType}-${timeRange}-${uniqueUnits(visibleSeries).join(",")}`}
              className="flex-1 w-full"
              style={{ minHeight: 400 }}
            >
              {chartType === "table" ? (
                <div className="w-full h-full" style={{ minHeight: 400 }}>
                  <DataTable data={data} series={visibleSeries} />
                </div>
              ) : (
                <div className="w-full h-full" style={{ minHeight: 400 }}>
                  <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                    {chartType === "bar" ? (
                      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid key="bar-grid" strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis key="bar-xaxis" dataKey="time" tickFormatter={(v) => fmtAxis(v, timeRange)} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" minTickGap={getMinTickGap()} />
                        {uniqueUnits(visibleSeries).map((u) => (
                          <YAxis
                            key={`bar-ax-${UNIT_AXIS[u].id}`}
                            yAxisId={UNIT_AXIS[u].id}
                            orientation={UNIT_AXIS[u].orient}
                            tick={{ fontSize: 10, fill: UNIT_AXIS[u].color }}
                            stroke={UNIT_AXIS[u].color}
                            width={48}
                            unit={u}
                          />
                        ))}
                        <Tooltip key="bar-tooltip" contentStyle={tooltipStyle} labelFormatter={fmtTooltip} />
                        {visibleSeries.map((s) => (
                          <Bar
                            key={s.k}
                            dataKey={s.k}
                            name={`${s.name} (${s.unit})`}
                            fill={s.color}
                            yAxisId={getYAxisId(isMonitor, s)}
                            isAnimationActive={false}
                          />
                        ))}
                        <Brush key="bar-brush" dataKey="time" height={26} stroke="#3b82f6" travellerWidth={8} tickFormatter={fmtBrush} className="recharts-brush-sm" />
                      </BarChart>
                    ) : (
                      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid key="line-grid" strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis key="line-xaxis" dataKey="time" tickFormatter={(v) => fmtAxis(v, timeRange)} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" minTickGap={getMinTickGap()} />
                        {uniqueUnits(visibleSeries).map((u) => (
                          <YAxis
                            key={`line-ax-${UNIT_AXIS[u].id}`}
                            yAxisId={UNIT_AXIS[u].id}
                            orientation={UNIT_AXIS[u].orient}
                            tick={{ fontSize: 10, fill: UNIT_AXIS[u].color }}
                            stroke={UNIT_AXIS[u].color}
                            width={48}
                            unit={u}
                          />
                        ))}
                        <Tooltip key="line-tooltip" contentStyle={tooltipStyle} labelFormatter={fmtTooltip} />
                        {visibleSeries.map((s) => (
                          <Line
                            key={s.k}
                            type="monotone"
                            dataKey={s.k}
                            name={`${s.name} (${s.unit})`}
                            stroke={s.color}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot={{ r: 5 }}
                            yAxisId={getYAxisId(isMonitor, s)}
                            isAnimationActive={false}
                          />
                        ))}
                        <Brush key="line-brush" dataKey="time" height={26} stroke="#3b82f6" travellerWidth={8} tickFormatter={fmtBrush} className="recharts-brush-sm" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const UNIT_AXIS: Record<string, { id: string; color: string; orient: "left" | "right" }> = {
  "°":    { id: "deg",  color: "#64748b", orient: "left" },
  "m":    { id: "m",    color: "#06b6d4", orient: "right" },
  "m/s":  { id: "mps",  color: "#f59e0b", orient: "right" },
  "m³/h": { id: "mh",   color: "#ec4899", orient: "right" },
  "V":    { id: "v",    color: "#3b82f6", orient: "left" },
  "℃":    { id: "c",    color: "#ef4444", orient: "right" },
  "%RH":  { id: "rh",   color: "#06b6d4", orient: "right" },
  "dBm":  { id: "dbm",  color: "#a855f7", orient: "right" },
};

function getYAxisId(_isMonitor: boolean, s: { unit: string }) {
  return UNIT_AXIS[s.unit]?.id || "default";
}

function renderYAxes(isMonitor: boolean, series: { k: string; unit: string; color?: string }[]) {
  if (isMonitor) {
    return (
      <YAxis
        yAxisId="deg"
        tick={{ fontSize: 11, fill: "#64748b" }}
        stroke="#cbd5e1"
        unit="°"
      />
    );
  }
  const used = new Set(series.map((s) => getYAxisId(false, s)));
  return (
    <>
      {used.has("v") && (
        <YAxis yAxisId="v" orientation="left" tick={{ fontSize: 11, fill: "#3b82f6" }} stroke="#93c5fd" unit="V" />
      )}
      {used.has("c") && (
        <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11, fill: "#ef4444" }} stroke="#fca5a5" unit="℃" />
      )}
      {used.has("dbm") && (
        <YAxis yAxisId="dbm" orientation="right" tick={{ fontSize: 11, fill: "#a855f7" }} stroke="#d8b4fe" unit="dBm" />
      )}
    </>
  );
}

function DataTable({
  data,
  series,
}: {
  data: any[];
  series: { k: string; name: string; unit: string; color?: string }[];
}) {
  return (
    <div className="h-full overflow-auto border border-slate-200 rounded">
      <table className="w-full" style={{ fontSize: 12 }}>
        <thead className="bg-slate-50 sticky top-0">
          <tr className="text-slate-600">
            <th className="px-3 py-2 text-left border-b border-slate-200 font-medium">时间</th>
            {series.map((s) => (
              <th key={s.k} className="px-3 py-2 text-right border-b border-slate-200 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                  {s.name}
                  <span className="text-slate-400">({s.unit})</span>
                </span>
              </th>
            ))}
            <th className="px-3 py-2 text-left border-b border-slate-200 font-medium">状态</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-blue-50/40 border-b border-slate-100">
              <td className="px-3 py-1.5 text-slate-700 font-mono">{fmtTooltip(row.time)}</td>
              {series.map((s) => (
                <td key={s.k} className="px-3 py-1.5 text-right text-slate-800 font-mono">
                  {row[s.k]}
                  <span className="text-slate-400 ml-0.5">{s.unit}</span>
                </td>
              ))}
              <td className="px-3 py-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded" style={{ fontSize: 11 }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  正常
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SmoothControl({
  value,
  onChange,
}: {
  value: number; // 0 = off
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const enabled = value > 0;
  const options = [
    { v: 0, label: "关闭", desc: "原始数据" },
    { v: 3, label: "轻度", desc: "窗口 3，保留细节" },
    { v: 5, label: "中等", desc: "窗口 5，推荐" },
    { v: 7, label: "强", desc: "窗口 7，去抖动" },
    { v: 11, label: "极强", desc: "窗口 11，长趋势" },
  ];
  const current = options.find((o) => o.v === value) ?? options[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded transition ${
          enabled
            ? "border-blue-400 bg-blue-50 text-blue-600"
            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
        }`}
        style={{ fontSize: 12 }}
        title="对数据进行滑动平均滤波，去除噪声波动"
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M1 11c2 0 2-4 4-4s2 6 4 6 2-8 4-8 2 3 2 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        数据平滑
        <span className={`px-1.5 py-0.5 rounded ${enabled ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"}`} style={{ fontSize: 10 }}>
          {current.label}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-1">
            <div className="px-3 py-1.5 border-b border-slate-100 text-slate-500" style={{ fontSize: 11 }}>
              滤波强度
            </div>
            {options.map((o) => (
              <button
                key={o.v}
                onClick={() => { onChange(o.v); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-blue-50 ${
                  o.v === value ? "bg-blue-50/60" : ""
                }`}
              >
                <div>
                  <div className={o.v === value ? "text-blue-600" : "text-slate-700"} style={{ fontSize: 12, fontWeight: 500 }}>
                    {o.label}
                  </div>
                  <div className="text-slate-400" style={{ fontSize: 11 }}>{o.desc}</div>
                </div>
                {o.v === value && (
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
