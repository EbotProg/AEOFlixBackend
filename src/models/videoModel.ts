import mongoose, { Document } from "mongoose";

export interface IVideo extends Document {
    title: string;
    filePath: string;
    encryptionKey: string;
    uploadedAt?: Date;
    thumbnailPath: String
    thumbnailName: String
}

const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    filePath: { type: String, required: true },
    encryptionKey: { type: String, required: false },
    uploadedAt: { type: Date, default: Date.now },
    thumbnailPath: { type: String, required:true},
    thumbnailName: { type: String, required:true}
});

const Video = mongoose.model<IVideo>("Video", videoSchema);

export default Video;
