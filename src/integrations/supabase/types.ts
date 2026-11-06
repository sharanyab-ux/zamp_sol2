export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      approved_vendors: {
        Row: {
          approved_at: string
          created_at: string
          id: string
          organisation_id: string
          profile: Json
          submission_id: string
          vendor_email: string
          vendor_name: string
        }
        Insert: {
          approved_at: string
          created_at?: string
          id?: string
          organisation_id: string
          profile: Json
          submission_id: string
          vendor_email: string
          vendor_name: string
        }
        Update: {
          approved_at?: string
          created_at?: string
          id?: string
          organisation_id?: string
          profile?: Json
          submission_id?: string
          vendor_email?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "approved_vendors_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_vendors_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          actor_label: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          organisation_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_label?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          organisation_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_label?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          field_key: string
          file_name: string
          id: string
          mime_type: string
          ocr_extracted: Json | null
          organisation_id: string
          size_bytes: number
          storage_path: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          field_key: string
          file_name: string
          id?: string
          mime_type: string
          ocr_extracted?: Json | null
          organisation_id: string
          size_bytes: number
          storage_path: string
          submission_id: string
        }
        Update: {
          created_at?: string
          field_key?: string
          file_name?: string
          id?: string
          mime_type?: string
          ocr_extracted?: Json | null
          organisation_id?: string
          size_bytes?: number
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_communications: {
        Row: {
          email_id: string | null
          email_to: string
          email_type: string
          id: string
          issues_hash: string | null
          link_token: string | null
          organisation_id: string
          sent_at: string
          submission_id: string
        }
        Insert: {
          email_id?: string | null
          email_to: string
          email_type: string
          id?: string
          issues_hash?: string | null
          link_token?: string | null
          organisation_id: string
          sent_at?: string
          submission_id: string
        }
        Update: {
          email_id?: string | null
          email_to?: string
          email_type?: string
          id?: string
          issues_hash?: string | null
          link_token?: string | null
          organisation_id?: string
          sent_at?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_communications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_communications_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          field_key: string
          form_id: string
          id: string
          input_type: string
          is_custom: boolean
          label: string
          position: number
          required: boolean
          section_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          field_key: string
          form_id: string
          id?: string
          input_type: string
          is_custom?: boolean
          label: string
          position?: number
          required?: boolean
          section_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          field_key?: string
          form_id?: string
          id?: string
          input_type?: string
          is_custom?: boolean
          label?: string
          position?: number
          required?: boolean
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      form_sections: {
        Row: {
          created_at: string
          form_id: string
          id: string
          is_custom: boolean
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          is_custom?: boolean
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          is_custom?: boolean
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_sections_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_versions: {
        Row: {
          form_id: string
          id: string
          organisation_id: string
          published_at: string
          snapshot: Json
          version: number
        }
        Insert: {
          form_id: string
          id?: string
          organisation_id: string
          published_at?: string
          snapshot: Json
          version: number
        }
        Update: {
          form_id?: string
          id?: string
          organisation_id?: string
          published_at?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_versions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          current_version: number
          description: string | null
          draft_version: number
          id: string
          name: string
          organisation_id: string
          status: Database["public"]["Enums"]["form_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version?: number
          description?: string | null
          draft_version?: number
          id?: string
          name: string
          organisation_id: string
          status?: Database["public"]["Enums"]["form_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version?: number
          description?: string | null
          draft_version?: number
          id?: string
          name?: string
          organisation_id?: string
          status?: Database["public"]["Enums"]["form_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          note: string | null
          organisation_id: string
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          note?: string | null
          organisation_id: string
          provider: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          note?: string | null
          organisation_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          draft_values: Json
          expires_at: string
          form_id: string
          form_version_id: string | null
          id: string
          last_email_id: string | null
          opened_at: string | null
          organisation_id: string
          resend_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          submitted_at: string | null
          token: string
          updated_at: string
          vendor_email: string
          vendor_name: string
        }
        Insert: {
          created_at?: string
          draft_values?: Json
          expires_at: string
          form_id: string
          form_version_id?: string | null
          id?: string
          last_email_id?: string | null
          opened_at?: string | null
          organisation_id: string
          resend_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          submitted_at?: string | null
          token: string
          updated_at?: string
          vendor_email: string
          vendor_name: string
        }
        Update: {
          created_at?: string
          draft_values?: Json
          expires_at?: string
          form_id?: string
          form_version_id?: string | null
          id?: string
          last_email_id?: string | null
          opened_at?: string | null
          organisation_id?: string
          resend_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          submitted_at?: string | null
          token?: string
          updated_at?: string
          vendor_email?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id?: string
          organisation_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          contact_email: string
          contact_person: string
          created_at: string
          created_by: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_person: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_person?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      submission_values: {
        Row: {
          field_key: string
          id: string
          submission_id: string
          value: Json | null
        }
        Insert: {
          field_key: string
          id?: string
          submission_id: string
          value?: Json | null
        }
        Update: {
          field_key?: string
          id?: string
          submission_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_values_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          form_id: string
          form_snapshot: Json
          form_version_id: string | null
          id: string
          invitation_id: string | null
          organisation_id: string
          reference_number: string
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          updated_at: string
          values_snapshot: Json
          vendor_email: string
          vendor_name: string
        }
        Insert: {
          form_id: string
          form_snapshot: Json
          form_version_id?: string | null
          id?: string
          invitation_id?: string | null
          organisation_id: string
          reference_number: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          updated_at?: string
          values_snapshot?: Json
          vendor_email: string
          vendor_name: string
        }
        Update: {
          form_id?: string
          form_snapshot?: Json
          form_version_id?: string | null
          id?: string
          invitation_id?: string | null
          organisation_id?: string
          reference_number?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          updated_at?: string
          values_snapshot?: Json
          vendor_email?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_approvals: {
        Row: {
          created_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          organisation_id: string
          reason: string | null
          submission_id: string
        }
        Insert: {
          created_at?: string
          decided_by: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          organisation_id: string
          reason?: string | null
          submission_id: string
        }
        Update: {
          created_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          organisation_id?: string
          reason?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_approvals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_approvals_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_exceptions: {
        Row: {
          created_at: string
          first_approver: string | null
          id: string
          is_sensitive: boolean
          organisation_id: string
          reason: string
          requested_by: string
          requirement: string
          resolved_at: string | null
          second_approver: string | null
          status: Database["public"]["Enums"]["exception_status"]
          submission_id: string
        }
        Insert: {
          created_at?: string
          first_approver?: string | null
          id?: string
          is_sensitive?: boolean
          organisation_id: string
          reason: string
          requested_by: string
          requirement: string
          resolved_at?: string | null
          second_approver?: string | null
          status?: Database["public"]["Enums"]["exception_status"]
          submission_id: string
        }
        Update: {
          created_at?: string
          first_approver?: string | null
          id?: string
          is_sensitive?: boolean
          organisation_id?: string
          reason?: string
          requested_by?: string
          requirement?: string
          resolved_at?: string | null
          second_approver?: string | null
          status?: Database["public"]["Enums"]["exception_status"]
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_exceptions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exceptions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_checks: {
        Row: {
          category: string
          check_name: string
          created_at: string
          document_id: string | null
          explanation: string
          field_key: string | null
          id: string
          result: Database["public"]["Enums"]["check_result"]
          run_id: string
          source: string
          submission_id: string
        }
        Insert: {
          category: string
          check_name: string
          created_at?: string
          document_id?: string | null
          explanation: string
          field_key?: string | null
          id?: string
          result: Database["public"]["Enums"]["check_result"]
          run_id: string
          source: string
          submission_id: string
        }
        Update: {
          category?: string
          check_name?: string
          created_at?: string
          document_id?: string | null
          explanation?: string
          field_key?: string | null
          id?: string
          result?: Database["public"]["Enums"]["check_result"]
          run_id?: string
          source?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_checks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "verification_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_checks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_runs: {
        Row: {
          completed_at: string | null
          id: string
          run_type: Database["public"]["Enums"]["run_type"]
          started_at: string
          status: string
          submission_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          run_type?: Database["public"]["Enums"]["run_type"]
          started_at?: string
          status?: string
          submission_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          run_type?: Database["public"]["Enums"]["run_type"]
          started_at?: string
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_runs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_org_member: {
        Args: {
          _org: string
          _roles?: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      submission_in_member_org: {
        Args: { _submission: string }
        Returns: boolean
      }
    }
    Enums: {
      approval_decision: "approved" | "rejected"
      check_result:
        | "pass"
        | "fail"
        | "warning"
        | "not_verified"
        | "manual_review"
      exception_status: "pending" | "first_approved" | "approved" | "rejected"
      form_status: "draft" | "published" | "archived"
      integration_status: "unconfigured" | "configured" | "error"
      invitation_status: "sent" | "opened" | "submitted" | "expired" | "revoked"
      org_role: "owner" | "admin" | "reviewer"
      run_type: "initial" | "resubmission" | "manual"
      submission_status:
        | "submitted"
        | "verification_in_progress"
        | "correction_requested"
        | "resubmitted"
        | "under_manual_review"
        | "approved"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_decision: ["approved", "rejected"],
      check_result: [
        "pass",
        "fail",
        "warning",
        "not_verified",
        "manual_review",
      ],
      exception_status: ["pending", "first_approved", "approved", "rejected"],
      form_status: ["draft", "published", "archived"],
      integration_status: ["unconfigured", "configured", "error"],
      invitation_status: ["sent", "opened", "submitted", "expired", "revoked"],
      org_role: ["owner", "admin", "reviewer"],
      run_type: ["initial", "resubmission", "manual"],
      submission_status: [
        "submitted",
        "verification_in_progress",
        "correction_requested",
        "resubmitted",
        "under_manual_review",
        "approved",
        "rejected",
      ],
    },
  },
} as const
