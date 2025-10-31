import { Request, Response } from "express";
import { downloadVideoWithYtDlp } from "../services/videoService";
import path from "path";
import fs from "fs";
import Video from "../models/videoModel";
import crypto from "crypto";
import {
  encryptVideo,
  decryptVideo,
  decryptReEncodeAndStream,
} from "../utils/encryptionUtils";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

import { createClient } from "redis";
const redisClient = createClient({
  url: "redis://localhost:6379", // Default Redis port
});
import { PassThrough } from "stream";
import multer from "multer";

// import { v2 as cloudinary } from "cloudinary";

// // Configure Cloudinary
// cloudinary.config({
//     cloud_name: "dyult56pk",
//     api_key: "492999857674452",
//     api_secret: "9_wkhQOrKSMr_rXcGgIQ9GSFqdI",
//     timeout: 60000,
// })

export const downloadVideoController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const videoUrl = req.body.url;
    const filePath = await downloadVideoWithYtDlp(videoUrl);
    res.status(200).send({
      message: "Video downloaded and compressed successfully!",
      filePath,
    });
  } catch (err: any) {
    res.status(500).send({ error: err.message });
  }
};

export const uploadVideoBackup = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const file = req.file;
    console.log("Uploaded file info:", file);
    const providedThumbnail = req.body.thumbnail; // Check if thumbnail is provided
    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const uploadDir = path.join(__dirname, "../../uploads");
    const encryptedFilePath = path.join(
      uploadDir,
      `${Date.now()}_${file.originalname}.enc`
    );
    const encryptionKey = crypto.randomBytes(32).toString("hex"); // Generate a random encryption key

    // Encrypt the video file
    await encryptVideo(file.path, encryptedFilePath, encryptionKey);

    // Handle Thumbnail Creation
    let thumbnailPath = ""; // Path for the thumbnail
    let thumbnailName = `${Date.now()}_thumbnail.jpg`;
    if (providedThumbnail) {
      // Save the provided thumbnail
      const thumbnailDir = path.join(__dirname, "../../uploads/thumbnails");
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }

      thumbnailPath = path.join(thumbnailDir, thumbnailName);
      fs.writeFileSync(thumbnailPath, Buffer.from(providedThumbnail, "base64")); // Assume thumbnail is sent as Base64
    } else {
      // Generate a thumbnail if none is provided
      thumbnailPath = await generateThumbnail(file.path, thumbnailName);
    }

    // Save video metadata to MongoDB
    const newVideo = new Video({
      title: file.originalname,
      filePath: encryptedFilePath,
      encryptionKey,
      thumbnailPath, // Include thumbnail path in metadata
      thumbnailName,
    });
    await newVideo.save();

    // Delete the original unencrypted file
    fs.unlinkSync(file.path);

    res.status(200).json({
      message: "Video uploaded, encrypted, and thumbnail created successfully!",
      video: newVideo,
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    res.status(500).json({ error: "Failed to upload video." });
  }
};

export const uploadVideoBackup2 = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const file = req.file;
    const providedThumbnail = req.body.thumbnail; // Check if thumbnail is provided
    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const uploadDir = path.join(__dirname, "../../uploads");
    const videoFilePath = path.join(
      uploadDir,
      `${Date.now()}_${file.originalname}`
    );

    // Move the uploaded video to the desired location
    fs.renameSync(file.path, videoFilePath);

    // Handle Thumbnail Creation
    let thumbnailPath = ""; // Path for the thumbnail
    let thumbnailName = `${Date.now()}_thumbnail.jpg`;
    if (providedThumbnail) {
      // Save the provided thumbnail
      const thumbnailDir = path.join(__dirname, "../../uploads/thumbnails");
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }

      thumbnailPath = path.join(thumbnailDir, thumbnailName);
      fs.writeFileSync(thumbnailPath, Buffer.from(providedThumbnail, "base64")); // Assume thumbnail is sent as Base64
    } else {
      // Generate a thumbnail if none is provided
      thumbnailPath = await generateThumbnail(videoFilePath, thumbnailName);
    }

    // Save video metadata to MongoDB
    const newVideo = new Video({
      title: file.originalname,
      filePath: videoFilePath,
      thumbnailPath, // Include thumbnail path in metadata
      thumbnailName,
    });
    await newVideo.save();

    res.status(200).json({
      message: "Video uploaded and thumbnail created successfully!",
      video: newVideo,
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    res.status(500).json({ error: "Failed to upload video." });
  }
};

export const uploadVideo = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const file = req.file;
    console.log("Uploaded file info:", file);
    const providedThumbnail = req.body.thumbnail;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const uploadDir = path.join(__dirname, "../../uploads");
    const originalFilePath = file.path;
    const outputFilePath = path.join(
      uploadDir,
      `${Date.now()}_${file.originalname}.mp4`
    );

    // IMPORTANT: Set FFmpeg path (adjust path according to your system)
    // For Windows, you might need something like:
    // ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
    // For Linux/Mac:
    // ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

    console.log(
      "Starting video conversion to MP4... originalfilepath, outputFilepath",
      originalFilePath,
      outputFilePath
    );
    // Convert video to MP4 using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(originalFilePath)
        .output(outputFilePath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions("-movflags +faststart")
        .on("start", (command) => console.log(`FFmpeg command: ${command}`))
        .on("progress", (progress) =>
          console.log(`FFmpeg progress: ${JSON.stringify(progress)}`)
        )
        .on("end", () => {
          console.log(
            `FFmpeg encoding completed successfully: ${outputFilePath}`
          );
          resolve();
        })
        .on("error", (err) => {
          console.error(`FFmpeg error: ${err.message}`);
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .run();
    });

    console.log("Video conversion completed.");
    // Handle Thumbnail Creation
    let thumbnailPath = "";
    let thumbnailName = `${Date.now()}_thumbnail.jpg`;

    if (providedThumbnail) {
      const thumbnailDir = path.join(__dirname, "../../uploads/thumbnails");
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }
      thumbnailPath = path.join(thumbnailDir, thumbnailName);
      fs.writeFileSync(thumbnailPath, Buffer.from(providedThumbnail, "base64"));
    } else {
      thumbnailPath = await generateThumbnail(outputFilePath, thumbnailName);
    }

    const newVideo = new Video({
      title: file.originalname,
      filePath: outputFilePath,
      thumbnailPath,
      thumbnailName,
    });
    await newVideo.save();

    fs.unlinkSync(originalFilePath);

    res.status(200).json({
      message:
        "Video uploaded, converted to MP4, and thumbnail created successfully!",
      video: newVideo,
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    res.status(500).json({ error: "Failed to upload video." });
  }
};

// export const uploadVideo = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const file = req.file;
//         if (!file) {
//             return res.status(400).json({ error: "No file uploaded." });
//         }

//         // Upload video directly to Cloudinary via streaming
//         const uploadPromise = new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 { resource_type: "video", folder: "videos" },
//                 (error, result) => {
//                     if (error) return reject(error);
//                     resolve(result);
//                 }
//             );

//             // Pipe the buffer to Cloudinary (avoids writing to disk)
//             uploadStream.end(file.buffer);
//         });

//         const result: any = await uploadPromise; // Wait for upload to complete

//         // Ensure thumbnail is generated dynamically
//         const thumbnailUrl = cloudinary.url(result.public_id, {
//             resource_type: "video",
//             format: "jpg",
//             transformation: [{ width: 300, height: 200, crop: "thumb" }],
//         });

//         // Save metadata in MongoDB
//         const newVideo = new Video({
//             title: file.originalname,
//             cloudinaryUrl: result.secure_url,
//             thumbnailUrl,
//         });
//         await newVideo.save();

//         res.status(200).json({
//             message: "Video uploaded successfully to Cloudinary!",
//             video: newVideo,
//         });
//     } catch (error) {
//         console.error("Error uploading video:", error);
//         res.status(500).json({ error: "Failed to upload video." });
//     }
// };
// Function to generate a thumbnail from the video
const generateThumbnail = (
  videoPath: string,
  thumbnailName: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const thumbnailDir = path.join(__dirname, "../../uploads/thumbnails");
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    const thumbnailPath = path.join(thumbnailDir, thumbnailName);
    console.log("videoPath, thumbnailPath", videoPath, thumbnailPath);
    ffmpeg(videoPath)
      .screenshots({
        count: 1, // Generate 1 thumbnail
        filename: path.basename(thumbnailPath),
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
export const getVideos = async (req: Request, res: Response): Promise<any> => {
  try {
    const videos = await Video.find(); // Retrieve all videos
    res.status(200).json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ error: "Failed to fetch videos." });
  }
};

// Serve decrypted video (decrypt dynamically for playback)
export const serveVideoOneGo = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    const tempFilePath = path.join(__dirname, "../../uploads/temp.mp4");

    // Decrypt the video file
    await decryptVideo(video.filePath, tempFilePath, video.encryptionKey);

    // Stream the decrypted file
    res.sendFile(tempFilePath, {}, (err) => {
      if (err) {
        console.error("Error streaming video:", err);
        //res.status(500).json({ error: "Failed to serve video." });
      }

      // Clean up temporary decrypted file after serving
      fs.unlinkSync(tempFilePath);
    });
  } catch (error) {
    console.error("Error serving video:", error);
    res.status(500).json({ error: "Failed to serve video." });
  }
};

export const serveVideobackup = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    const tempFilePath = path.join(__dirname, "../../uploads/temp.mp4");

    // Decrypt the video to a temporary file
    await decryptVideo(video.filePath, tempFilePath, video.encryptionKey);

    const videoStats = fs.statSync(tempFilePath); // Get decrypted video stats

    // Handle Range Request for streaming
    const range = req.headers.range;
    if (!range) {
      // If no range header, send the entire file
      res.writeHead(200, {
        "Content-Length": videoStats.size,
        "Content-Type": "video/mp4",
      });
      fs.createReadStream(tempFilePath)
        .on("close", () => {
          // Clean up the temporary file once the stream is done
          fs.unlinkSync(tempFilePath);
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
    fs.createReadStream(tempFilePath, { start, end })
      .on("close", () => {
        // Clean up the temporary file once the stream is done
        fs.unlinkSync(tempFilePath);
      })
      .pipe(res);
  } catch (error) {
    console.error("Error serving video:", error);
    res.status(500).json({ error: "Failed to serve video." });
  }
};

export const serveVideoBackup2 = async (
  req: Request,
  res: Response
): Promise<any> => {
  let tempFilePath: string | null = null;

  try {
    // First, check if this is a range request that we might have cached
    const range = req.headers.range;
    const videoId = req.params.id;
    console.log("range", range);
    console.log("videoId", videoId);

    if (range) {
      // Try to serve from Redis cache first before decrypting the file
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : null;

      try {
        // Ensure Redis is connected
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }

        // Two caching strategies:
        // 1. Exact range cache - for exact matches
        const exactRangeKey = `video:${videoId}:range:${start}-${end || ""}`;
        const cachedRangeResponse = await redisClient.get(exactRangeKey);

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
        const cachedChunksInfo = await redisClient.get(cachedChunksKey);

        if (cachedChunksInfo) {
          const chunksInfo = JSON.parse(cachedChunksInfo);
          // Find a chunk that contains the requested range
          for (const chunkInfo of chunksInfo) {
            if (start >= chunkInfo.start && (!end || end <= chunkInfo.end)) {
              // Found a chunk that contains the requested range
              const chunkKey = `video:${videoId}:chunk:${chunkInfo.start}-${chunkInfo.end}`;
              const cachedChunk = await redisClient.get(chunkKey);

              if (cachedChunk) {
                // Need to extract the exact portion from the cached chunk
                const chunkBuffer = Buffer.from(cachedChunk, "base64");
                const offsetStart = start - chunkInfo.start;
                const offsetEnd = end
                  ? end - chunkInfo.start
                  : chunkBuffer.length - 1;
                const extractedChunk = chunkBuffer.slice(
                  offsetStart,
                  offsetEnd + 1
                );

                // Get video size from cache if available
                const videoSizeKey = `video:${videoId}:size`;
                const videoSize = (await redisClient.get(videoSizeKey)) || 0;

                // Construct headers
                const headers = {
                  "Content-Range": `bytes ${start}-${
                    start + extractedChunk.length - 1
                  }/${videoSize}`,
                  "Accept-Ranges": "bytes",
                  "Content-Length": extractedChunk.length,
                  "Content-Type": "video/mp4",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                };

                console.log(
                  `Serving partial range from cached chunk: ${chunkKey}`
                );
                res.writeHead(206, headers);
                res.end(extractedChunk);
                return;
              }
            }
          }
        }
      } catch (cacheError) {
        console.error("Redis cache error:", cacheError);
        // Continue with normal flow if cache fails
      }
    }

    // If we reach here, we need to process the file
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    // Create a unique temp file for this request
    tempFilePath = path.join(
      __dirname,
      `../../uploads/temp_${videoId}_${Date.now()}.mp4`
    );
    await decryptVideo(video.filePath, tempFilePath, video.encryptionKey);

    const videoStats = fs.statSync(tempFilePath);

    // Cache video size for future reference
    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(
          `video:${videoId}:size`,
          3600,
          videoStats.size.toString()
        );
      }
    } catch (err) {
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
      const fileStream = fs.createReadStream(tempFilePath);

      // Set up error handling for the stream
      fileStream.on("error", (err) => {
        console.error("Stream error:", err);
        // Only end the response if it hasn't been sent yet
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

      // Clean up temp file after stream is finished
      fileStream.on("close", () => {
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
        await redisClient.connect();
      }

      const chunkKey = `video:${req.params.id}:chunk:${start}-${actualEnd}`;
      let chunk: Buffer;

      try {
        const chunkKey = `video:${req.params.id}:chunk:${start}-${actualEnd}`;
        const cachedChunk = await redisClient.get(chunkKey);

        if (cachedChunk) {
          console.log(`Serving chunk from Redis cache: ${chunkKey}`);
          chunk = Buffer.from(cachedChunk, "base64");
        } else {
          // If chunk is not cached, read from file and cache it
          chunk = await readFileChunk(tempFilePath, start, actualEnd);

          // Only cache chunks that are not too large (e.g., less than 5MB)
          // if (chunkSize <= 20 * 1024 * 1024) {
          try {
            // Cache the chunk content
            await redisClient.setEx(chunkKey, 3600, chunk.toString("base64"));

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
              chunk: chunk.toString("base64"),
            };
            await redisClient.setEx(
              rangeResponseKey,
              3600,
              JSON.stringify(responseData)
            );

            // Update the chunks registry for this video
            const chunksKey = `video:${req.params.id}:chunks`;
            let chunksInfo = [];

            try {
              const existingChunksInfo = await redisClient.get(chunksKey);
              if (existingChunksInfo) {
                chunksInfo = JSON.parse(existingChunksInfo);
              }
            } catch (err) {
              console.error("Error reading chunks registry:", err);
            }

            // Add this chunk to the registry if not already present
            const chunkExists = chunksInfo.some(
              (ci: { start: number; end: number }) =>
                ci.start === start && ci.end === actualEnd
            );

            if (!chunkExists) {
              chunksInfo.push({ start, end: actualEnd });
              await redisClient.setEx(
                chunksKey,
                3600,
                JSON.stringify(chunksInfo)
              );
            }
          } catch (cacheError) {
            // Log but don't fail if caching fails
            console.error("Cache storage error:", cacheError);
          }
          // }
        }
      } catch (redisError) {
        // Fall back to file system if Redis fails
        console.error("Redis error:", redisError);
        chunk = await readFileChunk(tempFilePath, start, actualEnd);
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
    } catch (streamError) {
      console.error("Streaming error:", streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream video chunk." });
      }
    }
  } catch (error) {
    console.error("Error serving video:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to serve video." });
    }
  } finally {
    // Ensure temp file cleanup in case of errors
    if (tempFilePath) {
      // Add a small delay to ensure file isn't deleted while streaming
      setTimeout(() => cleanupTempFile(tempFilePath), 1000);
    }
  }
};

export const serveVideoBackup3 = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const range = req.headers.range;
    const videoId = req.params.id;
    console.log("range", range);

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    const videoStats = fs.statSync(video.filePath);

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

      const videoStream = fs.createReadStream(video.filePath, { start, end });
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

    const videoStream = fs.createReadStream(video.filePath);
    videoStream.pipe(res);
  } catch (error) {
    console.error("Error serving video:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to serve video." });
    }
  }
};

export const serveVideoBackup4 = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const range = req.headers.range;
    const videoId = req.params.id;
    console.log("range", range);

    if (range) {
      // Try to serve from Redis cache first
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : null;

      try {
        // Ensure Redis is connected
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }

        // Strategy 1: Check for exact range cache
        const exactRangeKey = `video:${videoId}:range:${start}-${end || ""}`;
        const cachedRangeResponse = await redisClient.get(exactRangeKey);

        if (cachedRangeResponse) {
          console.log(`Serving exact range from Redis cache: ${exactRangeKey}`);
          const cachedData = JSON.parse(cachedRangeResponse);
          res.writeHead(206, cachedData.headers);
          res.end(Buffer.from(cachedData.chunk, "base64"));
          return;
        }

        // Strategy 2: Check for chunk cache that contains this range
        const cachedChunksKey = `video:${videoId}:chunks`;
        const cachedChunksInfo = await redisClient.get(cachedChunksKey);

        if (cachedChunksInfo) {
          const chunksInfo = JSON.parse(cachedChunksInfo);

          // Find a chunk that contains the requested range
          for (const chunkInfo of chunksInfo) {
            if (start >= chunkInfo.start && (!end || end <= chunkInfo.end)) {
              const chunkKey = `video:${videoId}:chunk:${chunkInfo.start}-${chunkInfo.end}`;
              const cachedChunk = await redisClient.get(chunkKey);

              if (cachedChunk) {
                const chunkBuffer = Buffer.from(cachedChunk, "base64");
                const offsetStart = start - chunkInfo.start;
                const offsetEnd = end
                  ? end - chunkInfo.start
                  : chunkBuffer.length - 1;
                const extractedChunk = chunkBuffer.slice(
                  offsetStart,
                  offsetEnd + 1
                );

                // Get video size from cache
                const videoSizeKey = `video:${videoId}:size`;
                const videoSize = (await redisClient.get(videoSizeKey)) || 0;

                const headers = {
                  "Content-Range": `bytes ${start}-${
                    start + extractedChunk.length - 1
                  }/${videoSize}`,
                  "Accept-Ranges": "bytes",
                  "Content-Length": extractedChunk.length,
                  "Content-Type": "video/mp4",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                };

                console.log(
                  `Serving partial range from cached chunk: ${chunkKey}`
                );
                res.writeHead(206, headers);
                res.end(extractedChunk);
                return;
              }
            }
          }
        }
      } catch (cacheError) {
        console.error("Redis cache error:", cacheError);
        // Continue with normal flow if cache fails
      }
    }

    // If we reach here, process the file normally
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    const videoStats = fs.statSync(video.filePath);

    // Cache video size for future reference
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      await redisClient.setEx(
        `video:${videoId}:size`,
        3600,
        videoStats.size.toString()
      );
    } catch (err) {
      console.error("Failed to cache video size:", err);
    }

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

      try {
        // Ensure Redis is connected
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }

        const chunkKey = `video:${videoId}:chunk:${start}-${actualEnd}`;
        const cachedChunk = await redisClient.get(chunkKey);
        let chunk: Buffer;

        if (cachedChunk) {
          console.log(`Serving chunk from Redis cache: ${chunkKey}`);
          chunk = Buffer.from(cachedChunk, "base64");
        } else {
          // Read chunk from file and cache it
          chunk = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            const videoStream = fs.createReadStream(video.filePath, {
              start,
              end: actualEnd,
            });

            videoStream.on("data", (data) => {
              const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
              chunks.push(buffer);
            });
            videoStream.on("end", () => resolve(Buffer.concat(chunks)));
            videoStream.on("error", reject);
          });

          // Cache the chunk
          try {
            await redisClient.setEx(chunkKey, 3600, chunk.toString("base64"));

            // Cache the complete response data
            const rangeResponseKey = `video:${videoId}:range:${start}-${actualEnd}`;
            const responseData = {
              headers: {
                "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": "video/mp4",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
              chunk: chunk.toString("base64"),
            };
            await redisClient.setEx(
              rangeResponseKey,
              3600,
              JSON.stringify(responseData)
            );

            // Update chunks registry
            const chunksKey = `video:${videoId}:chunks`;
            let chunksInfo = [];

            try {
              const existingChunksInfo = await redisClient.get(chunksKey);
              if (existingChunksInfo) {
                chunksInfo = JSON.parse(existingChunksInfo);
              }
            } catch (err) {
              console.error("Error reading chunks registry:", err);
            }

            const chunkExists = chunksInfo.some(
              (ci: { start: number; end: number }) =>
                ci.start === start && ci.end === actualEnd
            );

            if (!chunkExists) {
              chunksInfo.push({ start, end: actualEnd });
              await redisClient.setEx(
                chunksKey,
                3600,
                JSON.stringify(chunksInfo)
              );
            }
          } catch (cacheError) {
            console.error("Cache storage error:", cacheError);
          }
        }

        const headers = {
          "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/mp4",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        };

        res.writeHead(206, headers);
        res.end(chunk);
        return;
      } catch (redisError) {
        console.error("Redis error, falling back to streaming:", redisError);
        // Fallback to direct streaming if Redis fails
        const headers = {
          "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/mp4",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        };
        res.writeHead(206, headers);
        const videoStream = fs.createReadStream(video.filePath, {
          start,
          end: actualEnd,
        });
        videoStream.pipe(res);
        return;
      }
    }

    // If no range is requested, serve the entire file
    res.writeHead(200, {
      "Content-Length": videoStats.size,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    const videoStream = fs.createReadStream(video.filePath);
    videoStream.pipe(res);
  } catch (error) {
    console.error("Error serving video:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to serve video." });
    }
  }
};

/*** TEST */
export const serveVideo = async (req: Request, res: Response): Promise<any> => {
  try {
    const range = req.headers.range;
    const videoId = req.params.id;
    const userSession = req.headers["user-session"] || "default";

    // Get video info first - MOVED THIS UP
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    const videoStats = fs.statSync(video.filePath);

    // Cache video size for future reference
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      await redisClient.setEx(
        `video:${videoId}:size`,
        3600,
        videoStats.size.toString()
      );
    } catch (err) {
      console.error("Failed to cache video size:", err);
    }

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : null;
      const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

      // Validate range
      if (isNaN(start) || start < 0 || start >= videoStats.size) {
        res.writeHead(416, {
          "Content-Range": `bytes */${videoStats.size}`,
        });
        return res.end();
      }

      const actualEnd = end || videoStats.size - 1;
      const chunkSize = Math.min(
        actualEnd - start + 1,
        videoStats.size - start
      );

      try {
        if (!redisClient.isOpen) await redisClient.connect();

        // Strategy 1: Check exact range cache (your existing code)
        const exactRangeKey = `video:${videoId}:range:${start}-${actualEnd}`;
        const cachedRangeResponse = await redisClient.get(exactRangeKey);

        if (cachedRangeResponse) {
          console.log(`Serving exact range from Redis cache: ${exactRangeKey}`);
          const cachedData = JSON.parse(cachedRangeResponse);
          res.writeHead(206, cachedData.headers);
          res.end(Buffer.from(cachedData.chunk, "base64"));

          // Pre-cache next chunks in background
          setTimeout(
            () =>
              preCacheNextChunks(
                videoId,
                start,
                actualEnd,
                videoStats.size,
                video.filePath
              ),
            0
          );
          return;
        }

        // Strategy 2: Check for chunk cache that contains this range
        const cachedChunksKey = `video:${videoId}:chunks`;
        const cachedChunksInfo = await redisClient.get(cachedChunksKey);

        if (cachedChunksInfo) {
          const chunksInfo = JSON.parse(cachedChunksInfo);

          // Find a chunk that contains the requested range
          for (const chunkInfo of chunksInfo) {
            if (start >= chunkInfo.start && (!end || end <= chunkInfo.end)) {
              const chunkKey = `video:${videoId}:chunk:${chunkInfo.start}-${chunkInfo.end}`;
              const cachedChunk = await redisClient.get(chunkKey);

              if (cachedChunk) {
                const chunkBuffer = Buffer.from(cachedChunk, "base64");
                const offsetStart = start - chunkInfo.start;
                const offsetEnd = end
                  ? end - chunkInfo.start
                  : chunkBuffer.length - 1;
                const extractedChunk = chunkBuffer.slice(
                  offsetStart,
                  offsetEnd + 1
                );

                const headers = {
                  "Content-Range": `bytes ${start}-${
                    start + extractedChunk.length - 1
                  }/${videoStats.size}`,
                  "Accept-Ranges": "bytes",
                  "Content-Length": extractedChunk.length,
                  "Content-Type": "video/mp4",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                };

                console.log(
                  `Serving partial range from cached chunk: ${chunkKey}`
                );
                res.writeHead(206, headers);
                res.end(extractedChunk);

                // Pre-cache next chunks in background
                setTimeout(
                  () =>
                    preCacheNextChunks(
                      videoId,
                      start,
                      actualEnd,
                      videoStats.size,
                      video.filePath
                    ),
                  0
                );
                return;
              }
            }
          }
        }
      } catch (cacheError) {
        console.error("Redis cache error:", cacheError);
        // Continue with normal flow if cache fails
      }

      // If we reach here, process the file normally (no cache hit)
      try {
        // Ensure Redis is connected
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }

        const chunkKey = `video:${videoId}:chunk:${start}-${actualEnd}`;
        const cachedChunk = await redisClient.get(chunkKey);
        let chunk: Buffer;

        if (cachedChunk) {
          console.log(`Serving chunk from Redis cache: ${chunkKey}`);
          chunk = Buffer.from(cachedChunk, "base64");
        } else {
          // Read chunk from file and cache it
          chunk = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            const videoStream = fs.createReadStream(video.filePath, {
              start,
              end: actualEnd,
            });

            videoStream.on("data", (data) => {
              const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
              chunks.push(buffer);
            });
            videoStream.on("end", () => resolve(Buffer.concat(chunks)));
            videoStream.on("error", reject);
          });

          // Cache the chunk
          try {
            await redisClient.setEx(chunkKey, 3600, chunk.toString("base64"));

            // Cache the complete response data
            const rangeResponseKey = `video:${videoId}:range:${start}-${actualEnd}`;
            const responseData = {
              headers: {
                "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": "video/mp4",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
              chunk: chunk.toString("base64"),
            };
            await redisClient.setEx(
              rangeResponseKey,
              3600,
              JSON.stringify(responseData)
            );

            // Update chunks registry
            const chunksKey = `video:${videoId}:chunks`;
            let chunksInfo = [];

            try {
              const existingChunksInfo = await redisClient.get(chunksKey);
              if (existingChunksInfo) {
                chunksInfo = JSON.parse(existingChunksInfo);
              }
            } catch (err) {
              console.error("Error reading chunks registry:", err);
            }

            const chunkExists = chunksInfo.some(
              (ci: { start: number; end: number }) =>
                ci.start === start && ci.end === actualEnd
            );

            if (!chunkExists) {
              chunksInfo.push({ start, end: actualEnd });
              await redisClient.setEx(
                chunksKey,
                3600,
                JSON.stringify(chunksInfo)
              );
            }
          } catch (cacheError) {
            console.error("Cache storage error:", cacheError);
          }
        }

        const headers = {
          "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/mp4",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        };

        res.writeHead(206, headers);
        res.end(chunk);

        // Pre-cache next chunks in background
        setTimeout(
          () =>
            preCacheNextChunks(
              videoId,
              start,
              actualEnd,
              videoStats.size,
              video.filePath
            ),
          0
        );
        return;
      } catch (redisError) {
        console.error("Redis error, falling back to streaming:", redisError);
        // Fallback to direct streaming if Redis fails
        const headers = {
          "Content-Range": `bytes ${start}-${actualEnd}/${videoStats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/mp4",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        };
        res.writeHead(206, headers);
        const videoStream = fs.createReadStream(video.filePath, {
          start,
          end: actualEnd,
        });
        videoStream.pipe(res);

        // Pre-cache next chunks in background even if Redis failed for current chunk
        setTimeout(
          () =>
            preCacheNextChunks(
              videoId,
              start,
              actualEnd,
              videoStats.size,
              video.filePath
            ),
          0
        );
        return;
      }
    }

    // If no range is requested, serve the entire file
    res.writeHead(200, {
      "Content-Length": videoStats.size,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    const videoStream = fs.createReadStream(video.filePath);
    videoStream.pipe(res);
  } catch (error) {
    console.error("Error serving video:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to serve video." });
    }
  }
};

// Pre-cache next chunks for smooth playback
async function preCacheNextChunks(
  videoId: string,
  currentStart: number,
  currentEnd: number,
  videoSize: number,
  filePath: string
) {
  console.log("Pre-caching next chunks...");
  console.log(
    "videoId:",
    videoId,
    "currentStart:",
    currentStart,
    "currentEnd:",
    currentEnd,
    "videoSize:",
    videoSize
  );
  try {
    if (!redisClient.isOpen) await redisClient.connect();

    const CHUNK_SIZE = 1024 * 1024; // 1MB
    const PRE_CACHE_CHUNKS = 3; // Pre-cache next 3 chunks

    for (let i = 1; i <= PRE_CACHE_CHUNKS; i++) {
      const nextStart = currentEnd + 1;
      const nextEnd = Math.min(nextStart + CHUNK_SIZE - 1, videoSize - 1);

      if (nextStart >= videoSize) break;

      const chunkKey = `video:${videoId}:chunk:${nextStart}-${nextEnd}`;
      const existingChunk = await redisClient.get(chunkKey);

      if (!existingChunk) {
        // Cache this chunk in background
        cacheVideoChunk(videoId, nextStart, nextEnd, filePath);
      }

      // Update currentEnd for next iteration
      currentEnd = nextEnd;
    }
  } catch (error) {
    console.error("Pre-caching error:", error);
  }
}

async function cacheVideoChunk(
  videoId: string,
  start: number,
  end: number,
  filePath: string
) {
  try {
    const chunk = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const videoStream = fs.createReadStream(filePath, { start, end });

      videoStream.on("data", (data) => {
        chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
      });
      videoStream.on("end", () => resolve(Buffer.concat(chunks)));
      videoStream.on("error", reject);
    });

    await redisClient.setEx(
      `video:${videoId}:chunk:${start}-${end}`,
      86400, // 24 hours TTL
      chunk.toString("base64")
    );

    // Update chunks registry
    const chunksKey = `video:${videoId}:chunks`;
    let chunksInfo = [];

    try {
      const existingChunksInfo = await redisClient.get(chunksKey);
      if (existingChunksInfo) {
        chunksInfo = JSON.parse(existingChunksInfo);
      }
    } catch (err) {
      console.error("Error reading chunks registry:", err);
    }

    const chunkExists = chunksInfo.some(
      (ci: any) => ci.start === start && ci.end === end
    );
    if (!chunkExists) {
      chunksInfo.push({ start, end });
      await redisClient.setEx(chunksKey, 86400, JSON.stringify(chunksInfo));
    }

    console.log(`Pre-cached chunk: ${start}-${end}`);
  } catch (error) {
    console.error("Error caching chunk:", error);
  }
}

/*** TEST */

// export const serveVideo = async (req: Request, res: Response): Promise<any> => {
//   try {
//     const videoId = req.params.id;
//     const video = await Video.findById(videoId);
//     if (!video) {
//       return res.status(404).json({ error: "Video not found." });
//     }

//     // Redirect to Cloudinary URL
//     res.redirect(video.cloudinaryUrl);
//   } catch (error) {
//     console.error("Error serving video:", error);
//     res.status(500).json({ error: "Failed to serve video." });
//   }
// };

// Helper function to safely clean up temp files
const cleanupTempFile = (filePath: string | null) => {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up temp file: ${filePath}`);
    }
  } catch (err) {
    console.error(`Failed to clean up temp file ${filePath}:`, err);
  }
};

const readFileChunk = (
  filePath: string,
  start: number,
  end: number
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const readableStream = fs.createReadStream(filePath, {
      start,
      end,
      highWaterMark: 64 * 1024, // 64KB chunks for efficient streaming
    });

    readableStream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    readableStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    readableStream.on("error", (err) => {
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
