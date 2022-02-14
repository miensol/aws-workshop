import { sleep } from 'k6';
import http from 'k6/http';
import { randomImageKey, randomSize } from "./image-utils.js";
import { options as opt } from './options.js'

export const options = opt

export default function () {
  const url = `https://piotr-mionskowski-awstraining-api-server.aws.bright.dev/image?key=${randomImageKey()}&width=${randomSize()}&height=${randomSize()}`;
  while (true) {
    http.get(url, {
      headers: {
        Accept: 'image/png'
      }
    });
  }
}
