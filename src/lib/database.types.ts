
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "actor_id": string | null,"amount": number | null,"created_at": string,"id": string,"meta": NonNullable<Json>,"org_id": string,"subject_client_id": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"amount"?: number | null,"created_at"?: string,"id"?: string,"meta"?: NonNullable<Json>,"org_id": string,"subject_client_id"?: string | null,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"amount"?: number | null,"created_at"?: string,"id"?: string,"meta"?: NonNullable<Json>,"org_id"?: string,"subject_client_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_subject_client_id_fkey"
      columns: ["subject_client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"bizqwik_team": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"invited_by": string | null,"name": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id": string,"invited_by"?: string | null,"name": string,"role": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"invited_by"?: string | null,"name"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bizqwik_team_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "bizqwik_team"
      referencedColumns: ["id"]
    }
                  ]
                },"bizqwik_team_invitations": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"invited_by": string | null,"name": string | null,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"invited_by"?: string | null,"name"?: string | null,"role": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"invited_by"?: string | null,"name"?: string | null,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bundle_types": {
                  Row: {
                    "active": boolean,"category": string | null,"created_at": string,"expiry_days": number,"id": string,"location_id": string | null,"name": string,"org_id": string,"price": number,"sessions_included": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category"?: string | null,"created_at"?: string,"expiry_days": number,"id"?: string,"location_id"?: string | null,"name": string,"org_id": string,"price": number,"sessions_included": number
                  }
                  Update: {
                    "active"?: boolean,"category"?: string | null,"created_at"?: string,"expiry_days"?: number,"id"?: string,"location_id"?: string | null,"name"?: string,"org_id"?: string,"price"?: number,"sessions_included"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bundle_types_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bundle_types_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"check_ins": {
                  Row: {
                    "checked_in_at": string,"client_id": string,"group_plan_id": string | null,"id": string,"org_id": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_in_at"?: string,"client_id": string,"group_plan_id"?: string | null,"id"?: string,"org_id": string,"source": string
                  }
                  Update: {
                    "checked_in_at"?: string,"client_id"?: string,"group_plan_id"?: string | null,"id"?: string,"org_id"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "check_ins_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_group_plan_id_fkey"
      columns: ["group_plan_id"]
isOneToOne: false
      referencedRelation: "group_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"class_bookings": {
                  Row: {
                    "attendance": string,"booked_at": string,"class_id": string,"client_id": string,"coverage": string,"credit_spent": boolean,"drop_in_id": string | null,"group_plan_id": string | null,"id": string,"org_id": string,"pay_method": string,"pay_status": string,"price_egp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance"?: string,"booked_at"?: string,"class_id": string,"client_id": string,"coverage"?: string,"credit_spent"?: boolean,"drop_in_id"?: string | null,"group_plan_id"?: string | null,"id"?: string,"org_id": string,"pay_method": string,"pay_status"?: string,"price_egp": number
                  }
                  Update: {
                    "attendance"?: string,"booked_at"?: string,"class_id"?: string,"client_id"?: string,"coverage"?: string,"credit_spent"?: boolean,"drop_in_id"?: string | null,"group_plan_id"?: string | null,"id"?: string,"org_id"?: string,"pay_method"?: string,"pay_status"?: string,"price_egp"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_bookings_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_drop_in_id_fkey"
      columns: ["drop_in_id"]
isOneToOne: false
      referencedRelation: "drop_ins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_group_plan_id_fkey"
      columns: ["group_plan_id"]
isOneToOne: false
      referencedRelation: "group_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"class_rsvps": {
                  Row: {
                    "class_id": string,"client_id": string,"created_at": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"client_id": string,"created_at"?: string,"org_id": string
                  }
                  Update: {
                    "class_id"?: string,"client_id"?: string,"created_at"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_rsvps_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_rsvps_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_rsvps_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"class_series": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"drop_in_price": number,"duration_min": number,"generated_until": string | null,"id": string,"image_url": string | null,"location_id": string | null,"monthly_price": number,"org_id": string,"start_time": string,"status": string,"title": string,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"drop_in_price": number,"duration_min"?: number,"generated_until"?: string | null,"id"?: string,"image_url"?: string | null,"location_id"?: string | null,"monthly_price": number,"org_id": string,"start_time": string,"status"?: string,"title": string,"weekdays": (number)[]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"drop_in_price"?: number,"duration_min"?: number,"generated_until"?: string | null,"id"?: string,"image_url"?: string | null,"location_id"?: string | null,"monthly_price"?: number,"org_id"?: string,"start_time"?: string,"status"?: string,"title"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_series_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_series_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_series_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"id": string,"image_url": string | null,"location_id": string | null,"org_id": string,"price_egp": number,"series_id": string | null,"starts_at": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"image_url"?: string | null,"location_id"?: string | null,"org_id": string,"price_egp"?: number,"series_id"?: string | null,"starts_at": string,"status"?: string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"image_url"?: string | null,"location_id"?: string | null,"org_id"?: string,"price_egp"?: number,"series_id"?: string | null,"starts_at"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "classes_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "classes_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "classes_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "class_series"
      referencedColumns: ["id"]
    }
                  ]
                },"client_invitations": {
                  Row: {
                    "client_id": string,"created_at": string,"email": string,"id": string,"invited_by": string | null,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"email": string,"id"?: string,"invited_by"?: string | null,"org_id": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"email"?: string,"id"?: string,"invited_by"?: string | null,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_invitations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"client_notes": {
                  Row: {
                    "client_id": string,"conditions": string | null,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"conditions"?: string | null,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"conditions"?: string | null,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"client_notifications": {
                  Row: {
                    "body": string,"client_id": string,"created_at": string,"id": string,"org_id": string,"read_at": string | null,"ref": string | null,"title": string,"type": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"client_id": string,"created_at"?: string,"id"?: string,"org_id": string,"read_at"?: string | null,"ref"?: string | null,"title": string,"type": string,"url"?: string | null
                  }
                  Update: {
                    "body"?: string,"client_id"?: string,"created_at"?: string,"id"?: string,"org_id"?: string,"read_at"?: string | null,"ref"?: string | null,"title"?: string,"type"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_notifications_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notifications_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"client_push_subscriptions": {
                  Row: {
                    "auth": string,"client_id": string,"created_at": string,"endpoint": string,"id": string,"org_id": string,"p256dh": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"client_id": string,"created_at"?: string,"endpoint": string,"id": string,"org_id": string,"p256dh": string,"updated_at"?: string
                  }
                  Update: {
                    "auth"?: string,"client_id"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"org_id"?: string,"p256dh"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_push_subscriptions_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_push_subscriptions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "age": number | null,"assigned_coach_id": string | null,"auth_user_id": string | null,"created_at": string,"email": string | null,"home_location_id": string | null,"id": string,"name": string,"org_id": string,"phone": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "age"?: number | null,"assigned_coach_id"?: string | null,"auth_user_id"?: string | null,"created_at"?: string,"email"?: string | null,"home_location_id"?: string | null,"id"?: string,"name": string,"org_id": string,"phone"?: string | null,"status"?: string
                  }
                  Update: {
                    "age"?: number | null,"assigned_coach_id"?: string | null,"auth_user_id"?: string | null,"created_at"?: string,"email"?: string | null,"home_location_id"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"phone"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_assigned_coach_id_fkey"
      columns: ["assigned_coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_home_location_id_fkey"
      columns: ["home_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_logs": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"logged_by": string,"org_id": string,"package_instance_id": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"logged_by": string,"org_id": string,"package_instance_id": string,"source"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"logged_by"?: string,"org_id"?: string,"package_instance_id"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_logs_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_logs_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_logs_package_instance_id_fkey"
      columns: ["package_instance_id"]
isOneToOne: false
      referencedRelation: "package_instances"
      referencedColumns: ["id"]
    }
                  ]
                },"drop_ins": {
                  Row: {
                    "category": string | null,"class_id": string | null,"client_id": string | null,"created_at": string,"id": string,"org_id": string,"pay_method": string | null,"price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"class_id"?: string | null,"client_id"?: string | null,"created_at"?: string,"id"?: string,"org_id": string,"pay_method"?: string | null,"price": number
                  }
                  Update: {
                    "category"?: string | null,"class_id"?: string | null,"client_id"?: string | null,"created_at"?: string,"id"?: string,"org_id"?: string,"pay_method"?: string | null,"price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "drop_ins_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "drop_ins_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "drop_ins_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"is_default": boolean,"name": string,"org_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"is_default"?: boolean,"name": string,"org_id": string,"sort_order"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"org_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_categories_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category_id": string,"created_at": string,"created_by": string,"deleted_at": string | null,"department_id": string | null,"expense_date": string,"id": string,"location_id": string | null,"note": string | null,"org_id": string,"receipt_path": string | null,"recurring_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category_id": string,"created_at"?: string,"created_by": string,"deleted_at"?: string | null,"department_id"?: string | null,"expense_date": string,"id"?: string,"location_id"?: string | null,"note"?: string | null,"org_id": string,"receipt_path"?: string | null,"recurring_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"category_id"?: string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"department_id"?: string | null,"expense_date"?: string,"id"?: string,"location_id"?: string | null,"note"?: string | null,"org_id"?: string,"receipt_path"?: string | null,"recurring_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_recurring_id_fkey"
      columns: ["recurring_id"]
isOneToOne: false
      referencedRelation: "recurring_expenses"
      referencedColumns: ["id"]
    }
                  ]
                },"group_plan_types": {
                  Row: {
                    "active": boolean,"created_at": string,"credits": number | null,"duration_months": number,"id": string,"invitations_allowance": number,"kind": string,"location_id": string | null,"name": string,"org_id": string,"price": number,"shared_seats": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"credits"?: number | null,"duration_months": number,"id"?: string,"invitations_allowance"?: number,"kind": string,"location_id"?: string | null,"name": string,"org_id": string,"price": number,"shared_seats"?: number | null
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"credits"?: number | null,"duration_months"?: number,"id"?: string,"invitations_allowance"?: number,"kind"?: string,"location_id"?: string | null,"name"?: string,"org_id"?: string,"price"?: number,"shared_seats"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_plan_types_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_plan_types_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"group_plans": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"credits_remaining": number | null,"credits_total": number | null,"expires_at": string,"freeze_days": number,"freeze_used": boolean,"frozen_from": string | null,"frozen_until": string | null,"id": string,"invitations_remaining": number,"kind": string,"location_id": string | null,"name": string,"org_id": string,"pay_method": string,"plan_type_id": string | null,"price_at_sale": number,"series_id": string | null,"share_group_id": string | null,"starts_at": string,"status": string,"thaw_notified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"credits_remaining"?: number | null,"credits_total"?: number | null,"expires_at": string,"freeze_days"?: number,"freeze_used"?: boolean,"frozen_from"?: string | null,"frozen_until"?: string | null,"id"?: string,"invitations_remaining"?: number,"kind": string,"location_id"?: string | null,"name": string,"org_id": string,"pay_method": string,"plan_type_id"?: string | null,"price_at_sale": number,"series_id"?: string | null,"share_group_id"?: string | null,"starts_at"?: string,"status"?: string,"thaw_notified"?: boolean
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"credits_remaining"?: number | null,"credits_total"?: number | null,"expires_at"?: string,"freeze_days"?: number,"freeze_used"?: boolean,"frozen_from"?: string | null,"frozen_until"?: string | null,"id"?: string,"invitations_remaining"?: number,"kind"?: string,"location_id"?: string | null,"name"?: string,"org_id"?: string,"pay_method"?: string,"plan_type_id"?: string | null,"price_at_sale"?: number,"series_id"?: string | null,"share_group_id"?: string | null,"starts_at"?: string,"status"?: string,"thaw_notified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_plans_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_plans_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_plans_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_plans_plan_type_id_fkey"
      columns: ["plan_type_id"]
isOneToOne: false
      referencedRelation: "group_plan_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_plans_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "class_series"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "created_at": string,"id": string,"invitee_name": string,"invitee_phone": string | null,"member_id": string,"org_id": string,"visit_date": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invitee_name": string,"invitee_phone"?: string | null,"member_id": string,"org_id": string,"visit_date"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invitee_name"?: string,"invitee_phone"?: string | null,"member_id"?: string,"org_id"?: string,"visit_date"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"kv_store_980e1cbf_archived_20260923": {
                  Row: {
                    "key": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"locations": {
                  Row: {
                    "created_at": string,"dropin_options": NonNullable<Json>,"dropin_price": number | null,"id": string,"name": string,"org_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dropin_options"?: NonNullable<Json>,"dropin_price"?: number | null,"id"?: string,"name": string,"org_id": string,"sort"?: number
                  }
                  Update: {
                    "created_at"?: string,"dropin_options"?: NonNullable<Json>,"dropin_price"?: number | null,"id"?: string,"name"?: string,"org_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"membership_instances": {
                  Row: {
                    "client_id": string,"created_at": string,"expires_at": string,"id": string,"invitations_remaining": number,"membership_type_id": string,"org_id": string,"starts_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"expires_at": string,"id"?: string,"invitations_remaining"?: number,"membership_type_id": string,"org_id": string,"starts_at": string,"status"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"expires_at"?: string,"id"?: string,"invitations_remaining"?: number,"membership_type_id"?: string,"org_id"?: string,"starts_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_instances_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_instances_membership_type_id_fkey"
      columns: ["membership_type_id"]
isOneToOne: false
      referencedRelation: "membership_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_instances_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"membership_types": {
                  Row: {
                    "created_at": string,"duration_days": number,"id": string,"invitations_allowance": number,"name": string,"org_id": string,"price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_days": number,"id"?: string,"invitations_allowance"?: number,"name": string,"org_id": string,"price": number
                  }
                  Update: {
                    "created_at"?: string,"duration_days"?: number,"id"?: string,"invitations_allowance"?: number,"name"?: string,"org_id"?: string,"price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_types_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_log": {
                  Row: {
                    "id": string,"org_id": string,"payload": NonNullable<Json>,"profile_id": string,"sent_at": string,"status": string,"trigger_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"org_id": string,"payload": NonNullable<Json>,"profile_id": string,"sent_at"?: string,"status": string,"trigger_type": string
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"payload"?: NonNullable<Json>,"profile_id"?: string,"sent_at"?: string,"status"?: string,"trigger_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_log_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"org_branding": {
                  Row: {
                    "app_name": string | null,"icon_url": string | null,"logo_url": string | null,"onboarding_assets": NonNullable<Json>,"org_id": string,"primary_color": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_name"?: string | null,"icon_url"?: string | null,"logo_url"?: string | null,"onboarding_assets"?: NonNullable<Json>,"org_id": string,"primary_color"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "app_name"?: string | null,"icon_url"?: string | null,"logo_url"?: string | null,"onboarding_assets"?: NonNullable<Json>,"org_id"?: string,"primary_color"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_branding_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_settings": {
                  Row: {
                    "org_id": string,"points_checkin": number,"points_earn_per_egp": number | null,"points_min_redeem": number,"points_redeem_per_egp": number,"points_ttl_months": number,"updated_at": string,"wallet_credit_ttl_months": number
                  }
                  ComputedFields: never
                  Insert: {
                    "org_id": string,"points_checkin"?: number,"points_earn_per_egp"?: number | null,"points_min_redeem"?: number,"points_redeem_per_egp"?: number,"points_ttl_months"?: number,"updated_at"?: string,"wallet_credit_ttl_months"?: number
                  }
                  Update: {
                    "org_id"?: string,"points_checkin"?: number,"points_earn_per_egp"?: number | null,"points_min_redeem"?: number,"points_redeem_per_egp"?: number,"points_ttl_months"?: number,"updated_at"?: string,"wallet_credit_ttl_months"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_settings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "brand_colors": Json | null,"coach_qr_token": string,"created_at": string,"created_by": string,"dropin_price": number | null,"id": string,"instapay_address": string | null,"instapay_qr": string | null,"logo_url": string | null,"mode": string,"name": string,"plan_id": string | null,"slug": string,"status": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_colors"?: Json | null,"coach_qr_token"?: string,"created_at"?: string,"created_by": string,"dropin_price"?: number | null,"id"?: string,"instapay_address"?: string | null,"instapay_qr"?: string | null,"logo_url"?: string | null,"mode"?: string,"name": string,"plan_id"?: string | null,"slug": string,"status"?: string,"timezone"?: string
                  }
                  Update: {
                    "brand_colors"?: Json | null,"coach_qr_token"?: string,"created_at"?: string,"created_by"?: string,"dropin_price"?: number | null,"id"?: string,"instapay_address"?: string | null,"instapay_qr"?: string | null,"logo_url"?: string | null,"mode"?: string,"name"?: string,"plan_id"?: string | null,"slug"?: string,"status"?: string,"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "bizqwik_team"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizations_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plan_types"
      referencedColumns: ["id"]
    }
                  ]
                },"package_instances": {
                  Row: {
                    "bundle_type_id": string,"client_id": string,"coach_cut_at_sale": number,"coach_id": string,"created_at": string,"created_by": string,"expires_at": string,"id": string,"location_id": string | null,"org_id": string,"pay_method": string | null,"price_at_sale": number,"purchased_at": string,"qr_token": string,"sessions_included": number,"sessions_remaining": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bundle_type_id": string,"client_id": string,"coach_cut_at_sale": number,"coach_id": string,"created_at"?: string,"created_by": string,"expires_at": string,"id"?: string,"location_id"?: string | null,"org_id": string,"pay_method"?: string | null,"price_at_sale": number,"purchased_at"?: string,"qr_token"?: string,"sessions_included": number,"sessions_remaining": number,"status"?: string
                  }
                  Update: {
                    "bundle_type_id"?: string,"client_id"?: string,"coach_cut_at_sale"?: number,"coach_id"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"id"?: string,"location_id"?: string | null,"org_id"?: string,"pay_method"?: string | null,"price_at_sale"?: number,"purchased_at"?: string,"qr_token"?: string,"sessions_included"?: number,"sessions_remaining"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "package_instances_bundle_type_id_fkey"
      columns: ["bundle_type_id"]
isOneToOne: false
      referencedRelation: "bundle_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "package_instances_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "package_instances_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "package_instances_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "package_instances_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "package_instances_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_requests": {
                  Row: {
                    "bundle_type_id": string | null,"client_id": string,"created_at": string,"id": string,"location_id": string | null,"name": string,"note": string | null,"offer_type": string,"org_id": string,"plan_type_id": string | null,"price": number,"proof_path": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bundle_type_id"?: string | null,"client_id": string,"created_at"?: string,"id"?: string,"location_id"?: string | null,"name": string,"note"?: string | null,"offer_type": string,"org_id": string,"plan_type_id"?: string | null,"price": number,"proof_path"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "bundle_type_id"?: string | null,"client_id"?: string,"created_at"?: string,"id"?: string,"location_id"?: string | null,"name"?: string,"note"?: string | null,"offer_type"?: string,"org_id"?: string,"plan_type_id"?: string | null,"price"?: number,"proof_path"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_requests_bundle_type_id_fkey"
      columns: ["bundle_type_id"]
isOneToOne: false
      referencedRelation: "bundle_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_requests_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_requests_plan_type_id_fkey"
      columns: ["plan_type_id"]
isOneToOne: false
      referencedRelation: "group_plan_types"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_types": {
                  Row: {
                    "client_size_limit": number | null,"created_at": string,"id": string,"name": string,"price": number,"team_size_limit": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_size_limit"?: number | null,"created_at"?: string,"id"?: string,"name": string,"price": number,"team_size_limit"?: number | null
                  }
                  Update: {
                    "client_size_limit"?: number | null,"created_at"?: string,"id"?: string,"name"?: string,"price"?: number,"team_size_limit"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"points_balances": {
                  Row: {
                    "client_id": string,"org_id": string,"tier": string,"total_points": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"org_id": string,"tier"?: string,"total_points"?: number,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"org_id"?: string,"tier"?: string,"total_points"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "points_balances_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "points_balances_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"points_ledger": {
                  Row: {
                    "client_id": string,"created_at": string,"expires_at": string | null,"id": string,"org_id": string,"points": number,"reason": string | null,"remaining": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"org_id": string,"points": number,"reason"?: string | null,"remaining"?: number | null
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"org_id"?: string,"points"?: number,"reason"?: string | null,"remaining"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "points_ledger_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "points_ledger_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string,"id": string,"name": string,"org_id": string,"phone": string | null,"role": Database["public"]['Enums']["app_role"],"tier_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email": string,"id": string,"name": string,"org_id": string,"phone"?: string | null,"role": Database["public"]['Enums']["app_role"],"tier_id"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string,"id"?: string,"name"?: string,"org_id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"tier_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_tier_id_fkey"
      columns: ["tier_id"]
isOneToOne: false
      referencedRelation: "tiers"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"device_label": string | null,"endpoint": string,"id": string,"org_id": string,"p256dh": string,"profile_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"device_label"?: string | null,"endpoint": string,"id": string,"org_id": string,"p256dh": string,"profile_id": string,"updated_at"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"device_label"?: string | null,"endpoint"?: string,"id"?: string,"org_id"?: string,"p256dh"?: string,"profile_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_subscriptions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recurring_expenses": {
                  Row: {
                    "active": boolean,"amount": number,"category_id": string,"created_at": string,"created_by": string,"day_of_month": number,"end_month": string | null,"id": string,"note": string | null,"org_id": string,"start_month": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"amount": number,"category_id": string,"created_at"?: string,"created_by": string,"day_of_month": number,"end_month"?: string | null,"id"?: string,"note"?: string | null,"org_id": string,"start_month": string
                  }
                  Update: {
                    "active"?: boolean,"amount"?: number,"category_id"?: string,"created_at"?: string,"created_by"?: string,"day_of_month"?: number,"end_month"?: string | null,"id"?: string,"note"?: string | null,"org_id"?: string,"start_month"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_expenses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_expenses_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "coach_id": string,"created_at": string,"created_by": string,"date": string,"id": string,"month": string,"org_id": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_id": string,"created_at"?: string,"created_by": string,"date": string,"id"?: string,"month": string,"org_id": string,"source"?: string
                  }
                  Update: {
                    "coach_id"?: string,"created_at"?: string,"created_by"?: string,"date"?: string,"id"?: string,"month"?: string,"org_id"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"settlement_payments": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"method": string,"note": string | null,"org_id": string,"paid_by": string | null,"paid_on": string,"settlement_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"method": string,"note"?: string | null,"org_id": string,"paid_by"?: string | null,"paid_on": string,"settlement_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"method"?: string,"note"?: string | null,"org_id"?: string,"paid_by"?: string | null,"paid_on"?: string,"settlement_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlement_payments_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlement_payments_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlement_payments_settlement_id_fkey"
      columns: ["settlement_id"]
isOneToOne: false
      referencedRelation: "settlements"
      referencedColumns: ["id"]
    }
                  ]
                },"settlements": {
                  Row: {
                    "coach_id": string,"count_snapshot": number,"created_at": string,"group_total": number | null,"id": string,"month": string,"org_id": string,"paid_at": string | null,"paid_by": string | null,"private_total": number,"rate_snapshot": number,"settled_at": string,"settled_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_id": string,"count_snapshot": number,"created_at"?: string,"group_total"?: never,"id"?: string,"month": string,"org_id": string,"paid_at"?: string | null,"paid_by"?: string | null,"private_total": number,"rate_snapshot": number,"settled_at"?: string,"settled_by": string
                  }
                  Update: {
                    "coach_id"?: string,"count_snapshot"?: number,"created_at"?: string,"group_total"?: never,"id"?: string,"month"?: string,"org_id"?: string,"paid_at"?: string | null,"paid_by"?: string | null,"private_total"?: number,"rate_snapshot"?: number,"settled_at"?: string,"settled_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_settled_by_fkey"
      columns: ["settled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_invitations": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"invited_by": string | null,"org_id": string,"role": Database["public"]['Enums']["app_role"],"tier_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"invited_by"?: string | null,"org_id": string,"role": Database["public"]['Enums']["app_role"],"tier_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"invited_by"?: string | null,"org_id"?: string,"role"?: Database["public"]['Enums']["app_role"],"tier_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_invitations_tier_id_fkey"
      columns: ["tier_id"]
isOneToOne: false
      referencedRelation: "tiers"
      referencedColumns: ["id"]
    }
                  ]
                },"tiers": {
                  Row: {
                    "created_at": string,"hourly_rate": number,"id": string,"name": string,"org_id": string,"private_cut_pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"hourly_rate": number,"id"?: string,"name": string,"org_id": string,"private_cut_pct"?: number
                  }
                  Update: {
                    "created_at"?: string,"hourly_rate"?: number,"id"?: string,"name"?: string,"org_id"?: string,"private_cut_pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tiers_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"wallet_transactions": {
                  Row: {
                    "amount": number,"category": string,"client_id": string,"created_at": string,"description": string | null,"expires_at": string | null,"id": string,"org_id": string,"remaining": number | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": string,"client_id": string,"created_at"?: string,"description"?: string | null,"expires_at"?: string | null,"id"?: string,"org_id": string,"remaining"?: number | null,"type": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"client_id"?: string,"created_at"?: string,"description"?: string | null,"expires_at"?: string | null,"id"?: string,"org_id"?: string,"remaining"?: number | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wallet_transactions_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wallet_transactions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"wallets": {
                  Row: {
                    "balance": number,"client_id": string,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "balance"?: number,"client_id": string,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "balance"?: number,"client_id"?: string,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wallets_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wallets_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"zz_test_kv": {
                  Row: {
                    "k": string,"v": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "k": string,"v"?: string | null
                  }
                  Update: {
                    "k"?: string,"v"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "auth_user_id_by_email":
{ Args: { "p_email": string }; Returns: string
                           },
"can_manage_client_notes":
{ Args: { "p_client_id": string,"p_org_id": string }; Returns: boolean
                           },
"delete_org":
{ Args: { "p_org": string }; Returns: (string)[]
                           },
"get_secret":
{ Args: { "secret_name": string }; Returns: string
                           },
"is_accounting_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_bizqwik_team":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_dept_head":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_client_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_client_org_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_org_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"record_settlement_payment":
{ Args: { "p_amount": number,"p_by": string,"p_method": string,"p_note": string,"p_org": string,"p_paid_on": string,"p_settlement": string }; Returns: {
              "paid_total": number,"payment_id": string,"remaining": number,"total": number
            }[]
                           },
"revenue_session_counts":
{ Args: { "p_months": (string)[],"p_org": string }; Returns: {
              "coach_id": string,"month": string,"n": number
            }[]
                           }
          }
          Enums: {
            "app_role": "dept_head"|"head_coach"|"coach"|"accountant"|"front_desk"|"client"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["dept_head", "head_coach", "coach", "accountant", "front_desk", "client"]
          }
        }
} as const
