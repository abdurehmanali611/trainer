export interface Trainer {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  gym_name: string;
  inactive_days_threshold: number | null;
  telebirr_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  cash_note: string;
  avatar_url?: string;
  created_at: string;
}

export type ClientMode = 'paid' | 'trial' | 'illustrative';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled' | 'no_show';
export type RequestStatus = 'pending' | 'approved' | 'declined';
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'forgiven';
export type PaymentChannel = 'cash' | 'bank' | 'telebirr';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'forgiven';
export type MessageKind = 'text' | 'image' | 'voice';

export interface AccessState {
  state: 'allowed' | 'blocked_unpaid' | 'blocked_no_period' | 'blocked_trial_expired';
  reason?: string;
  period_id?: number;
  invoice_id?: number;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  mode: ClientMode;
  goals: string[];
  current_weight: number | null;
  target_weight: number | null;
  body_fat: number | null;
  avatar_url: string;
  is_active: boolean;
  created_at: string;
  last_session_date: string | null;
  access_state: AccessState;
  goal_label: string;
  must_change_credential: boolean;
  otp?: string;
  medical_history?: string;
  emergency_contact?: string;
  measurements?: Measurement[];
  photos?: ProgressPhoto[];
  records?: PersonalRecord[];
  streak?: Streak;
  achievements?: Achievement[];
}

export interface Measurement {
  id: number;
  date: string;
  weight: number | null;
  body_fat: number | null;
  chest: number | null;
  waist: number | null;
  arms: number | null;
  thighs: number | null;
}

export interface ProgressPhoto {
  id: number;
  url: string;
  date: string;
  note: string;
  created_at: string;
}

export interface PersonalRecord {
  id: number;
  exercise: string;
  weight: number;
  reps: number;
  date: string;
}

export interface Streak {
  current: number;
  longest: number;
  last_activity_date?: string | null;
}

export interface Achievement {
  id: number;
  key: string;
  label: string;
  unlocked_at: string;
}

export interface Exercise {
  id: number;
  name: string;
  exercise_type: string;
  muscle_group: string;
  difficulty: string;
  equipment: string;
  description: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  duration_minutes: number | null;
  video_url: string;
  trainer: number | null;
}

export interface PlannedExercise {
  id?: number;
  exercise: number;
  exercise_detail?: Exercise;
  sets: number;
  reps: string;
  target_weight: number;
  rest_seconds: number;
  order: number;
}

export interface WorkoutDay {
  id?: number;
  day_name: string;
  order: number;
  exercises: PlannedExercise[];
}

export interface WorkoutPlan {
  id: number;
  name: string;
  description?: string;
  client: number | null;
  client_name: string | null;
  days: WorkoutDay[];
  is_template: boolean;
  created_at: string;
}

export interface MealItem {
  id?: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  order: number;
}

export interface Meal {
  id?: number;
  name: string;
  time: string;
  order: number;
  items: MealItem[];
}

export interface DietPlan {
  id: number;
  name: string;
  description?: string;
  client: number | null;
  client_name: string | null;
  daily_calories: number;
  protein: number;
  carbs: number;
  fats: number;
  meals: Meal[];
  is_template: boolean;
  created_at: string;
}

export interface Session {
  id: number;
  client: number;
  client_name: string;
  date: string;
  time: string;
  end_date?: string | null;
  end_time?: string | null;
  duration_minutes: number;
  status: SessionStatus;
  notes: string;
  is_online: boolean;
  created_at: string;
}

export interface RescheduleRequest {
  id: number;
  session: number | null;
  session_info: { id: number; date: string; time: string; duration_minutes: number } | null;
  client: number;
  client_name: string;
  requested_date: string;
  requested_time: string | null;
  reason: string;
  status: RequestStatus;
  trainer_note: string;
  created_at: string;
  decided_at: string | null;
}

export interface PermissionRequest {
  id: number;
  session: number | null;
  client: number;
  client_name: string;
  date: string;
  kind: 'late' | 'absent';
  reason: string;
  status: RequestStatus;
  trainer_note: string;
  created_at: string;
  decided_at: string | null;
}

export interface SubscriptionPackage {
  id: number;
  name: string;
  price: string;
  sessions_per_week: number;
  duration_days: number;
  features: string[];
  is_active: boolean;
}

export interface SubscriptionPeriod {
  id: number;
  client: number;
  client_name: string;
  package: number | null;
  package_name: string | null;
  start_date: string;
  end_date: string;
  amount: string;
  is_trial: boolean;
  created_at: string;
}

export interface Payment {
  id: number;
  invoice: number;
  invoice_info: { id: number; amount: string; due_date: string; status: string };
  client: number;
  client_name: string;
  transaction_id: string;
  channel: PaymentChannel;
  status: PaymentStatus;
  created_at: string;
  decided_at: string | null;
  decision_note: string;
}

export interface Invoice {
  id: number;
  client: number;
  client_name: string;
  period: number | null;
  period_info: { id: number; start_date: string; end_date: string; is_trial: boolean } | null;
  amount: string;
  due_date: string;
  status: InvoiceStatus;
  created_at: string;
  paid_at: string | null;
  payments: Payment[];
}

export interface Message {
  id: number;
  sender_type: 'trainer' | 'client';
  client: number;
  content: string;
  kind: MessageKind;
  media_urls: string[];
  is_broadcast: boolean;
  broadcast_id: string;
  trainer_read_at: string | null;
  client_read_at: string | null;
  created_at: string;
}

export interface ChatThread {
  id: number;
  name: string;
  avatar_url: string;
  last_message: {
    content: string;
    kind: MessageKind;
    created_at: string;
    sender_type: string;
    is_broadcast: boolean;
  } | null;
  unread: number;
  access_state: AccessState;
}

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  type: 'booking' | 'payment' | 'message' | 'alert' | 'achievement' | 'request';
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface FoodDiaryEntry {
  id: number;
  date: string;
  meal_name: string;
  description: string;
  calories: number | null;
  photo_url: string;
  status: 'pending' | 'reviewed';
  trainer_feedback: string;
  created_at: string;
}

export interface WaterLog {
  id: number;
  date: string;
  amount_ml: number;
  trainer_feedback: string;
  reviewed: boolean;
}

export interface DashboardData {
  counts: {
    total: number;
    paid: number;
    trial: number;
    illustrative: number;
    payment_due: number;
    blocked: number;
    needs_period: number;
    inactive: number;
  };
  revenue_this_month: number;
  revenue_by_channel: { channel: PaymentChannel; total: number }[];
  unpaid_invoices: number;
  retention_rate: { value: number | null; window_days: number; started: number; lost: number };
  inactive_threshold_days: number;
  inactive_clients: Client[];
  today_sessions: {
    id: number;
    client_id: number;
    client_name: string;
    time: string;
    duration_minutes: number;
    status: SessionStatus;
    is_online: boolean;
  }[];
}

export interface WorkloadData {
  week_start: string;
  days: {
    date: string;
    label: string;
    sessions: number;
    hours: number;
    is_today: boolean;
  }[];
  totals: {
    sessions: number;
    hours: number;
    clients: number;
    avg_sessions_per_day: number;
  };
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
