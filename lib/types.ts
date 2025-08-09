export type NewsItem = {
  id: string;
  source: "농민신문" | "농정신문" | "농어민신문" | "농수축산신문";
  title: string;
  url: string;
  publishedAt?: string;
  description?: string;
  content?: string;     // HTML
  images?: string[];    // 본문 내 이미지 URL들(최대 6장)
  thumbnail?: string;   // 대표 이미지
};
