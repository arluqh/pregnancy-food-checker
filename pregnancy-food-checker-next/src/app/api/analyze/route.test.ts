import { analyzeImage } from './analyzeImage';

describe('analyzeImage', () => {
  it('画像データを渡すとダミーのレスポンスが返る', () => {
    const result = analyzeImage('data:image/png;base64,xxxx');
    expect(result).toHaveProperty('safe');
    expect(result).toHaveProperty('message');
  });
});
