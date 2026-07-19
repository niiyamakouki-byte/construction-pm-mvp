/**
 * ナビゲーション用 lucide-react アイコンマップ
 * サイドバー・モバイルナビで共通使用
 */
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  BarChart2,
  ClipboardList,
  Bell,
  CloudRain,
  Building2,
  FileText,
  Ruler,
  CalendarDays,
  Camera,
  HardHat,
  Package,
  ShoppingCart,
  TrendingUp,
  Handshake,
  Receipt,
  BookOpen,
  HelpCircle,
  Network,
  FileBarChart,
  PaintBucket,
  CalendarRange,
  DollarSign,
  Users,
  Settings,
  MoreHorizontal,
  Home,
  LayoutGrid,
  Wallet,
  Layers,
} from "lucide-react";

const SIZE = 18;
const STROKE = 1.75;

export const navIconMap: Record<string, React.ReactNode> = {
  home: <Home size={SIZE} strokeWidth={STROKE} />,
  dashboard: <LayoutDashboard size={SIZE} strokeWidth={STROKE} />,
  "project-list": <FolderKanban size={SIZE} strokeWidth={STROKE} />,
  tasks: <CheckSquare size={SIZE} strokeWidth={STROKE} />,
  gantt: <BarChart2 size={SIZE} strokeWidth={STROKE} />,
  today: <ClipboardList size={SIZE} strokeWidth={STROKE} />,
  notifications: <Bell size={SIZE} strokeWidth={STROKE} />,
  weather: <CloudRain size={SIZE} strokeWidth={STROKE} />,
  contractors: <Building2 size={SIZE} strokeWidth={STROKE} />,
  estimate: <DollarSign size={SIZE} strokeWidth={STROKE} />,
  takeoff: <Ruler size={SIZE} strokeWidth={STROKE} />,
  "cross-gantt": <CalendarRange size={SIZE} strokeWidth={STROKE} />,
  "progress-review": <Camera size={SIZE} strokeWidth={STROKE} />,
  photos: <Camera size={SIZE} strokeWidth={STROKE} />,
  safety: <HardHat size={SIZE} strokeWidth={STROKE} />,
  procurement: <Package size={SIZE} strokeWidth={STROKE} />,
  orders: <ShoppingCart size={SIZE} strokeWidth={STROKE} />,
  cost: <TrendingUp size={SIZE} strokeWidth={STROKE} />,
  crm: <Users size={SIZE} strokeWidth={STROKE} />,
  invoice: <Receipt size={SIZE} strokeWidth={STROKE} />,
  freee: <BookOpen size={SIZE} strokeWidth={STROKE} />,
  help: <HelpCircle size={SIZE} strokeWidth={STROKE} />,
  node: <Network size={SIZE} strokeWidth={STROKE} />,
  cards: <LayoutGrid size={SIZE} strokeWidth={STROKE} />,
  reports: <FileBarChart size={SIZE} strokeWidth={STROKE} />,
  finishing: <PaintBucket size={SIZE} strokeWidth={STROKE} />,
  schedule: <CalendarDays size={SIZE} strokeWidth={STROKE} />,
  "phase-templates": <FileText size={SIZE} strokeWidth={STROKE} />,
  account: <Settings size={SIZE} strokeWidth={STROKE} />,
  more: <MoreHorizontal size={SIZE} strokeWidth={STROKE} />,
  "partner-companies": <Handshake size={SIZE} strokeWidth={STROKE} />,
  "money-hub": <Wallet size={SIZE} strokeWidth={STROKE} />,
  "field-hub": <Layers size={SIZE} strokeWidth={STROKE} />,
};

/** アイコンキーからlucide SVGを返す。未知のキーはFileTextにフォールバック */
export function NavIcon({ id }: { id: string }) {
  return <>{navIconMap[id] ?? <FileText size={SIZE} strokeWidth={STROKE} />}</>;
}
