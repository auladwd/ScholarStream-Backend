import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    scholarshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scholarship',
      required: true,
    },
    universityName: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userImage: {
      type: String,
      default: '',
    },
    ratingPoint: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    reviewComment: {
      type: String,
      required: true,
      trim: true,
    },
    reviewDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Review', reviewSchema);
