import { exec } from "child_process";
import path from "path";

const downloadPath = path.join(__dirname, "../../downloads");

export const downloadVideoWithYtDlp = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const outputFile = path.join(downloadPath, "%(title)s.%(ext)s"); // Dynamic file naming
        
        const command = `yt-dlp -o "${outputFile}" "${videoUrl}"`;

        exec(command, (error, stdout, stderr) => {
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
