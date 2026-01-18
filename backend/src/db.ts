import mongoose, { Schema, Document } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/workhub?authSource=admin';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================
// INTERFACES
// ============================================

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  is_admin: boolean;
  created_at: Date;
}

export interface IProject extends Document {
  name: string;
  description?: string;
  created_by: mongoose.Types.ObjectId;
  created_at: Date;
}

export interface IProjectMember extends Document {
  project_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: Date;
}

export interface IPermission extends Document {
  project_member_id: mongoose.Types.ObjectId;
  status_id?: mongoose.Types.ObjectId;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface IStatus extends Document {
  project_id: mongoose.Types.ObjectId;
  slug: string;
  title: string;
  color: string;
  icon: string;
  position: number;
  created_at: Date;
}

export interface IChecklistItem {
  text: string;
  completed: boolean;
}

export interface IAttachment {
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  url: string;
  uploaded_at: Date;
}

export interface ITask extends Document {
  project_id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status_id: mongoose.Types.ObjectId;
  priority: 'low' | 'medium' | 'high';
  assigned_to?: mongoose.Types.ObjectId;
  created_by: mongoose.Types.ObjectId;
  due_date?: Date;
  checklist: IChecklistItem[];
  attachments: IAttachment[];
  created_at: Date;
  updated_at: Date;
}

export interface IComment extends Document {
  task_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  text: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMAS
// ============================================

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  is_admin: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const ProjectSchema = new Schema<IProject>({
  name: { type: String, required: true },
  description: String,
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now }
});

const ProjectMemberSchema = new Schema<IProjectMember>({
  project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' },
  created_at: { type: Date, default: Date.now }
});

ProjectMemberSchema.index({ project_id: 1, user_id: 1 }, { unique: true });

const PermissionSchema = new Schema<IPermission>({
  project_member_id: { type: Schema.Types.ObjectId, ref: 'ProjectMember', required: true },
  status_id: { type: Schema.Types.ObjectId, ref: 'Status' },
  can_read: { type: Boolean, default: true },
  can_create: { type: Boolean, default: false },
  can_edit: { type: Boolean, default: false },
  can_delete: { type: Boolean, default: false }
});

const StatusSchema = new Schema<IStatus>({
  project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  slug: { type: String, required: true },
  title: { type: String, required: true },
  color: { type: String, required: true },
  icon: { type: String, required: true },
  position: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
});

StatusSchema.index({ project_id: 1, slug: 1 }, { unique: true });

const TaskSchema = new Schema<ITask>({
  project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true },
  description: String,
  status_id: { type: Schema.Types.ObjectId, ref: 'Status', required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  due_date: Date,
  checklist: [{
    text: { type: String, required: true },
    completed: { type: Boolean, default: false }
  }],
  attachments: [{
    filename: String,
    original_name: String,
    mimetype: String,
    size: Number,
    url: String,
    uploaded_at: { type: Date, default: Date.now }
  }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

TaskSchema.index({ title: 'text', description: 'text' });

const CommentSchema = new Schema<IComment>({
  task_id: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// ============================================
// MODELS
// ============================================

export const User = mongoose.model<IUser>('User', UserSchema);
export const Project = mongoose.model<IProject>('Project', ProjectSchema);
export const ProjectMember = mongoose.model<IProjectMember>('ProjectMember', ProjectMemberSchema);
export const Permission = mongoose.model<IPermission>('Permission', PermissionSchema);
export const Status = mongoose.model<IStatus>('Status', StatusSchema);
export const Task = mongoose.model<ITask>('Task', TaskSchema);
export const Comment = mongoose.model<IComment>('Comment', CommentSchema);

export default mongoose;
