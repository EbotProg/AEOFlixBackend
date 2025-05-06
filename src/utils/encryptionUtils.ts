import crypto from "crypto";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { Response } from "express";
import * as stream from 'stream';
import { promisify } from 'util';

const algorithm = "aes-256-cbc"; // Encryption algorithm
const iv = crypto.randomBytes(16); // Initialization vector

// Encrypt video file
export const encryptVideo = (inputPath: string, outputPath: string, key: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, "hex"), iv);
        const input = fs.createReadStream(inputPath);
        const output = fs.createWriteStream(outputPath);

        // Write the IV at the beginning of the output file
        output.write(iv);

        input.pipe(cipher).pipe(output).on("finish", resolve).on("error", reject);
    });
};

// Decrypt video file
export const decryptVideo = (
    inputPath: string,
    outputPath: string,
    key: string
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const iv = Buffer.alloc(16); // Create a buffer for the Initialization Vector (IV)

        // Step 1: Read the IV (first 16 bytes) from the encrypted file
        const ivStream = fs.createReadStream(inputPath, { start: 0, end: 15 });
        ivStream.on("data", (chunk) => {
            if (Buffer.isBuffer(chunk)) {
                chunk.copy(iv); // Copy the IV into the buffer
            } else {
                reject(new Error("Unexpected data type: IV must be a Buffer"));
            }
        });

        ivStream.on("end", () => {
            // Step 2: Proceed to decrypt the rest of the file
            const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, "hex"), iv);
            const decryptedTempPath = inputPath.replace(".enc", "_decrypted.mp4"); // Temporary decrypted file

            const encryptedStream = fs.createReadStream(inputPath, { start: 16 }); // Skip the IV
            const decryptedStream = fs.createWriteStream(decryptedTempPath);

            encryptedStream
                .pipe(decipher)
                .pipe(decryptedStream)
                .on("finish", async () => {
                    try {
                        // Step 3: Re-encode the decrypted file using FFmpeg
                        await reEncodeVideo(decryptedTempPath, outputPath);
                        fs.unlinkSync(decryptedTempPath); // Clean up temporary decrypted file
                        resolve();
                    } catch (err:any) {
                        reject(new Error(`Failed to re-encode video: ${err.message}`));
                    }
                })
                .on("error", reject);
        });

        ivStream.on("error", reject);
    });
};

// Function to re-encode video using FFmpeg
const reEncodeVideo = (inputPath: string, outputPath: string): Promise<void> => {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Starting FFmpeg encoding: Input - ${inputPath}, Output - ${outputPath}`);
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
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

const pipeline = promisify(stream.pipeline);

// Updated function that works with your existing serveVideo approach
export const decryptReEncodeAndStream = async (
    filePath: string,
    start: number,
    end: number,
    res: Response,
    encryptionKey: string
): Promise<void> => {
    try {
        const iv = Buffer.alloc(16); // Initialization Vector
        const bufferStream = new stream.PassThrough();
        
        // Set up FFmpeg with buffer stream as input
        const ffmpegProcess = ffmpeg(bufferStream)
            .inputFormat('mp4') // Adjust based on your actual content format
            .outputOptions([
                '-movflags faststart',
                '-preset ultrafast',
                '-tune zerolatency',
                // Skip to the approximate position in the video that corresponds to the byte range
                // Note: This is an approximation as byte ranges don't directly map to video time
                '-ss 0', // You may need a more sophisticated mapping between byte range and video time
            ])
            .videoCodec('libx264')
            .audioCodec('aac')
            .format('mp4')
            .on('start', (command) => console.log(`FFmpeg command: ${command}`))
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                if (!res.headersSent) {
                    res.status(500).end('Error processing video.');
                }
            });

        // Pipe FFmpeg output to response
        ffmpegProcess.pipe(res, { end: true });
        
        // Create readable stream for the chunk
        const readStream = fs.createReadStream(filePath, { start, end });
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
        
        // Process the stream
        await pipeline(
            readStream,
            decipher,
            bufferStream
        );
        
        // End the buffer stream when all data has been processed
        bufferStream.end();
        
    } catch (error) {
        console.error('Error decrypting and streaming video:', error);
        if (!res.headersSent) {
            res.status(500).end('Error processing video.');
        }
    }
};





