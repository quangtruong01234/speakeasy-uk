// Starter topics, so the app is useful before any tutor call (FR-014).
// Everyday spoken British English; tips are written for Vietnamese speakers.

import type { DB, Example, Item, Settings, Topic } from '../shared/types';

type SeedItem = {
  text: string;
  ipa: string;
  pos: string;
  vi: string;
  def: string;
  ex: Array<[string, string]>;
  tip: string;
};

type SeedTopic = { id: string; name: string; emoji: string; description: string; items: SeedItem[] };

const TOPICS: SeedTopic[] = [
  {
    id: 'smalltalk',
    name: 'Chuyện phiếm hằng ngày',
    emoji: '☕',
    description: 'Everyday small talk — mở đầu, hỏi thăm và kết thúc câu chuyện thật tự nhiên.',
    items: [
      {
        text: 'How are you getting on?',
        ipa: '/haʊ ə ju ˈɡetɪŋ ɒn/',
        pos: 'question',
        vi: 'Dạo này bạn thế nào rồi? / Mọi việc tiến triển ra sao?',
        def: 'A friendly way to ask how someone is, or how something is going.',
        ex: [
          ['How are you getting on with the new job?', 'Công việc mới của bạn thế nào rồi?'],
          ["Hi Tom! How are you getting on? I haven't seen you for ages.", 'Chào Tom! Dạo này sao rồi? Lâu lắm không gặp.'],
        ],
        tip: '"are you" đọc lướt thành /ə ju/. Nối âm "getting‿on": âm /ŋ/ dính sang "on". Nhấn vào "GET" và "ON".',
      },
      {
        text: "I can't complain",
        ipa: '/aɪ kɑːnt kəmˈpleɪn/',
        pos: 'phrase',
        vi: 'Cũng ổn, không có gì để phàn nàn',
        def: 'Used to say that things are fine, in a modest way.',
        ex: [
          ["How's work? — Oh, I can't complain, really.", 'Công việc sao rồi? — Ờ, cũng ổn thôi.'],
          ["It's been a busy week, but I can't complain.", 'Tuần này bận thật, nhưng cũng không có gì để phàn nàn.'],
        ],
        tip: 'Giọng Anh đọc "can\'t" là /kɑːnt/ với âm "a" dài (như "car"), không phải /kænt/ kiểu Mỹ. Nhấn vào "-PLAIN".',
      },
      {
        text: 'Fancy a cuppa?',
        ipa: '/ˈfænsi ə ˈkʌpə/',
        pos: 'question',
        vi: 'Làm tách trà không?',
        def: 'An informal British way to offer someone a cup of tea.',
        ex: [
          ["You look tired. Fancy a cuppa?", 'Trông bạn mệt quá. Làm tách trà nhé?'],
          ["I'm putting the kettle on. Fancy a cuppa?", 'Mình đang đun nước đây. Uống trà không?'],
        ],
        tip: '"cuppa" /ˈkʌpə/: âm /ʌ/ ngắn, gần giống "ă" trong tiếng Việt; âm cuối là /ə/ rất nhẹ. Lên giọng ở cuối câu hỏi.',
      },
      {
        text: "It's a bit chilly today",
        ipa: '/ɪts ə bɪt ˈtʃɪli təˈdeɪ/',
        pos: 'sentence',
        vi: 'Hôm nay trời hơi lạnh nhỉ',
        def: 'A typical remark about the weather, used to start a conversation.',
        ex: [
          ["It's a bit chilly today, isn't it?", 'Hôm nay hơi lạnh nhỉ?'],
          ["Take a jumper with you. It's a bit chilly today.", 'Mang theo áo len đi. Hôm nay trời hơi lạnh đấy.'],
        ],
        tip: 'Nối âm "It\'s‿a" → /ɪtsə/. "bit" có âm /ɪ/ ngắn và phải bật âm /t/ cuối. "today" đọc /təˈdeɪ/, không phải "tu-đây".',
      },
      {
        text: "What have you been up to?",
        ipa: '/wɒt əv ju bɪn ˈʌp tuː/',
        pos: 'question',
        vi: 'Dạo này bạn làm gì rồi?',
        def: 'A casual way to ask what someone has been doing recently.',
        ex: [
          ["So, what have you been up to this week?", 'Thế tuần này bạn đã làm những gì?'],
          ["I haven't seen you for a while. What have you been up to?", 'Lâu rồi không gặp. Dạo này bạn làm gì?'],
        ],
        tip: '"have" đọc yếu thành /əv/, "been" đọc ngắn /bɪn/. Nhấn mạnh vào "UP". Cả câu nói liền một hơi.',
      },
      {
        text: 'Not too bad, thanks',
        ipa: '/nɒt tuː bæd θæŋks/',
        pos: 'phrase',
        vi: 'Cũng không tệ, cảm ơn nhé',
        def: 'A very common, relaxed answer to "How are you?".',
        ex: [
          ["How are you doing? — Not too bad, thanks. And you?", 'Bạn khoẻ không? — Cũng ổn, cảm ơn. Còn bạn?'],
          ["Not too bad, thanks. Just a little tired after the trip.", 'Cũng ổn, cảm ơn. Chỉ hơi mệt sau chuyến đi thôi.'],
        ],
        tip: 'Âm /θ/ trong "thanks": đặt đầu lưỡi giữa hai hàm răng rồi thổi hơi, đừng đọc thành "th" tiếng Việt hay "s". Nhớ âm /ks/ cuối.',
      },
      {
        text: 'I must dash',
        ipa: '/aɪ məst dæʃ/',
        pos: 'phrase',
        vi: 'Mình phải đi ngay đây',
        def: 'An informal British way to say you have to leave quickly.',
        ex: [
          ["Sorry, I must dash. My train leaves in ten minutes.", 'Xin lỗi, mình phải đi ngay. Tàu chạy sau mười phút nữa.'],
          ["Lovely to see you, but I must dash.", 'Gặp bạn vui lắm, nhưng mình phải chạy đây.'],
        ],
        tip: 'Âm /ʃ/ cuối trong "dash": chu môi nhẹ và thổi hơi dài "sh", đừng bỏ mất. "must" đọc yếu /məst/.',
      },
      {
        text: 'Lovely to see you',
        ipa: '/ˈlʌvli tə siː ju/',
        pos: 'phrase',
        vi: 'Rất vui được gặp bạn',
        def: 'A warm thing to say when you meet or leave someone you know.',
        ex: [
          ["Lovely to see you again! Come in, come in.", 'Vui quá được gặp lại bạn! Vào đi, vào đi.'],
          ["It was lovely to see you. Let's do this again soon.", 'Gặp bạn vui lắm. Hôm nào mình lại gặp nhé.'],
        ],
        tip: '"lovely" /ˈlʌvli/: âm /v/ phải chạm răng trên vào môi dưới. "to" đọc yếu /tə/. Nhấn "LOVE" và "SEE".',
      },
    ],
  },
  {
    id: 'cafe',
    name: 'Quán cà phê & nhà hàng',
    emoji: '🍽️',
    description: 'Ordering food and drink politely, the British way.',
    items: [
      {
        text: 'Could I have a flat white, please?',
        ipa: '/kʊd aɪ hæv ə flæt waɪt pliːz/',
        pos: 'question',
        vi: 'Cho tôi một ly flat white được không ạ?',
        def: 'A polite way to order something in a café or restaurant.',
        ex: [
          ["Could I have a flat white, please? To take away.", 'Cho tôi một ly flat white ạ. Mang đi.'],
          ["Morning! Could I have a flat white and a croissant, please?", 'Chào buổi sáng! Cho tôi một flat white và một bánh sừng bò ạ.'],
        ],
        tip: 'Nối "Could‿I" → /kʊdaɪ/. "could" không đọc âm "l". Bật rõ âm /t/ cuối trong "flat" và "white", kết thúc bằng /z/ trong "please".',
      },
      {
        text: 'eat in or take away',
        ipa: '/iːt ɪn ɔː teɪk əˈweɪ/',
        pos: 'phrase',
        vi: 'ăn tại chỗ hay mang đi',
        def: 'What staff ask to find out whether you will stay or leave with your order.',
        ex: [
          ["Is that to eat in or take away?", 'Anh chị dùng tại đây hay mang đi ạ?'],
          ["I'll eat in today, if there's a table free.", 'Hôm nay tôi ăn tại chỗ, nếu còn bàn trống.'],
        ],
        tip: 'Người Anh nói "take away" (người Mỹ nói "to go"). Nối âm: "eat‿in" → /iːtɪn/, "take‿away" → /teɪkəˈweɪ/.',
      },
      {
        text: "I'll have the fish and chips",
        ipa: '/aɪl hæv ðə fɪʃ ən tʃɪps/',
        pos: 'sentence',
        vi: 'Tôi lấy món cá và khoai tây chiên',
        def: 'A natural way to tell the waiter what you have chosen.',
        ex: [
          ["I'll have the fish and chips, please, with mushy peas.", 'Cho tôi món cá và khoai tây chiên, kèm đậu nghiền ạ.'],
          ["I think I'll have the fish and chips. What about you?", 'Chắc mình gọi cá và khoai tây chiên. Còn bạn?'],
        ],
        tip: '"and" đọc lướt thành /ən/: "fish‿ən‿chips". Phân biệt /ʃ/ trong "fish" (thổi hơi dài) và /tʃ/ trong "chips" (bật hơi).',
      },
      {
        text: 'Could we get the bill, please?',
        ipa: '/kʊd wi ɡet ðə bɪl pliːz/',
        pos: 'question',
        vi: 'Cho chúng tôi xin hoá đơn được không ạ?',
        def: 'How you ask to pay in a British restaurant ("check" in American English).',
        ex: [
          ["Excuse me, could we get the bill, please?", 'Xin lỗi, cho chúng tôi xin hoá đơn ạ.'],
          ["That was delicious. Could we get the bill, please?", 'Ngon quá. Cho chúng tôi tính tiền ạ.'],
        ],
        tip: '"bill" có âm /ɪ/ ngắn và âm /l/ cuối: nâng đầu lưỡi chạm lợi trên, đừng đọc thành "biu".',
      },
      {
        text: "What would you recommend?",
        ipa: '/wɒt wʊd ju ˌrekəˈmend/',
        pos: 'question',
        vi: 'Bạn gợi ý món nào?',
        def: 'A question to ask staff for their suggestion.',
        ex: [
          ["It all looks great. What would you recommend?", 'Món nào trông cũng ngon. Bạn gợi ý món gì?'],
          ["I've never been here before. What would you recommend?", 'Tôi chưa đến đây bao giờ. Bạn gợi ý món nào?'],
        ],
        tip: 'Nối "would‿you" thường thành /wʊdʒu/. "recommend" nhấn âm cuối: re-co-MEND, và bật rõ /nd/.',
      },
      {
        text: "I'm absolutely starving",
        ipa: '/aɪm ˌæbsəˈluːtli ˈstɑːvɪŋ/',
        pos: 'sentence',
        vi: 'Tôi đói muốn xỉu rồi',
        def: 'An informal, emphatic way to say you are very hungry.',
        ex: [
          ["Shall we order? I'm absolutely starving.", 'Mình gọi món nhé? Đói muốn xỉu rồi.'],
          ["I skipped lunch, so I'm absolutely starving now.", 'Mình bỏ bữa trưa nên giờ đói cồn cào.'],
        ],
        tip: 'Giọng Anh không đọc âm "r" trong "starving": /ˈstɑːvɪŋ/ với âm "a" dài. Nhấn "ab-so-LUTE-ly".',
      },
      {
        text: 'still or sparkling',
        ipa: '/stɪl ɔː ˈspɑːklɪŋ/',
        pos: 'phrase',
        vi: 'nước thường hay nước có ga',
        def: 'The two kinds of bottled water you are offered in a restaurant.',
        ex: [
          ["Would you like still or sparkling water?", 'Anh chị dùng nước thường hay nước có ga?'],
          ["Just tap water for me, please. Not still or sparkling.", 'Cho tôi nước máy thôi ạ. Không cần nước đóng chai.'],
        ],
        tip: 'Cụm phụ âm /st/ và /sp/: đọc liền, không chêm "ờ" vào giữa (không phải "sờ-tiu"). "sparkling" không đọc "r".',
      },
      {
        text: "It's on me",
        ipa: '/ɪts ɒn miː/',
        pos: 'phrase',
        vi: 'Để tôi trả / Tôi mời',
        def: 'Said when you want to pay for someone else.',
        ex: [
          ["Put your wallet away. It's on me.", 'Cất ví đi. Để mình trả.'],
          ["You paid last time, so it's on me today.", 'Lần trước bạn trả rồi, nên hôm nay mình mời.'],
        ],
        tip: 'Nối âm "It\'s‿on" → /ɪtsɒn/. Âm /ɒ/ trong "on" tròn môi, ngắn. Nhấn mạnh vào "ME".',
      },
    ],
  },
  {
    id: 'work',
    name: 'Công việc & họp hành',
    emoji: '💼',
    description: 'Phrases for meetings and chatting with colleagues.',
    items: [
      {
        text: "Shall we get started?",
        ipa: '/ʃæl wi ɡet ˈstɑːtɪd/',
        pos: 'question',
        vi: 'Chúng ta bắt đầu nhé?',
        def: 'A polite way to open a meeting.',
        ex: [
          ["Right, everyone's here. Shall we get started?", 'Rồi, mọi người đủ cả. Mình bắt đầu nhé?'],
          ["Shall we get started? We've got a lot to cover.", 'Bắt đầu thôi nhỉ? Hôm nay nhiều việc cần bàn lắm.'],
        ],
        tip: '"Shall" bắt đầu bằng /ʃ/ (chu môi). "started" có hai âm tiết /ˈstɑː-tɪd/, đuôi "-ed" đọc /ɪd/, không đọc "r".',
      },
      {
        text: "I'll get back to you",
        ipa: '/aɪl ɡet bæk tə ju/',
        pos: 'phrase',
        vi: 'Tôi sẽ phản hồi lại bạn sau',
        def: 'Used to promise an answer later.',
        ex: [
          ["Let me check with the team and I'll get back to you.", 'Để tôi hỏi lại nhóm rồi phản hồi bạn sau.'],
          ["I'll get back to you by the end of the day.", 'Cuối ngày tôi sẽ trả lời bạn.'],
        ],
        tip: '"I\'ll" đọc /aɪl/ có âm /l/ nhẹ ở cuối. Bật rõ /k/ trong "back". "to you" đọc yếu /tə ju/.',
      },
      {
        text: 'Could you run me through it?',
        ipa: '/kʊd ju rʌn mi ˈθruː ɪt/',
        pos: 'question',
        vi: 'Bạn giải thích từng bước cho tôi được không?',
        def: 'To ask someone to explain something step by step.',
        ex: [
          ["I missed the meeting. Could you run me through it?", 'Tôi lỡ buổi họp. Bạn tóm lại cho tôi được không?'],
          ["Before we send it, could you run me through it once more?", 'Trước khi gửi, bạn giải thích lại cho tôi một lần nữa nhé?'],
        ],
        tip: '"through" /θruː/: đầu lưỡi giữa hai răng cho âm /θ/, rồi kéo về sau cho /r/. Nối "through‿it".',
      },
      {
        text: "I'm snowed under",
        ipa: '/aɪm snəʊd ˈʌndə/',
        pos: 'idiom',
        vi: 'Tôi đang ngập đầu trong công việc',
        def: 'To have far too much work to do.',
        ex: [
          ["Can we talk tomorrow? I'm snowed under at the moment.", 'Mai mình nói chuyện được không? Giờ mình đang ngập việc.'],
          ["I'm snowed under with emails this week.", 'Tuần này mình ngập trong email.'],
        ],
        tip: 'Giọng Anh đọc "snowed" là /snəʊd/ (âm /əʊ/ bắt đầu từ /ə/). "under" kết thúc bằng /ə/, không đọc "r".',
      },
      {
        text: "Let's touch base next week",
        ipa: '/lets tʌtʃ beɪs nekst wiːk/',
        pos: 'sentence',
        vi: 'Tuần sau mình trao đổi lại nhé',
        def: 'To suggest a short conversation later to share updates.',
        ex: [
          ["I've got to go now. Let's touch base next week.", 'Giờ mình phải đi. Tuần sau mình trao đổi lại nhé.'],
          ["Let's touch base next week and see where we are.", 'Tuần sau mình nói chuyện lại xem tiến độ tới đâu.'],
        ],
        tip: 'Đừng nuốt âm cuối: /tʃ/ trong "touch", /s/ trong "base", /kst/ trong "next" (thường lướt thành /neks wiːk/).',
      },
      {
        text: 'That sounds like a plan',
        ipa: '/ðæt saʊndz laɪk ə plæn/',
        pos: 'phrase',
        vi: 'Nghe hợp lý đấy, cứ thế mà làm',
        def: 'A friendly way to agree with a suggestion.',
        ex: [
          ["Coffee at ten, then the meeting? That sounds like a plan.", 'Mười giờ cà phê rồi họp à? Nghe được đấy.'],
          ["We'll finish the draft today. — That sounds like a plan.", 'Hôm nay mình xong bản nháp nhé. — Được đấy.'],
        ],
        tip: 'Âm /ð/ trong "that": đầu lưỡi giữa hai răng và rung thanh quản. Nối "like‿a" → /laɪkə/. Đọc rõ /ndz/ trong "sounds".',
      },
      {
        text: "I'm not quite sure I follow",
        ipa: '/aɪm nɒt kwaɪt ʃɔː aɪ ˈfɒləʊ/',
        pos: 'sentence',
        vi: 'Tôi chưa hiểu rõ ý bạn lắm',
        def: 'A polite way to say you do not understand.',
        ex: [
          ["Sorry, I'm not quite sure I follow. Could you say that again?", 'Xin lỗi, tôi chưa hiểu lắm. Bạn nói lại được không?'],
          ["I'm not quite sure I follow. Do you mean we should wait?", 'Tôi chưa rõ ý lắm. Ý bạn là mình nên chờ à?'],
        ],
        tip: 'Phân biệt "quite" /kwaɪt/ (khá) với "quiet" /ˈkwaɪət/ (yên lặng). Giọng Anh đọc "sure" là /ʃɔː/.',
      },
      {
        text: 'bear with me',
        ipa: '/beə wɪð miː/',
        pos: 'phrase',
        vi: 'chờ tôi một chút / kiên nhẫn với tôi nhé',
        def: 'A polite way to ask someone to wait while you do something.',
        ex: [
          ["Bear with me a second while I share my screen.", 'Chờ tôi một giây để tôi chia sẻ màn hình nhé.'],
          ["Bear with me, I'm just looking for the file.", 'Chờ tôi chút, tôi đang tìm tệp.'],
        ],
        tip: '"bear" /beə/ đọc giống "bare", không phải "beer" /bɪə/. Âm /ð/ trong "with": lưỡi giữa hai răng.',
      },
    ],
  },
];

export function seedDb(settings: Settings): DB {
  const now = Date.now();
  const topics: Topic[] = [];
  const items: Item[] = [];
  let n = 0;
  for (const seed of TOPICS) {
    topics.push({
      id: seed.id,
      name: seed.name,
      emoji: seed.emoji,
      description: seed.description,
      createdAt: new Date(now).toISOString(),
    });
    for (const it of seed.items) {
      const examples: Example[] = it.ex.map(([en, vi]) => ({ en, vi }));
      items.push({
        id: `${seed.id}-${String(++n).padStart(2, '0')}`,
        topicId: seed.id,
        text: it.text,
        kind: it.text.includes(' ') ? 'phrase' : 'word',
        ipa: it.ipa,
        pos: it.pos,
        meaningVi: it.vi,
        definitionEn: it.def,
        examples,
        tip: it.tip,
        // Stagger creation times so the queue introduces items in the authored order.
        createdAt: new Date(now + n * 1000).toISOString(),
        srs: null,
      });
    }
  }
  return { version: 1, topics, items, logs: [], settings: { ...settings } };
}
