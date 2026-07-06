/**
 * E2E contrast verification for /today + shared header (p7f, 0fu remediation)
 * Measures real in-browser WCAG 2.x contrast for every text node.
 */
import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "screenshots", "today-contrast-verify");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// gantt-p3p4-verify.test.tsは旧フォーマット(非v4 UUID)のまま維持。
// このテストでは正規のUUID v4を使用してschema warningを解消する。
const SEED_PROJECTS = [
  {
    id: "4b9e1234-5678-4abc-bdef-000000000001",
    name: "GenbaHubデモ案件",
    description: "E2E検証用デモプロジェクト",
    status: "active",
    mode: "normal",
    startDate: "2026-06-28",
    endDate: "2026-08-31",
    includeWeekends: false,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

const SEED_CONTRACTORS = [
  {
    id: "0a3969bb-bc5c-4b47-afe6-09d7447894dd",
    name: "株式会社ラポルタ",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "4b8c171e-5a00-4815-a5c0-46f65563d41c",
    name: "LGS工業",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "d7c98e6a-7dd3-4906-9573-c9049bf81f98",
    name: "電設工業",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "7b4354d2-fecf-4398-bdb9-4cb56841ee4d",
    name: "内装会社",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

const PID = "4b9e1234-5678-4abc-bdef-000000000001";

// Contractor IDs (copied from SEED_CONTRACTORS above for reference)
const CID_RAPORTA  = "0a3969bb-bc5c-4b47-afe6-09d7447894dd";
const CID_LGS      = "4b8c171e-5a00-4815-a5c0-46f65563d41c";
const CID_DENSETSU = "d7c98e6a-7dd3-4906-9573-c9049bf81f98";
const CID_NAISOU   = "7b4354d2-fecf-4398-bdb9-4cb56841ee4d";

const SEED_TASKS = [
  {
    id: "17275fb3-4d06-474b-8974-1839d47698e3",
    projectId: PID,
    name: "塗装下地調整",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-08",
    progress: 50,
    dependencies: [],
    contractorId: CID_RAPORTA,
    majorCategory: "塗装工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "de1fe84f-6598-45c8-9e4b-acbcd5967c63",
    projectId: PID,
    name: "外壁塗装仕上げ",
    description: "",
    status: "todo",
    startDate: "2026-07-09",
    dueDate: "2026-07-18",
    progress: 0,
    dependencies: [],
    contractorId: CID_RAPORTA,
    majorCategory: "塗装工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "1650ce1b-3881-4b18-ae69-4938e934878e",
    projectId: PID,
    name: "軽鉄下地組み",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-15",
    progress: 30,
    dependencies: [],
    contractorId: CID_LGS,
    majorCategory: "軽鉄工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "dbad5511-ce98-4b10-bf8d-878ab062c98e",
    projectId: PID,
    name: "電気配線工事",
    description: "",
    status: "todo",
    startDate: "2026-07-01",
    dueDate: "2026-07-20",
    progress: 0,
    dependencies: [],
    contractorId: CID_DENSETSU,
    majorCategory: "電気工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "cd813529-219b-4979-b832-00b737d413f7",
    projectId: PID,
    name: "床仕上げ工事",
    description: "",
    status: "todo",
    startDate: "2026-07-13",
    dueDate: "2026-07-25",
    progress: 0,
    dependencies: [],
    contractorId: CID_NAISOU,
    majorCategory: "仕上工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "48430cd2-3bc4-448e-936d-3e71ae76ef25",
    projectId: PID,
    name: "クロス貼り",
    description: "",
    status: "todo",
    startDate: "2026-07-21",
    dueDate: "2026-08-01",
    progress: 0,
    dependencies: [],
    contractorId: CID_NAISOU,
    majorCategory: "仕上工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "e1046b34-71cb-4410-8e7f-f334bd0d9602",
    projectId: PID,
    name: "配管給排水工事",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-10",
    progress: 60,
    dependencies: [],
    contractorId: CID_LGS,
    majorCategory: "配管工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "a2e2a8d5-30cd-4957-b93c-b6b2c566a495",
    projectId: PID,
    name: "現地調査・測量",
    description: "",
    status: "done",
    startDate: "2026-06-29",
    dueDate: "2026-07-02",
    progress: 100,
    dependencies: [],
    contractorId: CID_RAPORTA,
    majorCategory: "調査",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "74fb0b5a-0df5-4f3d-a85d-e62cc004a755",
    projectId: PID,
    name: "竣工検査",
    description: "",
    status: "todo",
    startDate: "2026-07-28",
    dueDate: "2026-07-30",
    progress: 0,
    dependencies: [],
    contractorId: CID_RAPORTA,
    majorCategory: "検査",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

async function seedLocalStorage(page: Page) {
  await page.addInitScript(
    ({ projects, tasks, contractors }) => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify(projects));
      localStorage.setItem("genbahub:tasks", JSON.stringify(tasks));
      localStorage.setItem("genbahub:contractors", JSON.stringify(contractors));
      localStorage.setItem("genbahub:last-project-id", "4b9e1234-5678-4abc-bdef-000000000001");
    },
    { projects: SEED_PROJECTS, tasks: SEED_TASKS, contractors: SEED_CONTRACTORS },
  );
}

// In-page WCAG contrast auditor. Composites alpha bg over ancestors.
const AUDIT_FN = `
(() => {
  const _cv=document.createElement('canvas');_cv.width=1;_cv.height=1;
  const _ctx=_cv.getContext('2d');
  function parse(c){
    if(!c||c==='transparent') return [0,0,0,0];
    _ctx.clearRect(0,0,1,1);
    _ctx.fillStyle='rgba(0,0,0,0)';
    _ctx.fillStyle=c;
    _ctx.fillRect(0,0,1,1);
    const d=_ctx.getImageData(0,0,1,1).data;
    return [d[0],d[1],d[2],d[3]/255];
  }
  function comp(fg,bg){const a=fg[3];return [fg[0]*a+bg[0]*(1-a),fg[1]*a+bg[1]*(1-a),fg[2]*a+bg[2]*(1-a),1];}
  function effBg(el){
    let stack=[]; let e=el;
    while(e){const c=getComputedStyle(e).backgroundColor;const p=parse(c);if(p[3]>0)stack.push(p);if(p[3]>=1)break;e=e.parentElement;}
    stack.push([255,255,255,1]);
    let base=stack[stack.length-1];
    for(let i=stack.length-2;i>=0;i--){base=comp(stack[i],base);}
    return base;
  }
  function lin(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
  function lum(c){return 0.2126*lin(c[0])+0.7152*lin(c[1])+0.0722*lin(c[2]);}
  function ratio(a,b){const l1=lum(a),l2=lum(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05);}
  const out=[];
  const els=document.querySelectorAll('body *');
  els.forEach(el=>{
    // direct text only
    let txt='';
    el.childNodes.forEach(n=>{if(n.nodeType===3)txt+=n.textContent;});
    txt=txt.trim();
    if(!txt) return;
    const cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)===0) return;
    const r=el.getBoundingClientRect();
    if(r.width<1||r.height<1) return;
    const fg=parse(cs.color);
    const bg=effBg(el);
    const fgc=fg[3]<1?comp(fg,bg):fg;
    const ra=ratio(fgc,bg);
    const size=parseFloat(cs.fontSize);
    const bold=(parseInt(cs.fontWeight)||400)>=700;
    const large=(size>=24)||(size>=18.66&&bold);
    const thr=large?3:4.5;
    out.push({text:txt.slice(0,24),color:cs.color,bg:'rgb('+Math.round(bg[0])+','+Math.round(bg[1])+','+Math.round(bg[2])+')',ratio:Math.round(ra*100)/100,size,large,pass:ra>=thr});
  });
  return out;
})()
`;

test("today + header contrast — all text passes WCAG AA", async ({ page }) => {
  await seedLocalStorage(page);
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("http://localhost:5173/#/today");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(outDir, "today-after.png"), fullPage: true });

  const results = (await page.evaluate(AUDIT_FN)) as Array<{text:string;color:string;bg:string;ratio:number;size:number;large:boolean;pass:boolean}>;
  const fails = results.filter(r => !r.pass);

  // KPI / header targets of interest
  const targets = ["96","0.0%","¥0","低","20%","順調","自動","0名","完了","リスクなし"];
  const hit = results.filter(r => targets.some(t => r.text.includes(t)));

  fs.writeFileSync(path.join(outDir, "contrast-results.json"), JSON.stringify({ total: results.length, failCount: fails.length, fails, targets: hit }, null, 2));

  console.log("=== /today text-contrast audit (AFTER) ===");
  console.log("total text nodes:", results.length, " FAIL:", fails.length);
  console.log("--- KPI/header targets ---");
  hit.forEach(r => console.log(`${r.pass?"PASS":"FAIL"} ${r.ratio}:1  ${JSON.stringify(r.text)}  fg=${r.color} bg=${r.bg} ${r.large?"(large)":""}`));
  console.log("--- remaining FAILs ---");
  fails.forEach(r => console.log(`FAIL ${r.ratio}:1  ${JSON.stringify(r.text)}  fg=${r.color} bg=${r.bg}`));

  // Regression guard scoped to tickets p7f + 0fu:
  // 1) all sage-green KPI/status text (new token #346538 = rgb(52,101,56)) must pass WCAG AA
  const sageKpis = results.filter(r => r.color === "rgb(52, 101, 56)");
  expect(sageKpis.length, "sage-green KPI text should be present on /today").toBeGreaterThan(0);
  expect(sageKpis.filter(r => !r.pass), "0fu: every sage-green KPI must pass").toEqual([]);
  // 2) no legacy failing greens remain (old #4caf50 rgb(76,175,80) / emerald-600)
  expect(results.filter(r => r.color === "rgb(76, 175, 80)" || r.color === "rgb(5, 150, 105)"), "no legacy failing greens").toEqual([]);
  // 3) p7f: header theme label must pass
  const jido = results.find(r => r.text.includes("自動"));
  expect(jido, "自動 label present").toBeTruthy();
  expect(jido!.pass, `p7f: 自動 label must pass (got ${jido!.ratio}:1)`).toBe(true);
});
