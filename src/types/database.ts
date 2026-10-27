export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'admin' | 'target_manager' | 'member';
export type ContactType = 'individual' | 'company';
export type ChannelKind = 'email' | 'phone';
export type StageKind = 'open' | 'won' | 'lost' | 'junk';
export type ContributionType = 'cash' | 'in_kind';
export type PartyType = 'individual' | 'company';
export type PaymentInterval = 'one_time' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
export type MeetingStatus = 'scheduled' | 'done';
export type ActivityType =
  | 'task'
  | 'email'
  | 'call'
  | 'meeting'
  | 'event'
  | 'campaign'
  | 'proposal'
  | 'visit'
  | 'servicing'
  | 'prospect_engagement'
  | 'general';
export type ActivityClass = 'stewardship' | 'prospect_engagement' | 'independent';
export type ActivityStatus = 'planned' | 'in_progress' | 'done' | 'cancelled';
export type ContactStatus = 'active' | 'inactive';

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          password_hash?: string;
          full_name: string;
          role: AppRole;
          team_id: string | null;
          is_pse: boolean;
          is_active: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash?: string;
          full_name: string;
          role?: AppRole;
          team_id?: string | null;
          is_pse?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          full_name?: string;
          role?: AppRole;
          team_id?: string | null;
          is_pse?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: string;
        };
        Insert: {
          key: string;
          value: string;
        };
        Update: {
          key?: string;
          value?: string;
        };
        Relationships: [];
      };
      currencies: {
        Row: {
          code: string;
          name: string | null;
        };
        Insert: {
          code: string;
          name?: string | null;
        };
        Update: {
          code?: string;
          name?: string | null;
        };
        Relationships: [];
      };
      fx_rates: {
        Row: {
          currency: string;
          rate_to_base: number;
          effective_from: string;
        };
        Insert: {
          currency: string;
          rate_to_base: number;
          effective_from: string;
        };
        Update: {
          currency?: string;
          rate_to_base?: number;
          effective_from?: string;
        };
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          id: string;
          name: string;
          kind: StageKind;
          position: number;
        };
        Insert: {
          id?: string;
          name: string;
          kind: StageKind;
          position: number;
        };
        Update: {
          id?: string;
          name?: string;
          kind?: StageKind;
          position?: number;
        };
        Relationships: [];
      };
      contribution_categories: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      verticals: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      category_vertical_map: {
        Row: {
          category_id: string;
          vertical_id: string;
        };
        Insert: {
          category_id: string;
          vertical_id: string;
        };
        Update: {
          category_id?: string;
          vertical_id?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          type: ContactType;
          name: string;
          organization_id: string | null;
          designation: string | null;
          website: string | null;
          industry: string | null;
          notes: string | null;
          status: ContactStatus;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: ContactType;
          name: string;
          organization_id?: string | null;
          designation?: string | null;
          website?: string | null;
          industry?: string | null;
          notes?: string | null;
          status?: ContactStatus;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: ContactType;
          name?: string;
          organization_id?: string | null;
          designation?: string | null;
          website?: string | null;
          industry?: string | null;
          notes?: string | null;
          status?: ContactStatus;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_channels: {
        Row: {
          id: string;
          contact_id: string;
          kind: ChannelKind;
          value: string;
          value_normalized: string;
          is_primary: boolean;
        };
        Insert: {
          id?: string;
          contact_id: string;
          kind: ChannelKind;
          value: string;
          value_normalized: string;
          is_primary?: boolean;
        };
        Update: {
          id?: string;
          contact_id?: string;
          kind?: ChannelKind;
          value?: string;
          value_normalized?: string;
          is_primary?: boolean;
        };
        Relationships: [];
      };
      pipelines: {
        Row: {
          id: string;
          deal_name: string;
          focal_person_id: string;
          contribution_type: ContributionType;
          category_id: string;
          party_type: PartyType;
          contact_id: string;
          poc_contact_id: string | null;
          secondary_contact_id: string | null;
          stage_id: string;
          expected_amount: number;
          currency: string;
          amount_base: number;
          payment_interval: PaymentInterval;
          expected_close: string | null;
          country: string | null;
          description: string | null;
          operational_budget: number | null;
          notes: string | null;
          in_kind_valuation_note: string | null;
          lost_reason: string | null;
          won_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          deal_name: string;
          focal_person_id: string;
          contribution_type: ContributionType;
          category_id: string;
          party_type: PartyType;
          contact_id: string;
          poc_contact_id?: string | null;
          secondary_contact_id?: string | null;
          stage_id: string;
          expected_amount: number;
          currency: string;
          amount_base: number;
          payment_interval?: PaymentInterval;
          expected_close?: string | null;
          country?: string | null;
          description?: string | null;
          operational_budget?: number | null;
          notes?: string | null;
          in_kind_valuation_note?: string | null;
          lost_reason?: string | null;
          won_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          deal_name?: string;
          focal_person_id?: string;
          contribution_type?: ContributionType;
          category_id?: string;
          party_type?: PartyType;
          contact_id?: string;
          poc_contact_id?: string | null;
          secondary_contact_id?: string | null;
          stage_id?: string;
          expected_amount?: number;
          currency?: string;
          amount_base?: number;
          payment_interval?: PaymentInterval;
          expected_close?: string | null;
          country?: string | null;
          description?: string | null;
          operational_budget?: number | null;
          notes?: string | null;
          in_kind_valuation_note?: string | null;
          lost_reason?: string | null;
          won_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pipeline_stage_history: {
        Row: {
          id: number;
          pipeline_id: string;
          from_stage: string | null;
          to_stage: string;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: number;
          pipeline_id: string;
          from_stage?: string | null;
          to_stage: string;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: number;
          pipeline_id?: string;
          from_stage?: string | null;
          to_stage?: string;
          changed_by?: string | null;
          changed_at?: string;
        };
        Relationships: [];
      };
      pipeline_receipts: {
        Row: {
          id: string;
          pipeline_id: string;
          amount: number;
          currency: string;
          amount_base: number;
          received_on: string;
          note: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          pipeline_id: string;
          amount: number;
          currency: string;
          amount_base: number;
          received_on: string;
          note?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          pipeline_id?: string;
          amount?: number;
          currency?: string;
          amount_base?: number;
          received_on?: string;
          note?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          contact_id: string | null;
          pipeline_id: string | null;
          scheduled_at: string;
          status: MeetingStatus;
          description: string | null;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          pipeline_id?: string | null;
          scheduled_at: string;
          status?: MeetingStatus;
          description?: string | null;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          pipeline_id?: string | null;
          scheduled_at?: string;
          status?: MeetingStatus;
          description?: string | null;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          type: ActivityType;
          class: ActivityClass;
          title: string;
          owner_id: string;
          contact_id: string | null;
          pipeline_id: string | null;
          meeting_id: string | null;
          related_org_name: string | null;
          status: ActivityStatus;
          remaining_work: string | null;
          occurred_at: string | null;
          due_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: ActivityType;
          class?: ActivityClass;
          title: string;
          owner_id: string;
          contact_id?: string | null;
          pipeline_id?: string | null;
          meeting_id?: string | null;
          related_org_name?: string | null;
          status?: ActivityStatus;
          remaining_work?: string | null;
          occurred_at?: string | null;
          due_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: ActivityType;
          class?: ActivityClass;
          title?: string;
          owner_id?: string;
          contact_id?: string | null;
          pipeline_id?: string | null;
          meeting_id?: string | null;
          related_org_name?: string | null;
          status?: ActivityStatus;
          remaining_work?: string | null;
          occurred_at?: string | null;
          due_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      target_plans: {
        Row: {
          id: string;
          year: number;
          team_id: string | null;
          annual_amount: number;
          locked_at: string | null;
          locked_by: string | null;
        };
        Insert: {
          id?: string;
          year: number;
          team_id?: string | null;
          annual_amount: number;
          locked_at?: string | null;
          locked_by?: string | null;
        };
        Update: {
          id?: string;
          year?: number;
          team_id?: string | null;
          annual_amount?: number;
          locked_at?: string | null;
          locked_by?: string | null;
        };
        Relationships: [];
      };
      target_quarters: {
        Row: {
          id: string;
          plan_id: string;
          quarter: number;
          amount: number;
        };
        Insert: {
          id?: string;
          plan_id: string;
          quarter: number;
          amount: number;
        };
        Update: {
          id?: string;
          plan_id?: string;
          quarter?: number;
          amount?: number;
        };
        Relationships: [];
      };
      target_lines: {
        Row: {
          id: string;
          quarter_id: string;
          user_id: string;
          vertical_id: string;
          percent: number;
          amount: number;
        };
        Insert: {
          id?: string;
          quarter_id: string;
          user_id: string;
          vertical_id: string;
          percent: number;
          amount: number;
        };
        Update: {
          id?: string;
          quarter_id?: string;
          user_id?: string;
          vertical_id?: string;
          percent?: number;
          amount?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_pse_member: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      publish_target_plan: {
        Args: { p_plan_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: AppRole;
      contact_type: ContactType;
      channel_kind: ChannelKind;
      stage_kind: StageKind;
      contribution_type: ContributionType;
      party_type: PartyType;
      payment_interval: PaymentInterval;
      meeting_status: MeetingStatus;
      activity_type: ActivityType;
      activity_class: ActivityClass;
      activity_status: ActivityStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
