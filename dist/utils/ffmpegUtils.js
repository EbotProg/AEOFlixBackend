"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressVideo = exports.convertVideoFormat = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const convertVideoFormat = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(inputPath)
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
};
exports.convertVideoFormat = convertVideoFormat;
const compressVideo = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(inputPath)
            .videoCodec('libx264') // Set codec
            .size('1280x720') // Resize to 720p
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
};
exports.compressVideo = compressVideo;
