"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const videoController_1 = require("../controllers/videoController");
const multer_1 = __importDefault(require("multer"));
const videoController_2 = require("../controllers/videoController");
const router = express_1.default.Router();
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads"); // Save files in the "uploads" folder
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueName);
    },
});
const upload = (0, multer_1.default)({ storage });
// const upload = multer({ storage: multer.memoryStorage() });
// Define routes
router.post("/download", videoController_1.downloadVideoController);
router.post("/upload", upload.single("video"), videoController_2.uploadVideo); // Upload video
router.get("/", videoController_2.getVideos); // Fetch all videos
router.get("/:id", videoController_2.serveVideo); // Serve a specific video file
exports.default = router;
