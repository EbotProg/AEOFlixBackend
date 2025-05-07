import mongoose, { Document } from "mongoose";

export interface IVideo extends Document {
    title: string;
    filePath: string;
    encryptionKey: string;
    uploadedAt?: Date;
    thumbnailPath: string
    thumbnailName: string,
    cloudinaryUrl: string,
    thumbnailUrl: string
}

const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    filePath: { type: String, required: false },
    encryptionKey: { type: String, required: false },
    uploadedAt: { type: Date, default: Date.now },
    thumbnailPath: { type: String, required:false},
    thumbnailName: { type: String, required:false},
    cloudinaryUrl: { type: String, required:true},
    thumbnailUrl: { type: String, required:true}
});

const Video = mongoose.model<IVideo>("Video", videoSchema);

export default Video;
