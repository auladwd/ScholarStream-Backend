import mongoose from 'mongoose';

const scholarshipSchema = new mongoose.Schema({
  scholarshipName: {
    type: String,
    required: true,
    trim: true
  },
  universityName: {
    type: String,
    required: true,
    trim: true
  },
  universityImage: {
    type: String,
    default: ''
  },
  universityCountry: {
    type: String,
    required: true,
    trim: true
  },
  universityCity: {
    type: String,
    required: true,
    trim: true
  },
  universityWorldRank: {
    type: Number,
    default: 0
  },
  subjectCategory: {
    type: String,
    required: true,
    trim: true
  },
  scholarshipCategory: {
    type: String,
    enum: ['Full fund', 'Partial', 'Self-fund'],
    required: true
  },
  degree: {
    type: String,
    enum: ['Diploma', 'Bachelor', 'Masters'],
    required: true
  },
  tuitionFees: {
    type: Number,
    default: 0
  },
  applicationFees: {
    type: Number,
    required: true,
    min: 0
  },
  serviceCharge: {
    type: Number,
    required: true,
    min: 0
  },
  applicationDeadline: {
    type: Date,
    required: true
  },
  scholarshipPostDate: {
    type: Date,
    default: Date.now
  },
  postedUserEmail: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Scholarship', scholarshipSchema);

