# SpeakEasy UK 🇬🇧

App desktop luyện **nghe và nói** tiếng Anh giọng Anh theo chủ đề, có Claude làm tutor.

## Chạy app

Cần: Node 22+, Claude Code đã đăng nhập (lệnh `claude` chạy được), micro và loa.

```powershell
npm install        # lần đầu
npm run dev        # mở cửa sổ app
```

Lần đầu bấm ghi âm, app tải model nhận giọng nói Whisper (~80 MB) một lần; sau đó chạy offline.

## Dùng thế nào

1. **Trang chính** – có sẵn 3 chủ đề mẫu. Tạo chủ đề mới, dán từ/cụm từ (mỗi dòng một mục)
   hoặc bấm *Gợi ý từ* để Claude đề xuất. Bấm *Tạo nghĩa & ví dụ* để Claude viết IPA, nghĩa,
   ví dụ và mẹo phát âm.
2. **Ôn tập** – lặp lại ngắt quãng (FSRS). Thẻ lúc thì *nghe → nhớ nghĩa*, lúc thì
   *xem nghĩa → nói tiếng Anh*, rồi nhại theo câu ví dụ. Phím tắt: `Space` lật thẻ, `1–4` chấm điểm.
3. **Nói chuyện** – chọn tình huống, tutor nói giọng Anh; bạn trả lời bằng giọng nói (hoặc gõ).
   Mỗi lượt có lời khen, câu nói tự nhiên hơn và mẹo phát âm; bấm *Luyện câu này* để tập lại.
4. **Cài đặt** – chọn giọng Anh (Sonia, Ryan, Libby…), tốc độ, trình độ, số từ mới mỗi ngày.

## Thêm từ ngay trong Claude Code

Trong thư mục này, nói với Claude Code kiểu: *"thêm 10 cụm từ về đi khám bác sĩ"* — skill
`add-words` sẽ viết đầy đủ ví dụ và nạp vào app (app tự cập nhật). Hoặc tự nạp file JSON:

```powershell
npm run import-words -- words.json
```

## Lưu ý

- Điểm phát âm là **so khớp những gì app nghe được** với câu mẫu, không phải chấm âm vị chính xác.
- Câu được đọc bằng giọng neural của Microsoft Edge (gửi văn bản lên dịch vụ đó); âm thanh được
  lưu cache nên nghe lại không cần mạng. Mất mạng thì dùng giọng en-GB của Windows.
- Claude chạy qua tài khoản Claude Code của bạn; không cần API key.
- Dữ liệu nằm ở `data/db.json` (đọc được bằng mắt, nên sao lưu thỉnh thoảng).
