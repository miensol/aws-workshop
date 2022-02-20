import { Injectable } from '@nestjs/common';
import { S3 } from "aws-sdk";
import sharp from "sharp";

@Injectable()
export class AppService {

  constructor(private readonly s3: S3) {
  }

  async getImageResized(params: { width: number; key: string; height: number }): Promise<Buffer> {
    const imageFile = await this.s3.getObject({
      Bucket: process.env.IMAGES_BUCKET_NAME,
      Key: params.key
    }).promise();

    return await sharp(imageFile.Body! as Buffer)
      .resize({
        width: params.width, height: params.height
      })
      .toBuffer()
  }
}
