export type Task = {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  order_index: number;
  creator_id: string;   // 👈 who created it
  assignee_id?: string; // 👈 who it’s assigned to

  // optional joins (if you fetch profile info too)
  creator?: {
    full_name: string;
    avatar_url?: string;
  };
  assignee?: {
    full_name: string;
    avatar_url?: string;
  };
};
