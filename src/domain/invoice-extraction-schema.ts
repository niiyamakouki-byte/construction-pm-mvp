/**
 * 請求書抽出スキーマ — Claude Vision が JSON 形式で返す抽出結果を検証する。
 *
 * OCR 結果は未知のソースからの入力（ユーザーのアップロード画像を Vision が解釈したもの）なので、
 * 新規データパス扱いで parseOrThrow を使って厳密に検証する。
 */

import { z } from "zod";

/**
 * YYYY-MM-DD 形式。Vision が別形式や null を返すケースに備えて optional.nullable。
 * 空文字や null は undefined に正規化する。
 */
const dateField = z
  .union([
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で返してください")
      .refine((val) => !isNaN(Date.parse(val)), { message: "有効な日付ではありません" }),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((val) => (val == null || val === "" ? undefined : val));

const amountField = z
  .union([z.number().finite().nonnegative(), z.null()])
  .optional()
  .transform((val) => (val == null ? undefined : val));

export const InvoiceLineItemSchema = z.object({
  description: z.string().default(""),
  quantity: amountField,
  unit_price: amountField,
  amount: amountField,
});

export const InvoiceExtractionSchema = z.object({
  vendor: z
    .union([z.string(), z.null()])
    .optional()
    .transform((val) => (val == null ? "" : val)),
  invoice_number: z
    .union([z.string(), z.null()])
    .optional()
    .transform((val) => (val == null ? "" : val)),
  issue_date: dateField,
  due_date: dateField,
  items: z.array(InvoiceLineItemSchema).default([]),
  subtotal: amountField,
  tax: amountField,
  total: amountField,
});

export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;
export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;
