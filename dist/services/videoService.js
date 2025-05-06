"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadVideoWithYtDlp = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const downloadPath = path_1.default.join(__dirname, "../../downloads");
const downloadVideoWithYtDlp = (videoUrl) => {
    return new Promise((resolve, reject) => {
        const outputFile = path_1.default.join(downloadPath, "%(title)s.%(ext)s"); // Dynamic file naming
        const command = `yt-dlp -o "${outputFile}" "${videoUrl}"`;
        (0, child_process_1.exec)(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return reject(error);
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            console.log(`stdout: ${stdout}`);
            resolve(outputFile);
        });
    });
};
exports.downloadVideoWithYtDlp = downloadVideoWithYtDlp;
