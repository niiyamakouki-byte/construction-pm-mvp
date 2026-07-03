# 本番DB実スキーマ (iumymkvhrqwfexlthplm) 2026-07-04 04:45 JST

## 発見（監査の背景）
- Vercel本番envは `USE_SUPABASE`（VITE_プレフィックス無し）のみ → Viteバンドルに載らず `import.meta.env.VITE_USE_SUPABASE` は undefined
- よって `src/lib/supabase-adapter/` の23リポジトリは**本番で全部インメモリ動作**（実測: invoices/estimates/chat_messages/site_entry_records 全0件、projectsのみ4件=コア経路 `createAppRepository` は `hasSupabaseEnv()` 判定でDB接続済み）
- さらにコードとDBのカラム名乖離あり（例: SiteEntryRepository は company/entry_time/exit_time を期待、DB実体は company_name/entry_at/exit_at, entry_type, notes）

## public テーブル一覧と実カラム
| table | columns |
|---|---|
| api_rate_limits | user_id,endpoint,window_start,count,updated_at |
| change_requests | id,project_id,organization_id,title,description,requested_by,status,cost_impact,schedule_impact,approved_by,approved_at,created_at,updated_at |
| chat_messages | id,project_id,organization_id,room_id,sender_id,sender_name,body,message_type,created_at,updated_at |
| checkout_sessions | id,user_id,organization_id,plan,stripe_session_id,stripe_price_id,mode,status,amount_total,currency,created_at,updated_at |
| contractors | id,name,contact_person,phone,email,line_id,specialty,created_at,updated_at |
| cost_items | id,project_id,task_id,description,amount,category,created_at,updated_at,organization_id |
| customers | id,project_id,organization_id,name,company,email,phone,address,notes,status,created_at,updated_at |
| daily_reports | id,project_id,report_date,weather,content,photo_urls,author_id,created_at,updated_at,organization_id |
| deals | id,project_id,organization_id,customer_id,title,amount,stage,expected_close,notes,created_at,updated_at |
| document_versions | id,created_at,updated_at,document_id,project_id,name,type,url,uploaded_by,version |
| documents | id,created_at,updated_at,project_id,name,type,url,uploaded_by,version |
| drawing_pins | id,project_id,organization_id,drawing_url,label,pin_type,x_ratio,y_ratio,page_number,resolved,notes,created_at,updated_at |
| estimates | id,project_id,item_name,quantity,unit,unit_price,amount,category,created_at,updated_at,organization_id |
| execution_budgets | id,project_id,organization_id,category,planned_amount,committed_amount,actual_amount,freee_account_code,notes,created_at,updated_at |
| expenses | id,project_id,expense_date,description,amount,category,receipt_url,approval_status,created_at,updated_at,organization_id |
| freee_tokens | id,user_id,access_token,refresh_token,expires_at,company_id,scope,created_at,updated_at |
| invoices | id,project_id,organization_id,invoice_number,customer_id,status,issue_date,due_date,subtotal,tax_amount,total_amount,notes,created_at,updated_at |
| ky_activities | id,project_id,organization_id,activity_date,leader_name,hazards,countermeasures,target_zero,participants,created_at,updated_at |
| mood_boards | id,project_id,organization_id,title,description,items,created_at,updated_at |
| near_miss_reports | id,project_id,organization_id,occurred_at,location,description,cause,countermeasure,severity,reporter_name,created_at,updated_at |
| notifications | id,project_id,task_id,contractor_id,type,message,status,scheduled_at,sent_at,created_at,updated_at |
| organization_members | id,user_id,organization_id,role,created_at |
| organizations | id,name,plan,stripe_customer_id,stripe_subscription_id,plan_period_end,created_at,updated_at |
| photos | id,project_id,task_id,organization_id,storage_bucket,storage_path,url,file_name,content_type,file_size,category,caption,taken_at,uploader_id,created_at,updated_at,ai_category,ai_confidence,ai_subcategory,ai_tags,ai_location,ai_floor,ai_room |
| procurement_materials | id,project_id,organization_id,name,category,quantity,unit,status,due_date,created_at,updated_at |
| project_payment_plans | id,project_id,organization_id,milestone_label,scheduled_date,scheduled_amount,invoice_id,actual_paid_date,actual_amount,freee_deal_id,status,notes,created_at,updated_at |
| project_tasks | id,project_id,estimate_line_id,category,title,start_date,end_date,duration_days,depends_on,assignee_id,status,order_index,created_at,updated_at |
| projects | id,name,description,status,start_date,end_date,created_at,updated_at,address,budget,latitude,longitude,organization_id,include_weekends,mode |
| purchase_orders | id,project_id,organization_id,supplier_name,order_number,status,order_date,expected_date,total_amount,notes,created_at,updated_at,contractor_id,contractor_name,items,tax_amount,total_with_tax,delivery_date |
| resources | id,name,type,unit,created_at,updated_at,organization_id |
| safety_documents | id,project_id,organization_id,title,document_type,url,version,approved_by,approved_at,created_at,updated_at |
| selection_items | id,project_id,organization_id,category,item_name,description,options,selected_option,deadline,status,notes,created_at,updated_at |
| site_entry_records | id,project_id,organization_id,worker_name,company_name,entry_at,exit_at,entry_type,notes,created_at,updated_at |
| subscriptions | id,user_id,plan,stripe_customer_id,stripe_subscription_id,status,current_period_end,created_at,updated_at |
| tasks | id,project_id,name,description,status,assignee_id,due_date,created_at,updated_at,start_date,progress,dependencies,organization_id,contractor_id,materials,lead_time_days,canvas_x,canvas_y |
| team_members | id,name,role,email,phone,created_at,updated_at,organization_id |

## RLS要点
- ほぼ全テーブルに authenticated 向け ALL ポリシーあり（org members can manage ...）
- anon は contractors/notifications/procurement_materials のSELECTのみ。書込ポリシーはゼロ（QR入場のanon書込には別途ポリシー必要 = draft migration）
