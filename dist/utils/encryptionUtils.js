"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.decryptReEncodeAndStream = exports.decryptVideo = exports.encryptVideo = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const ffprobe_1 = __importDefault(require("@ffprobe-installer/ffprobe"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
fluent_ffmpeg_1.default.setFfprobePath(ffprobe_1.default.path);
const path_1 = __importDefault(require("path"));
const stream = __importStar(require("stream"));
const util_1 = require("util");
const algorithm = "aes-256-cbc"; // Encryption algorithm
const iv = crypto_1.default.randomBytes(16); // Initialization vector
// Encrypt video file
const encryptVideo = (inputPath, outputPath, key) => {
    return new Promise((resolve, reject) => {
        const cipher = crypto_1.default.createCipheriv(algorithm, Buffer.from(key, "hex"), iv);
        const input = fs_1.default.createReadStream(inputPath);
        const output = fs_1.default.createWriteStream(outputPath);
        // Write the IV at the beginning of the output file
        output.write(iv);
        input.pipe(cipher).pipe(output).on("finish", resolve).on("error", reject);
    });
};
exports.encryptVideo = encryptVideo;
// Decrypt video file
const decryptVideo = (inputPath, outputPath, key) => {
    return new Promise((resolve, reject) => {
        const iv = Buffer.alloc(16); // Create a buffer for the Initialization Vector (IV)
        // Step 1: Read the IV (first 16 bytes) from the encrypted file
        const ivStream = fs_1.default.createReadStream(inputPath, { start: 0, end: 15 });
        ivStream.on("data", (chunk) => {
            if (Buffer.isBuffer(chunk)) {
                chunk.copy(iv); // Copy the IV into the buffer
            }
            else {
                reject(new Error("Unexpected data type: IV must be a Buffer"));
            }
        });
        ivStream.on("end", () => {
            // Step 2: Proceed to decrypt the rest of the file
            const decipher = crypto_1.default.createDecipheriv(algorithm, Buffer.from(key, "hex"), iv);
            const decryptedTempPath = inputPath.replace(".enc", "_decrypted.mp4"); // Temporary decrypted file
            const encryptedStream = fs_1.default.createReadStream(inputPath, { start: 16 }); // Skip the IV
            const decryptedStream = fs_1.default.createWriteStream(decryptedTempPath);
            encryptedStream
                .pipe(decipher)
                .pipe(decryptedStream)
                .on("finish", () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    // Step 3: Re-encode the decrypted file using FFmpeg
                    yield reEncodeVideo(decryptedTempPath, outputPath);
                    fs_1.default.unlinkSync(decryptedTempPath); // Clean up temporary decrypted file
                    resolve();
                }
                catch (err) {
                    reject(new Error(`Failed to re-encode video: ${err.message}`));
                }
            }))
                .on("error", reject);
        });
        ivStream.on("error", reject);
    });
};
exports.decryptVideo = decryptVideo;
// Function to re-encode video using FFmpeg
const reEncodeVideo = (inputPath, outputPath) => {
    if (!fs_1.default.existsSync(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
    }
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    console.log(`Starting FFmpeg encoding: Input - ${inputPath}, Output - ${outputPath}`);
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(inputPath)
            .output(outputPath)
            .videoCodec("libx264") // Ensure H.264 encoding
            .audioCodec("aac") // Ensure AAC encoding
            .outputOptions("-movflags +faststart") // Optimize for web playback
            .on("start", (command) => console.log(`FFmpeg command: ${command}`)) // Logs FFmpeg command
            .on("progress", (progress) => console.log(`FFmpeg progress: ${JSON.stringify(progress)}`)) // Logs progress
            .on("end", () => {
            console.log(`FFmpeg encoding completed successfully: ${outputPath}`);
            resolve();
        })
            .on("error", (err) => {
            console.error(`FFmpeg error: ${err.message}`);
            reject(new Error(`FFmpeg error: ${err.message}`));
        })
            .run();
    });
};
const pipeline = (0, util_1.promisify)(stream.pipeline);
// Updated function that works with your existing serveVideo approach
const decryptReEncodeAndStream = (filePath, start, end, res, encryptionKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const iv = Buffer.alloc(16); // Initialization Vector
        const bufferStream = new stream.PassThrough();
        // Set up FFmpeg with buffer stream as input
        const ffmpegProcess = (0, fluent_ffmpeg_1.default)(bufferStream)
            .inputFormat("mp4") // Adjust based on your actual content format
            .outputOptions([
            "-movflags faststart",
            "-preset ultrafast",
            "-tune zerolatency",
            // Skip to the approximate position in the video that corresponds to the byte range
            // Note: This is an approximation as byte ranges don't directly map to video time
            "-ss 0", // You may need a more sophisticated mapping between byte range and video time
        ])
            .videoCodec("libx264")
            .audioCodec("aac")
            .format("mp4")
            .on("start", (command) => console.log(`FFmpeg command: ${command}`))
            .on("error", (err) => {
            console.error("FFmpeg error:", err);
            if (!res.headersSent) {
                res.status(500).end("Error processing video.");
            }
        });
        // Pipe FFmpeg output to response
        ffmpegProcess.pipe(res, { end: true });
        // Create readable stream for the chunk
        const readStream = fs_1.default.createReadStream(filePath, { start, end });
        const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", Buffer.from(encryptionKey, "hex"), iv);
        // Process the stream
        yield pipeline(readStream, decipher, bufferStream);
        // End the buffer stream when all data has been processed
        bufferStream.end();
    }
    catch (error) {
        console.error("Error decrypting and streaming video:", error);
        if (!res.headersSent) {
            res.status(500).end("Error processing video.");
        }
    }
});
exports.decryptReEncodeAndStream = decryptReEncodeAndStream;
