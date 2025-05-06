import express from 'express';
import { downloadVideoController } from '../controllers/videoController';
import multer from "multer";
import { uploadVideo, getVideos, serveVideo } from "../controllers/videoController";


const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads"); // Save files in the "uploads" folder
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueName);
    },
});
const upload = multer({ storage });

// Define routes
router.post('/download', downloadVideoController);
router.post("/upload", upload.single("video"), uploadVideo); // Upload video
router.get("/", getVideos); // Fetch all videos
router.get("/:id", serveVideo); // Serve a specific video file

export default router;
