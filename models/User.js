import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: '',
    },
    photoURL: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['Student', 'Moderator', 'Admin'],
      default: 'Student',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('User', userSchema);
