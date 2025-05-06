"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveVideo = exports.serveVideobackup2 = exports.serveVideobackup = exports.serveVideoOneGo = exports.getVideos = exports.uploadVideo = exports.uploadVideoBackup2 = exports.uploadVideoBackup = exports.downloadVideoController = void 0;
const videoService_1 = require("../services/videoService");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const videoModel_1 = __importDefault(require("../models/videoModel"));
const crypto_1 = __importDefault(require("crypto"));
const encryptionUtils_1 = require("../utils/encryptionUtils");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const redis_1 = require("redis");
const redisClient = (0, redis_1.createClient)({
    url: 'redis://localhost:6379', // Default Redis port
});
const downloadVideoController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const videoUrl = req.body.url;
        const filePath = yield (0, videoService_1.downloadVideoWithYtDlp)(videoUrl);
        res.status(200).send({ message: 'Video downloaded and compressed successfully!', filePath });
    }
    catch (err) {
        res.status(500).send({ error: err.message });
    }
});
exports.downloadVideoController = downloadVideoController;
const uploadVideoBackup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const file = req.file;
        const providedThumbnail = req.body.thumbnail; // Check if thumbnail is provided
        if (!file) {
            return res.status(400).json({ error: "No file uploaded." });
        }
        const uploadDir = path_1.default.join(__dirname, "../../uploads");
        const encryptedFilePath = path_1.default.join(uploadDir, `${Date.now()}_${file.originalname}.enc`);
        const encryptionKey = crypto_1.default.randomBytes(32).toString("hex"); // Generate a random encryption key
        // Encrypt the video file
        yield (0, encryptionUtils_1.encryptVideo)(file.path, encryptedFilePath, encryptionKey);
        // Handle Thumbnail Creation
        let thumbnailPath = ""; // Path for the thumbnail
        let thumbnailName = `${Date.now()}_thumbnail.jpg`;
        if (providedThumbnail) {
            // Save the provided thumbnail
            const thumbnailDir = path_1.default.join(__dirname, "../../uploads/thumbnails");
            if (!fs_1.default.existsSync(thumbnailDir)) {
                fs_1.default.mkdirSync(thumbnailDir, { recursive: true });
            }
            thumbnailPath = path_1.default.join(thumbnailDir, thumbnailName);
            fs_1.default.writeFileSync(thumbnailPath, Buffer.from(providedThumbnail, "base64")); // Assume thumbnail is sent as Base64
        }
        else {
            // Generate a thumbnail if none is provided
            thumbnailPath = yield generateThumbnail(file.path, thumbnailName);
        }
        // Save video metadata to MongoDB
        const newVideo = new videoModel_1.default({
            title: file.originalname,
            filePath: encryptedFilePath,
            encryptionKey,
            thumbnailPath, // Include thumbnail path in metadata
            thumbnailName
        });
        yield newVideo.save();
        // Delete the original unencrypted file
        fs_1.default.unlinkSync(file.path);
        res.status(200).json({
            message: "Video uploaded, encrypted, and thumbnail created successfully!",
            video: newVideo,
        });
    }
    catch (error) {
        console.error("Error uploading video:", error);
        res.status(500).json({ error: "Failed to upload video." });
    }
});
exports.uploadVideoBackup = uploadVideoBackup;
const uploadVideoBackup2 = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const file = req.file;
        const providedThumbnail = req.body.thumbnail; // Check if thumbnail is provided
        if (!file) {
            return res.status(400).json({ error: "No file uploaded." });
        }
        const uploadDir = path_1.default.join(__dirname, "../../uploads");
        const videoFilePath = path_1.default.join(uploadDir, `${Date.now()}_${file.originalname}`);
        // Move the uploaded video to the desired location
        fs_1.default.renameSync(file.path, videoFilePath);
        // Handle Thumbnail Creation
        let thumbnailPath = ""; // Path for the thumbnail
        let thumbnailName = `${Date.now()}_thumbnail.jpg`;
        if (providedThumbnail) {
            // Save the provided thumbnail
            const thumbnailDir = path_1.default.join(__dirname, "../../uploads/thumbnails");
            if (!fs_1.default.existsSync(thumbnailDir)) {
                fs_1.default.mkdirSync(thumbnailDir, { recursive: true });
            }
            thumbnailPath = path_1.default.join(thumbnailDir, thumbnailName);
            fs_1.default.writeFileSync(thumbnailPath, Buffer.from(providedThumbnail, "base64")); // Assume thumbnail is sent as Base64
        }
        else {
            // Generate a thumbnail if none is provided
            thumbnailPath = yield generateThumbnail(videoFilePath, thumbnailName);
        }
        // Save video metadata to MongoDB
        const newVideo = new videoModel_1.default({
            title: file.originalname,
            filePath: videoFilePath,
            thumbnailPath, // Include thumbnail path in metadata
            thumbnailName,
        });
        yield newVideo.save();
        res.status(200).json({
            message: "Video uploaded and thumbnail created successfully!",
            video: newVideo,
        });
    }
    catch (error) {
        console.error("Error uploading video:", error);
        res.status(500).json({ error: "Failed to upload video." });
    }
});
exports.uploadVideoBackup2 = uploadVideoBackup2;
const uploadVideo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const file = req.file;
        const providedThumbnail = req.body.thumbnail; // Check if thumbnail is provided
        if (!file) {
            return res.status(400).json({ error: "No file uploaded." });
        }
        const uploadDir = path_1.default.join(__dirname, "../../uploads");
        const originalFilePath = file.path; // Original uploaded file path
        const outputFilePath = path_1.default.join(uploadDir, `${Date.now()}_${file.originalname}.mp4`); // Convert to MP4 format
        // Convert video to MP4 using FFmpeg
        yield new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(originalFilePath)
                .output(outputFilePath)
                .videoCodec("libx264") // Ensure H.264 encoding
                .audioCodec("aac") // Ensure AAC encoding
                .outputOptions("-movflags +faststart") // Optimize for web playback
                .on("start", (command) => console.log(`FFmpeg command: ${command}`)) // Logs FFmpeg command
                .on("progress", (progress) => console.log(`FFmpeg progress: ${JSON.stringify(progress)}`)) // Logs progress
                .on("end", () => {
                console.log(`FFmpeg encoding completed successfully: ${outputFilePath}`);
                resolve();
            })
                .on("error", (err) => {
                console.error(`FFmpeg error: ${err.message}`);
                reject(new Error(`FFmpeg error: ${err.message}`));
            })
                .run();
        });
        // Handle Thumbnail Creation
        let thumbnailPath = ""; // Path for the thumbnail
        let thumbnailName = `${Date.now()}_thumbnail.jpg`;
        if (providedThumbnail) {
            // Save the provided thumbnail
            const thumbnailDir = path_1.default.join(__dirname, "../../uploads/thumbnails");
            if (!fs_1.default.existsSync(thumbnailDir)) {
                fs_1.default.mkdirSync(thumbnailDir, { recursive: true });
            }
            thumbnailPath = path_1.default.join(thumbnailDir, thumbnailName);
            fs_1.default.writeFileSync(thumbnailPath, Buffer.from(providedThumbnail, "base64")); // Assume thumbnail is sent as Base64
        }
        else {
            // Generate a thumbnail if none is provided
            thumbnailPath = yield generateThumbnail(outputFilePath, thumbnailName);
        }
        // Save video metadata to MongoDB
        const newVideo = new videoModel_1.default({
            title: file.originalname,
            filePath: outputFilePath, // Save the path to the converted MP4 file
            thumbnailPath, // Include thumbnail path in metadata
            thumbnailName,
        });
        yield newVideo.save();
        // Delete the original uploaded file
        fs_1.default.unlinkSync(originalFilePath);
        res.status(200).json({
            message: "Video uploaded, converted to MP4, and thumbnail created successfully!",
            video: newVideo,
        });
    }
    catch (error) {
        console.error("Error uploading video:", error);
        res.status(500).json({ error: "Failed to upload video." });
    }
});
exports.uploadVideo = uploadVideo;
// Function to generate a thumbnail from the video
const generateThumbnail = (videoPath, thumbnailName) => {
    return new Promise((resolve, reject) => {
        const thumbnailDir = path_1.default.join(__dirname, "../../uploads/thumbnails");
        if (!fs_1.default.existsSync(thumbnailDir)) {
            fs_1.default.mkdirSync(thumbnailDir, { recursive: true });
        }
        const thumbnailPath = path_1.default.join(thumbnailDir, thumbnailName);
        (0, fluent_ffmpeg_1.default)(videoPath)
            .screenshots({
            count: 1, // Generate 1 thumbnail
            filename: path_1.default.basename(thumbnailPath),
            folder: thumbnailDir,
            size: "1920x1080", // Resize thumbnail (optional)
        })
            .on("end", () => {
            resolve(thumbnailPath);
        })
            .on("error", (err) => {
            reject(new Error(`Failed to generate thumbnail: ${err.message}`));
        });
    });
};
// Fetch all video metadata
const getVideos = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const videos = yield videoModel_1.default.find(); // Retrieve all videos
        res.status(200).json(videos);
    }
    catch (error) {
        console.error("Error fetching videos:", error);
        res.status(500).json({ error: "Failed to fetch videos." });
    }
});
exports.getVideos = getVideos;
// Serve decrypted video (decrypt dynamically for playback)
const serveVideoOneGo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const video = yield videoModel_1.default.findById(req.params.id);
        if (!video) {
            return res.status(404).json({ error: "Video not found." });
        }
        const tempFilePath = path_1.default.join(__dirname, "../../uploads/temp.mp4");
        // Decrypt the video file
        yield (0, encryptionUtils_1.decryptVideo)(video.filePath, tempFilePath, video.encryptionKey);
        // Stream the decrypted file
        res.sendFile(tempFilePath, {}, (err) => {
            if (err) {
                console.error("Error streaming video:", err);
                //res.status(500).json({ error: "Failed to serve video." });
            }
            // Clean up temporary decrypted file after serving
            fs_1.default.unlinkSync(tempFilePath);
        });
    }
    catch (error) {
        console.error("Error serving video:", error);
        res.status(500).json({ error: "Failed to serve video." });
    }
});
exports.serveVideoOneGo = serveVideoOneGo;
const serveVideobackup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const video = yield videoModel_1.default.findById(req.params.id);
        if (!video) {
            return res.status(404).json({ error: "Video not found." });
        }
        const tempFilePath = path_1.default.join(__dirname, "../../uploads/temp.mp4");
        // Decrypt the video to a temporary file
        yield (0, encryptionUtils_1.decryptVideo)(video.filePath, tempFilePath, video.encryptionKey);
        const videoStats = fs_1.default.statSync(tempFilePath); // Get decrypted video stats
        // Handle Range Request for streaming
        const range = req.headers.range;
        if (!range) {
            // If no range header, send the entire file
            res.writeHead(200, {
                "Content-Length": videoStats.size,
                "Content-Type": "video/mp4",
            });
            fs_1.default.createReadStream(tempFilePath)
                .on("close", () => {
                // Clean up the temporary file once the stream is done
                fs_1.default.unlinkSync(tempFilePath);
            })
                .pipe(res);
            return;
        }
        // Parse Range header (e.g., "bytes=0-")
        console.log("Range header:", range);
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : videoStats.size - 1; // Default to end of file
        const chunkSize = end - start + 1;
        // Create HTTP response for partial content
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${videoStats.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "video/mp4",
        });
        // Stream the requested chunk
        fs_1.default.createReadStream(tempFilePath, { start, end })
            .on("close", () => {
            // Clean up the temporary file once the stream is done
            fs_1.default.unlinkSync(tempFilePath);
        })
            .pipe(res);
    }
    catch (error) {
        console.error("Error serving video:", error);
        res.status(500).json({ error: "Failed to serve video." });
    }
});
exports.serveVideobackup = serveVideobackup;
const serveVideobackup2 = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let tempFilePath = null;
    try {
        // First, check if this is a range request that we might have cached
        const range = req.headers.range;
        const videoId = req.params.id;
        console.log('range', range);
        if (range) {
            // Try to serve from Redis cache first before decrypting the file
            const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
            const start = parseInt(startStr, 10);
            const end = endStr ? parseInt(endStr, 10) : null;
            try {
                // Ensure Redis is connected
                if (!redisClient.isOpen) {
                    yield redisClient.connect();
                }
                // Two caching strategies:
                // 1. Exact range cache - for exact matches
                const exactRangeKey = `video:${videoId}:range:${start}-${end || ''}`;
                const cachedRangeResponse = yield redisClient.get(exactRangeKey);
                if (cachedRangeResponse) {
                    console.log(`Serving exact range from Redis cache: ${exactRangeKey}`);
                    const cachedData = JSON.parse(cachedRangeResponse);
                    res.writeHead(206, cachedData.headers);
                    res.end(Buffer.from(cachedData.chunk, "base64"));
                    return;
                }
                // 2. Check for chunk cache that contains this range
                // This is more complex but worth implementing for frequent seeks
                const cachedChunksKey = `video:${videoId}:chunks`;
                const cachedChunksInfo = yield redisClient.get(cachedChunksKey);
                if (cachedChunksInfo) {
                    const chunksInfo = JSON.parse(cachedChunksInfo);
                    // Find a chunk that contains the requested range
                    for (const chunkInfo of chunksInfo) {
                        if (start >= chunkInfo.start && (!end || end <= chunkInfo.end)) {
                            // Found a chunk that contains the requested range
                            const chunkKey = `video:${videoId}:chunk:${chunkInfo.start}-${chunkInfo.end}`;
                            const cachedChunk = yield redisClient.get(chunkKey);
                            if (cachedChunk) {
                                // Need to extract the exact portion from the cached chunk
                                const chunkBuffer = Buffer.from(cachedChunk, "base64");
                                const offsetStart = start - chunkInfo.start;
                                const offsetEnd = end ? end - chunkInfo.start : chunkBuffer.length - 1;
                                const extractedChunk = chunkBuffer.slice(offsetStart, offsetEnd + 1);
                                // Get video size from cache if available
                                const videoSizeKey = `video:${videoId}:size`;
                                const videoSize = (yield redisClient.get(videoSizeKey)) || 0;
                                // Construct headers
                                const headers = {
                                    "Content-Range": `bytes ${start}-${start + extractedChunk.length - 1}/${videoSize}`,
                                    "Accept-Ranges": "bytes",
                                    "Content-Length": extractedChunk.length,
                                    "Content-Type": "video/mp4",
                                    "Access-Control-Allow-Origin": "*",
                                    "Cache-Control": "no-cache, no-store, must-revalidate",
                                };
                                console.log(`Serving partial range from cached chunk: ${chunkKey}`);
                                res.writeHead(206, headers);
                                res.end(extractedChunk);
                                return;
                            }
                        }
                    }
                }
            }
            catch (cacheError) {
                console.error("Redis cache error:", cacheError);
                // Continue with normal flow if cache fails
            }
        }
        // If we reach here, we need to process the file
        const video = yield videoModel_1.default.findById(videoId);
        if (!video) {
            return res.status(404).json({ error: "Video not found." });
        }
        // Create a unique temp file for this request
        tempFilePath = path_1.default.join(__dirname, `../../uploads/temp_${videoId}_${Date.now()}.mp4`);
        yield (0, encryptionUtils_1.decryptVideo)(video.filePath, tempFilePath, video.encryptionKey);
        const videoStats = fs_1.default.statSync(tempFilePath);
        // Cache video size for future reference
        try {
            if (redisClient.isOpen) {
                yield redisClient.setEx(`video:${videoId}:size`, 3600, videoStats.size.toString());
            }
        }
        catch (err) {
            console.error("Failed to cache video size:", err);
        }
        // If no range is requested, serve the entire file
        if (!range) {
            res.writeHead(200, {
                "Content-Length": videoStats.size,
                "Content-Type": "video/mp4",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            });
            // Create a stream and handle its completion
            const fileStream = fs_1.default.createReadStream(tempFilePath);
            // Set up error handling for the stream
            fileStream.on('error', (err) => {
                console.error('Stream error:', err);
                // Only end the response if it hasn't been sent yet
                if (!res.headersSent) {
                    res.status(500).end();
                }
            });
            // Clean up temp file after stream is finished
            fileStream.on('close', () => {
                cleanupTempFile(tempFilePath);
            });
            // Pipe the stream to the response
            fileStream.pipe(res);
            return;
        }
        // Handle range requests
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : videoStats.size - 1;
        // Validate range
        if (isNaN(start) || start < 0 || start >= videoStats.size) {
            res.writeHead(416, {
                "Content-Range": `bytes */${videoStats.size}`,
            });
            return res.end();
        }
        const chunkSize = Math.min(end - start + 1, videoStats.size - start);
        const actualEnd = start + chunkSize - 1;
        try {
            // Ensure Redis is connected before proceeding
            if (!redisClient.isOpen) {
                yield redisClient.connect();
            }
            const chunkKey = `video:${req.params.id}:chunk:${start}-${actualEnd}`;
            let chunk;
            try {
                const chunkKey = `video:${req.params.id}:chunk:${start}-${actualEnd}`;
                const cachedChunk = yield redisClient.get(chunkKey);
                if (cachedChunk) {
                    console.log(`Serving chunk from Redis cache: ${chunkKey}`);
                    chunk = Buffer.from(cachedChunk, "base64");
                }
                else {
                    // If chunk is not cached, read from file and cache it
                    chunk = yield readFileChunk(tempFilePath, start, actualEnd);
                    // Only cache chunks that are not too large (e.g., less than 5MB)
                    // if (chunkSize <= 20 * 1024 * 1024) {
                    try {
                        // Cache the chunk content
                        yield redisClient.setEx(chunkKey, 3600, chunk.toString("base64"));
                        // Also cache the response headers and data for exact range requests
                        const rangeResponseKey = `video:${req.params.id}:range:${start}-${actualEnd}`;
                        const responseData = {
                            headers: {
                                "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
                                "Accept-Ranges": "bytes",
                                "Content-Length": chunkSize,
                                "Content-Type": "video/mp4",
                                "Access-Control-Allow-Origin": "*",
                                "Cache-Control": "no-cache, no-store, must-revalidate",
                            },
                            chunk: chunk.toString("base64")
                        };
                        yield redisClient.setEx(rangeResponseKey, 3600, JSON.stringify(responseData));
                        // Update the chunks registry for this video
                        const chunksKey = `video:${req.params.id}:chunks`;
                        let chunksInfo = [];
                        try {
                            const existingChunksInfo = yield redisClient.get(chunksKey);
                            if (existingChunksInfo) {
                                chunksInfo = JSON.parse(existingChunksInfo);
                            }
                        }
                        catch (err) {
                            console.error("Error reading chunks registry:", err);
                        }
                        // Add this chunk to the registry if not already present
                        const chunkExists = chunksInfo.some((ci) => ci.start === start && ci.end === actualEnd);
                        if (!chunkExists) {
                            chunksInfo.push({ start, end: actualEnd });
                            yield redisClient.setEx(chunksKey, 3600, JSON.stringify(chunksInfo));
                        }
                    }
                    catch (cacheError) {
                        // Log but don't fail if caching fails
                        console.error("Cache storage error:", cacheError);
                    }
                    // }
                }
            }
            catch (redisError) {
                // Fall back to file system if Redis fails
                console.error("Redis error:", redisError);
                chunk = yield readFileChunk(tempFilePath, start, actualEnd);
            }
            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": "video/mp4",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            });
            res.end(chunk);
            // Clean up the temp file after response is sent
            // Only do this for the last chunk or after a delay
            if (actualEnd >= videoStats.size - 1) {
                cleanupTempFile(tempFilePath);
                tempFilePath = null;
            }
        }
        catch (streamError) {
            console.error("Streaming error:", streamError);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to stream video chunk." });
            }
        }
    }
    catch (error) {
        console.error("Error serving video:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to serve video." });
        }
    }
    finally {
        // Ensure temp file cleanup in case of errors
        if (tempFilePath) {
            // Add a small delay to ensure file isn't deleted while streaming
            setTimeout(() => cleanupTempFile(tempFilePath), 1000);
        }
    }
});
exports.serveVideobackup2 = serveVideobackup2;
const serveVideo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const range = req.headers.range;
        const videoId = req.params.id;
        const video = yield videoModel_1.default.findById(videoId);
        if (!video) {
            return res.status(404).json({ error: "Video not found." });
        }
        const videoStats = fs_1.default.statSync(video.filePath);
        if (range) {
            const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
            const start = parseInt(startStr, 10);
            const end = endStr ? parseInt(endStr, 10) : videoStats.size - 1;
            // Validate range
            if (isNaN(start) || start < 0 || start >= videoStats.size) {
                res.writeHead(416, {
                    "Content-Range": `bytes */${videoStats.size}`,
                });
                return res.end();
            }
            const chunkSize = Math.min(end - start + 1, videoStats.size - start);
            const actualEnd = start + chunkSize - 1;
            const headers = {
                "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": "video/mp4",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            };
            res.writeHead(206, headers);
            const videoStream = fs_1.default.createReadStream(video.filePath, { start, end });
            videoStream.pipe(res);
            return;
        }
        // If no range is requested, serve the entire file
        res.writeHead(200, {
            "Content-Length": videoStats.size,
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        });
        const videoStream = fs_1.default.createReadStream(video.filePath);
        videoStream.pipe(res);
    }
    catch (error) {
        console.error("Error serving video:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to serve video." });
        }
    }
});
exports.serveVideo = serveVideo;
// Helper function to safely clean up temp files
const cleanupTempFile = (filePath) => {
    if (!filePath)
        return;
    try {
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
            console.log(`Cleaned up temp file: ${filePath}`);
        }
    }
    catch (err) {
        console.error(`Failed to clean up temp file ${filePath}:`, err);
    }
};
const readFileChunk = (filePath, start, end) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const readableStream = fs_1.default.createReadStream(filePath, {
            start,
            end,
            highWaterMark: 64 * 1024 // 64KB chunks for efficient streaming
        });
        readableStream.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on('error', (err) => {
            reject(err);
        });
    });
};
// const activeStreams = new Set(); // Keep track of active streams
// export const serveVideo = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const video = await Video.findById(req.params.id);
//         if (!video) {
//             return res.status(404).json({ error: "Video not found." });
//         }
//         const tempFilePath = path.join(__dirname, "../../uploads/temp.mp4");
//         // Decrypt the video to a temporary file
//         await decryptVideo(video.filePath, tempFilePath, video.encryptionKey);
//         const videoStats = fs.statSync(tempFilePath);
//         const range = req.headers.range;
//         if (!range) {
//             // No range header, send the entire file
//             res.writeHead(200, {
//                 "Content-Length": videoStats.size,
//                 "Content-Type": "video/mp4",
//             });
//             const stream = fs.createReadStream(tempFilePath);
//             activeStreams.add(stream); // Track active stream
//             stream.pipe(res).on("end", () => {
//                 activeStreams.delete(stream); // Remove finished stream
//                 if (activeStreams.size === 0) {
//                     // Delete file when all streams are completed
//                     fs.unlinkSync(tempFilePath);
//                     console.log("Temporary file deleted after full video was streamed.");
//                 }
//             });
//             return;
//         }
//         const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
//         const start = parseInt(startStr, 10);
//         const end = endStr ? parseInt(endStr, 10) : videoStats.size - 1;
//         const chunkSize = end - start + 1;
//         res.writeHead(206, {
//             "Content-Range": `bytes ${start}-${end}/${videoStats.size}`,
//             "Accept-Ranges": "bytes",
//             "Content-Length": chunkSize,
//             "Content-Type": "video/mp4",
//         });
//         const stream = fs.createReadStream(tempFilePath, { start, end });
//         activeStreams.add(stream); // Track active stream
//         stream.pipe(res).on("end", () => {
//             activeStreams.delete(stream); // Remove finished stream
//             if (activeStreams.size === 0) {
//                 // Delete file when all streams are completed
//                 fs.unlinkSync(tempFilePath);
//                 console.log("Temporary file deleted after full video was streamed.");
//             }
//         });
//     } catch (error) {
//         console.error("Error serving video:", error);
//         res.status(500).json({ error: "Failed to serve video." });
//     }
// };
