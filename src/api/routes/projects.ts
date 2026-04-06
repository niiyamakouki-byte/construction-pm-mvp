import { parseScheduleImportFile } from "../schedule-importer.js";
import { requireMultipartFile } from "../http.js";
import { requireExistingProject } from "../route-helpers.js";
import {
  calculateCostSummary,
  calculateProjectProgress,
  serializeProject,
  serializeTask,
} from "../serialization.js";
import { created, html, noContent, ok } from "../responses.js";
import {
  ApiError,
  type ApiChangeOrderRecord,
  type ApiMaterialRecord,
  type ApiProjectRecord,
  type ApiRouteHandler,
  type ApiTaskRecord,
} from "../types.js";
import {
  assertDateOrder,
  assertProjectStatusTransition,
  validateCreateProjectInput,
  validateUpdateProjectInput,
} from "../validation.js";

function createTaskCountsByProjectId(projectIds: string[], taskProjectIds: string[]): Map<string, number> {
  const counts = new Map(projectIds.map((projectId) => [projectId, 0]));

  for (const projectId of taskProjectIds) {
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
  }

  return counts;
}

const projectStatusLabels = {
  planning: "計画中",
  active: "進行中",
  completed: "完了",
} as const;

const materialStatusLabels = {
  ordered: "発注済み",
  delivered: "納品済み",
  installed: "使用済み",
} as const;

const changeOrderStatusLabels = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
} as const;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: string | undefined | null): string {
  return value ? escapeHtml(value) : "未設定";
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function createPrintableDocument(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f5f1e8;color:#1f2933;font-family:'Hiragino Sans','Yu Gothic',sans-serif;">
    <div style="max-width:960px;margin:0 auto;padding:32px 24px 48px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:24px;">
        <div>
          <div style="font-size:12px;letter-spacing:0.12em;color:#7c5e10;text-transform:uppercase;">GenbaHub Export</div>
          <h1 style="margin:8px 0 0;font-size:30px;line-height:1.2;">${escapeHtml(title)}</h1>
        </div>
        <div style="font-size:12px;color:#52606d;text-align:right;">
          <div>ブラウザの印刷機能でPDF保存できます</div>
          <div>出力日時: ${escapeHtml(new Date().toLocaleString("ja-JP"))}</div>
        </div>
      </div>
      ${content}
    </div>
  </body>
</html>`;
}

function renderDefinitionGrid(items: Array<{ label: string; value: string }>): string {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px;">
    ${items
      .map(
        ({ label, value }) => `<div style="background:#fff;border:1px solid #d9d3c7;border-radius:12px;padding:14px 16px;">
            <div style="font-size:12px;color:#7b8794;margin-bottom:6px;">${escapeHtml(label)}</div>
            <div style="font-size:15px;font-weight:600;">${value}</div>
          </div>`,
      )
      .join("")}
  </div>`;
}

function renderTable(
  title: string,
  headers: string[],
  rows: string[],
  emptyMessage: string,
  note?: string,
): string {
  return `<section style="margin-bottom:24px;">
    <h2 style="margin:0 0 12px;font-size:20px;">${escapeHtml(title)}</h2>
    ${
      note
        ? `<p style="margin:0 0 12px;font-size:12px;color:#52606d;">${escapeHtml(note)}</p>`
        : ""
    }
    <div style="background:#fff;border:1px solid #d9d3c7;border-radius:14px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f0e7d6;text-align:left;">
            ${headers
              .map(
                (header) =>
                  `<th style="padding:12px 14px;border-bottom:1px solid #d9d3c7;">${escapeHtml(header)}</th>`,
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${
            rows.length > 0
              ? rows.join("")
              : `<tr><td colspan="${headers.length}" style="padding:20px 14px;color:#7b8794;">${escapeHtml(
                  emptyMessage,
                )}</td></tr>`
          }
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderScheduleHtml(project: ApiProjectRecord, tasks: ApiTaskRecord[]): string {
  const sortedTasks = [...tasks].sort((left, right) => {
    const leftDate = left.startDate ?? left.dueDate ?? "";
    const rightDate = right.startDate ?? right.dueDate ?? "";
    return leftDate.localeCompare(rightDate) || left.name.localeCompare(right.name, "ja");
  });

  const content = [
    renderDefinitionGrid([
      { label: "案件名", value: escapeHtml(project.name) },
      { label: "元請会社", value: escapeHtml(project.contractor) },
      { label: "住所", value: escapeHtml(project.address) },
      { label: "ステータス", value: projectStatusLabels[project.status] },
      { label: "開始日", value: formatDate(project.startDate) },
      { label: "終了日", value: formatDate(project.endDate) },
    ]),
    renderTable(
      "工程一覧",
      ["タスク名", "開始日", "終了日", "担当業者", "進捗"],
      sortedTasks.map(
        (task) => `<tr>
            <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(task.name)}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${formatDate(task.startDate)}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${formatDate(task.dueDate)}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${escapeHtml(task.contractor ?? "未設定")}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:120px;height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
                  <div style="width:${Math.max(0, Math.min(task.progress, 100))}%;height:100%;background:#2d6a4f;"></div>
                </div>
                <span>${escapeHtml(formatPercent(task.progress))}</span>
              </div>
            </td>
          </tr>`,
      ),
      "タスクが登録されていません。",
      "簡易HTML版の工程表です。ブラウザ印刷からPDF化できます。",
    ),
  ].join("");

  return createPrintableDocument(`${project.name} 工程表`, content);
}

function renderCostReportHtml(
  project: ApiProjectRecord,
  tasks: ApiTaskRecord[],
  materials: ApiMaterialRecord[],
  changeOrders: ApiChangeOrderRecord[],
): string {
  const summary = calculateCostSummary(tasks, materials, changeOrders);
  const subtotal = summary.totalCost;
  const tax = Math.round(subtotal * 0.1);
  const grandTotal = subtotal + tax;

  const content = [
    renderDefinitionGrid([
      { label: "案件名", value: escapeHtml(project.name) },
      { label: "元請会社", value: escapeHtml(project.contractor) },
      { label: "住所", value: escapeHtml(project.address) },
      { label: "ステータス", value: projectStatusLabels[project.status] },
      { label: "工期開始", value: formatDate(project.startDate) },
      { label: "工期終了", value: formatDate(project.endDate) },
    ]),
    renderTable(
      "タスク原価一覧",
      ["タスク名", "開始日", "終了日", "担当業者", "進捗", "原価"],
      [...tasks]
        .sort((left, right) => (left.startDate ?? "").localeCompare(right.startDate ?? ""))
        .map(
          (task) => `<tr>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(task.name)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${formatDate(task.startDate)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${formatDate(task.dueDate)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${escapeHtml(task.contractor ?? "未設定")}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatPercent(task.progress))}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(task.cost))}</td>
            </tr>`,
        ),
      "タスク原価はありません。",
    ),
    renderTable(
      "資材原価一覧",
      ["資材名", "数量", "単価", "仕入先", "納品日", "状態", "金額"],
      [...materials]
        .sort((left, right) => left.deliveryDate.localeCompare(right.deliveryDate))
        .map((material) => {
          const totalCost = material.quantity * material.unitPrice;
          return `<tr>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(material.name)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${escapeHtml(`${material.quantity}${material.unit}`)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(material.unitPrice))}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${escapeHtml(material.supplier)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${formatDate(material.deliveryDate)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${materialStatusLabels[material.status]}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(totalCost))}</td>
            </tr>`;
        }),
      "資材原価はありません。",
    ),
    renderTable(
      "変更指示一覧",
      ["内容", "日付", "承認者", "状態", "金額"],
      [...changeOrders]
        .sort((left, right) => left.date.localeCompare(right.date))
        .map(
          (changeOrder) => `<tr>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(changeOrder.description)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${formatDate(changeOrder.date)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${escapeHtml(changeOrder.approvedBy)}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${changeOrderStatusLabels[changeOrder.status]}</td>
              <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(changeOrder.amount))}</td>
            </tr>`,
        ),
      "変更指示はありません。",
      "小計には承認済みの変更指示のみ含めています。",
    ),
    `<section style="background:#fff;border:1px solid #d9d3c7;border-radius:14px;padding:20px;">
      <h2 style="margin:0 0 12px;font-size:20px;">集計</h2>
      <div style="display:grid;gap:10px;font-size:14px;">
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:10px;"><span>タスク原価合計</span><strong>${escapeHtml(formatCurrency(summary.taskCost))}</strong></div>
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:10px;"><span>資材原価合計</span><strong>${escapeHtml(formatCurrency(summary.materialCost))}</strong></div>
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:10px;"><span>承認済み変更指示合計</span><strong>${escapeHtml(formatCurrency(summary.approvedChangeOrderCost))}</strong></div>
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:10px;"><span>小計</span><strong>${escapeHtml(formatCurrency(subtotal))}</strong></div>
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:10px;"><span>消費税（10%）</span><strong>${escapeHtml(formatCurrency(tax))}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:20px;"><span>総合計</span><strong>${escapeHtml(formatCurrency(grandTotal))}</strong></div>
      </div>
    </section>`,
  ].join("");

  return createPrintableDocument(`${project.name} 原価集計レポート`, content);
}

export const handleProjectsRoutes: ApiRouteHandler = async ({ pathname, request, store, url }) => {
  if (request.method === "GET" && pathname === "/api/projects") {
    const search = url.searchParams.get("search")?.trim();
    const [projects, tasks] = await Promise.all([store.listProjects(), store.listAllTasks()]);
    const filteredProjects = projects.filter((project) => (search ? project.name.includes(search) : true));
    const taskCounts = createTaskCountsByProjectId(
      filteredProjects.map((project) => project.id),
      tasks.map((task) => task.projectId),
    );

    return ok({
      projects: filteredProjects.map((project) => serializeProject(project, taskCounts.get(project.id) ?? 0)),
    });
  }

  if (request.method === "POST" && pathname === "/api/projects") {
    const input = validateCreateProjectInput(request.body ?? {});
    const project = await store.createProject(input);
    return created({
      project: serializeProject(project),
    });
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);

    if (request.method === "GET") {
      const project = await requireExistingProject(store, projectId);
      return ok({
        project: serializeProject(project),
      });
    }

    if (request.method === "PATCH") {
      const existing = await requireExistingProject(store, projectId);
      const input = validateUpdateProjectInput(request.body ?? {});

      if (input.status !== undefined) {
        assertProjectStatusTransition(existing.status, input.status);
      }

      const nextStartDate = input.startDate ?? existing.startDate;
      const nextEndDate =
        input.endDate === undefined ? existing.endDate : (input.endDate ?? undefined);
      if (nextEndDate) {
        assertDateOrder(nextStartDate, nextEndDate);
      }

      const project = await store.updateProject(projectId, input);
      if (!project) {
        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
      }

      return ok({
        project: serializeProject(project),
      });
    }

    if (request.method === "DELETE") {
      const deleted = await store.deleteProject(projectId);
      if (!deleted) {
        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
      }
      return noContent();
    }
  }

  const projectProgressMatch = pathname.match(/^\/api\/projects\/([^/]+)\/progress$/);
  if (request.method === "GET" && projectProgressMatch) {
    const projectId = decodeURIComponent(projectProgressMatch[1]);
    await requireExistingProject(store, projectId);
    const tasks = await store.listTasks(projectId);
    return ok({
      projectId,
      overallProgress: calculateProjectProgress(tasks),
      taskCount: tasks.length,
    });
  }

  const projectSchedulePdfMatch = pathname.match(/^\/api\/projects\/([^/]+)\/schedule-pdf$/);
  if (request.method === "GET" && projectSchedulePdfMatch) {
    const projectId = decodeURIComponent(projectSchedulePdfMatch[1]);
    const project = await requireExistingProject(store, projectId);
    const tasks = await store.listTasks(projectId);
    return html(renderScheduleHtml(project, tasks));
  }

  const projectCostSummaryMatch = pathname.match(/^\/api\/projects\/([^/]+)\/cost-summary$/);
  if (request.method === "GET" && projectCostSummaryMatch) {
    const projectId = decodeURIComponent(projectCostSummaryMatch[1]);
    await requireExistingProject(store, projectId);
    const [tasks, materials, changeOrders] = await Promise.all([
      store.listTasks(projectId),
      store.listMaterials(projectId),
      store.listChangeOrders(projectId),
    ]);

    return ok({
      projectId,
      ...calculateCostSummary(tasks, materials, changeOrders),
    });
  }

  const projectCostReportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/cost-report$/);
  if (request.method === "GET" && projectCostReportMatch) {
    const projectId = decodeURIComponent(projectCostReportMatch[1]);
    const project = await requireExistingProject(store, projectId);
    const [tasks, materials, changeOrders] = await Promise.all([
      store.listTasks(projectId),
      store.listMaterials(projectId),
      store.listChangeOrders(projectId),
    ]);
    return html(renderCostReportHtml(project, tasks, materials, changeOrders));
  }

  const projectImportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/import$/);
  if (request.method === "POST" && projectImportMatch) {
    const projectId = decodeURIComponent(projectImportMatch[1]);
    await requireExistingProject(store, projectId);

    const uploadedFile = requireMultipartFile(request.body ?? {});
    const importedTasks = parseScheduleImportFile({
      buffer: uploadedFile.buffer,
      filename: uploadedFile.filename,
    });

    const createdTasks = await Promise.all(
      importedTasks.map((task) =>
        store.createTask(projectId, {
          name: task.name,
          startDate: task.startDate,
          endDate: task.endDate,
          contractor: task.contractor,
          description: task.description ?? "",
        }),
      ),
    );

    return created({
      tasks: createdTasks.map(serializeTask),
    });
  }

  return null;
};
