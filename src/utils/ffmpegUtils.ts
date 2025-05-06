import ffmpeg from 'fluent-ffmpeg';

export const convertVideoFormat = (inputPath: string, outputPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err:any) => reject(err))
            .run();
    });
};

export const compressVideo = (inputPath: string, outputPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .videoCodec('libx264') // Set codec
            .size('1280x720')      // Resize to 720p
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err:any) => reject(err))
            .run();
    });
};
